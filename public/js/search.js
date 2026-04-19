// Search autocomplete for the header search bar
(function () {
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-autocomplete');
  if (!input || !dropdown) return;

  let timer = null;
  let currentIdx = -1;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { hideDropdown(); return; }
    timer = setTimeout(() => fetchSuggestions(q), 250);
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIdx = Math.min(currentIdx + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIdx = Math.max(currentIdx - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter' && currentIdx >= 0) {
      e.preventDefault();
      items[currentIdx].click();
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });

  async function fetchSuggestions(q) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      renderDropdown(data, q);
    } catch (_) {
      hideDropdown();
    }
  }

  function renderDropdown(results, q) {
    if (!results.length) { hideDropdown(); return; }

    const sectionLabels = {
      concepts: '概念', sources: '来源', mocs: 'MOC',
      synthesis: '报告', prompts: '提示词'
    };

    dropdown.innerHTML = results.map(r => {
      const label = sectionLabels[r.section] || r.section;
      return `<a href="/wiki/${r.slug}" class="autocomplete-item">
        <span class="autocomplete-title">${highlight(r.title, q)}</span>
        <span class="autocomplete-section">${label}</span>
      </a>`;
    }).join('');

    // Add "see all results" link
    dropdown.innerHTML += `<a href="/search?q=${encodeURIComponent(q)}" class="autocomplete-item" style="font-style:italic;color:var(--text-muted)">
      <span class="autocomplete-title">查看全部 "${q}" 的搜索结果 →</span>
    </a>`;

    currentIdx = -1;
    dropdown.removeAttribute('hidden');
  }

  function hideDropdown() {
    dropdown.setAttribute('hidden', '');
    dropdown.innerHTML = '';
    currentIdx = -1;
  }

  function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === currentIdx));
    if (currentIdx >= 0) items[currentIdx].scrollIntoView({ block: 'nearest' });
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return escapeHtml(text).replace(regex, m => `<strong>${m}</strong>`);
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
