import { Router } from 'express';
import { readFile, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { VAULT_PATH } from '../../config.js';
import { renderMarkdown } from '../render/markdown.js';
import { render } from '../render/template.js';

const router = Router();

const JOURNEY_DIR = join(VAULT_PATH, 'Journey');

async function loadJourneyEntries() {
  let files;
  try {
    files = await readdir(JOURNEY_DIR);
  } catch {
    return [];
  }

  const entries = [];
  for (const filename of files) {
    if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(filename)) continue;
    const date = filename.replace('.md', '');
    const filepath = join(JOURNEY_DIR, filename);
    let raw, fileStat;
    try {
      [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]);
    } catch { continue; }

    entries.push({ date, filepath, raw, mtime: fileStat.mtime });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function extractSections(raw) {
  const lines = raw.split('\n');
  const sections = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (!m) continue;
    const full = m[1].trim();

    // Extract time prefix like "22:00" or "17:30"
    const timeMatch = full.match(/^(\d{1,2}:\d{2})\s+/);
    const time = timeMatch ? timeMatch[1] : null;

    // Extract backtick tag like `#meeting`
    const tagMatch = full.match(/`#([\w-]+)`/);
    const tag = tagMatch ? tagMatch[1] : null;

    // Clean title: remove time prefix, [Craft Agent] noise, backtick tags
    let title = full
      .replace(/^\d{1,2}:\d{2}\s+/, '')
      .replace(/\[Craft Agent\]\s*/i, '')
      .replace(/\s*`#[\w-]+`/g, '')
      .trim();

    // If title has a person name repeated (e.g. "影像BSP工程师-鲁航 鲁航"), dedupe
    title = title.replace(/^(.+?\S)\s+\1$/, '$1').trim();

    sections.push({ time, tag, title, full });
  }
  return sections;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function weekStart(dateStr) {
  // Returns the Monday of the ISO week for a given YYYY-MM-DD
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(monStr) {
  const mon = new Date(monStr + 'T12:00:00');
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  const sameMonth = mon.getMonth() === sun.getMonth();
  const start = mon.toLocaleDateString('en-US', opts);
  const end = sun.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : opts);
  return `${start} – ${end}`;
}

const TAG_LABELS = { meeting: '会议', memory: '记忆', 'journal-entry': '日记' };

async function renderJourneyHeatmap(entries) {
  const entryMap = new Map();
  for (const entry of entries) {
    const sections = (entry.raw.match(/^##\s+/gm) || []).length;
    entryMap.set(entry.date, sections);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const gridEnd = new Date(today);
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - 363);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const totalInYear = [...entryMap.keys()].filter(d => d >= gridStart.toISOString().slice(0, 10) && d <= todayStr).length;

  const weeks = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      week.push({ date: dateStr, count: entryMap.get(dateStr) || 0, isFuture: cursor > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getDay() === 0) {} // already advanced
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabels = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const m = new Date(week[0].date + 'T12:00:00').getMonth();
    if (m !== prevMonth) { monthLabels.push({ col: wi, label: MONTHS[m] }); prevMonth = m; }
  });

  function level(count, isFuture) {
    if (isFuture || count === 0) return 0;
    if (count === 1) return 1; if (count <= 3) return 2; if (count <= 5) return 3; return 4;
  }

  const CELL = 11, GAP = 2, STEP = CELL + GAP;
  const LEFT_PAD = 28, TOP_PAD = 20;
  const svgW = LEFT_PAD + weeks.length * STEP;
  const svgH = TOP_PAD + 7 * STEP;

  const monthLabelsSvg = monthLabels.map(({ col, label }) =>
    `<text x="${LEFT_PAD + col * STEP}" y="${TOP_PAD - 6}" class="hm-month">${label}</text>`
  ).join('');
  const dayLabelsSvg = [1,3,5].map(d =>
    `<text x="${LEFT_PAD - 4}" y="${TOP_PAD + d * STEP + CELL - 2}" class="hm-day">${['','Mon','','Wed','','Fri',''][d]}</text>`
  ).join('');
  const cellsSvg = weeks.map((week, wi) =>
    week.map((cell, di) => {
      const x = LEFT_PAD + wi * STEP, y = TOP_PAD + di * STEP;
      const lv = level(cell.count, cell.isFuture);
      const title = cell.count ? `${cell.date}: ${cell.count} section${cell.count > 1 ? 's' : ''}` : cell.date;
      const wrap = cell.count > 0 ? [`<a href="/journey/${cell.date}">`, '</a>'] : ['',''];
      return `${wrap[0]}<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${lv}" data-date="${cell.date}"><title>${title}</title></rect>${wrap[1]}`;
    }).join('')
  ).join('');

  return `<div class="journey-heatmap-wrap">
    <div class="journey-heatmap-header">
      <span class="journey-heatmap-count"><strong>${totalInYear}</strong> entries in the last year</span>
    </div>
    <svg class="journey-heatmap-svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
      ${monthLabelsSvg}${dayLabelsSvg}${cellsSvg}
    </svg>
    <div class="journey-heatmap-legend">
      <span class="hm-legend-label">Less</span>
      <svg viewBox="0 0 ${5*STEP-GAP} ${CELL}" width="${5*STEP-GAP}" height="${CELL}">${
        [0,1,2,3,4].map((l,i) => `<rect x="${i*STEP}" y="0" width="${CELL}" height="${CELL}" rx="2" class="hm-cell hm-l${l}"/>`).join('')
      }</svg>
      <span class="hm-legend-label">More</span>
    </div>
  </div>`;
}

function renderEntryRow(entry) {
  const sections = extractSections(entry.raw);
  const d = new Date(entry.date + 'T12:00:00');

  const sectionRows = sections.map(s => {
    const tagBadge = s.tag
      ? `<span class="journey-tag journey-tag--${s.tag}">${TAG_LABELS[s.tag] || s.tag}</span>`
      : '';
    const timeSpan = s.time ? `<span class="journey-stime">${s.time}</span>` : '';
    return `<div class="journey-section-item">${timeSpan}<span class="journey-stitle">${s.title || s.full}</span>${tagBadge}</div>`;
  }).join('');

  return `
    <a href="/journey/${entry.date}" class="journey-entry-row">
      <div class="journey-entry-date">
        <span class="journey-day">${entry.date.slice(8)}</span>
        <span class="journey-weekday">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      </div>
      <div class="journey-entry-body">
        ${sectionRows || '<span class="journey-empty">No entries</span>'}
      </div>
    </a>`;
}

// GET /journey — index (month or week view)
router.get('/journey', async (req, res) => {
  const entries = await loadJourneyEntries();
  const view = req.query.view === 'week' ? 'week' : 'month';

  let groupsHtml;

  if (view === 'week') {
    // Group by Monday of ISO week
    const byWeek = new Map();
    for (const entry of entries) {
      const key = weekStart(entry.date);
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key).push(entry);
    }
    groupsHtml = [...byWeek.entries()].map(([monStr, weekEntries]) => {
      const items = weekEntries.map(renderEntryRow).join('');
      return `
        <div class="journey-group">
          <h2 class="journey-group-label">${formatWeekLabel(monStr)}</h2>
          <div class="journey-month-entries">${items}</div>
        </div>`;
    }).join('');
  } else {
    // Group by YYYY-MM
    const byMonth = new Map();
    for (const entry of entries) {
      const ym = entry.date.slice(0, 7);
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym).push(entry);
    }
    groupsHtml = [...byMonth.entries()].map(([ym, monthEntries]) => {
      const items = monthEntries.map(renderEntryRow).join('');
      return `
        <div class="journey-group">
          <h2 class="journey-group-label">${formatMonthLabel(ym)}</h2>
          <div class="journey-month-entries">${items}</div>
        </div>`;
    }).join('');
  }

  const heatmapHtml = await renderJourneyHeatmap(entries);

  res.send(await render('journey.html', {
    pageTitle: 'Journey — LLM KB',
    totalEntries: entries.length,
    heatmapHtml,
    groupsHtml: groupsHtml || '<p class="journey-empty-state">No journey entries found.</p>',
    viewMonth: view === 'month',
    viewWeek: view === 'week',
    activeNav: 'journey',
  }));
});

