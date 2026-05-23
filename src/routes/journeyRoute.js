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
    if (m) sections.push(m[1].trim());
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

// GET /journey — index by month
router.get('/journey', async (req, res) => {
  const entries = await loadJourneyEntries();

  // Group by YYYY-MM
  const byMonth = new Map();
  for (const entry of entries) {
    const ym = entry.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(entry);
  }

  const monthsHtml = [...byMonth.entries()].map(([ym, monthEntries]) => {
    const items = monthEntries.map(entry => {
      const sections = extractSections(entry.raw);
      const sectionPills = sections.slice(0, 4).map(s => {
        const tagMatch = s.match(/`#([\w-]+)`/);
        const tag = tagMatch ? tagMatch[1] : null;
        const label = s.replace(/\s*`#[\w-]+`\s*/g, '').replace(/^\[Craft Agent\]\s*/i, '').trim();
        return `<span class="journey-pill${tag ? ` journey-pill--${tag}` : ''}">${label || s}</span>`;
      }).join('');
      const overflow = sections.length > 4 ? `<span class="journey-pill journey-pill--more">+${sections.length - 4}</span>` : '';

      return `
        <a href="/journey/${entry.date}" class="journey-entry-row">
          <div class="journey-entry-date">
            <span class="journey-day">${entry.date.slice(8)}</span>
            <span class="journey-weekday">${new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
          </div>
          <div class="journey-entry-body">
            <div class="journey-entry-pills">${sectionPills}${overflow}</div>
            ${sections.length === 0 ? '<span class="journey-empty">No entries</span>' : ''}
          </div>
        </a>`;
    }).join('');

    return `
      <div class="journey-month">
        <h2 class="journey-month-label">${formatMonthLabel(ym)}</h2>
        <div class="journey-month-entries">${items}</div>
      </div>`;
  }).join('');

  res.send(await render('journey.html', {
    pageTitle: 'Journey — LLM KB',
    totalEntries: entries.length,
    monthsHtml: monthsHtml || '<p class="journey-empty-state">No journey entries found.</p>',
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
    activeNav: 'journey',
  }));
});

export default router;