// GET /journey/:date — single entry
router.get('/journey/:date', async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(404).send('Not found');

  const filepath = join(JOURNEY_DIR, `${date}.md`);
  let raw;
  try {
    raw = await readFile(filepath, 'utf8');
  } catch {
    return res.status(404).send('Entry not found');
  }

  // Remove top-level h1 (the date heading) before rendering
  const body = raw.replace(/^#\s+.+\n?/, '');
  const html = renderMarkdown(body, filepath);
  const displayDate = formatDisplayDate(date);

  // Prev / next links
  const entries = await loadJourneyEntries();
  const idx = entries.findIndex(e => e.date === date);
  const prevEntry = idx < entries.length - 1 ? entries[idx + 1] : null;
  const nextEntry = idx > 0 ? entries[idx - 1] : null;

  const prevNext = `
    <div class="journey-prevnext">
      ${prevEntry ? `<a href="/journey/${prevEntry.date}" class="journey-nav-link journey-nav-link--prev">← ${prevEntry.date}</a>` : '<span></span>'}
      <a href="/journey" class="journey-nav-link journey-nav-link--index">All Entries</a>
      ${nextEntry ? `<a href="/journey/${nextEntry.date}" class="journey-nav-link journey-nav-link--next">${nextEntry.date} →</a>` : '<span></span>'}
    </div>`;

  res.send(await render('article.html', {
    pageTitle: `${displayDate} — Journey`,
    title: displayDate,
    sectionLabel: 'Journey',
    breadcrumb: `<a href="/">Home</a> › <a href="/journey">Journey</a> › ${date}`,
    infobox: '',
    toc: '',
    content: html + prevNext,
    backlinks: '',
    tagBadges: '',
    updatedAt: date,
    hideFlipbook: true,
    hideGraph: true,
    activeNav: 'journey',
  }));
});

export default router;
