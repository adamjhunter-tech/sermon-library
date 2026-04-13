/* ============================================================
   Sermon & Study Library — app.js
   Shared utilities and page logic for the static library site.
   No build step. No dependencies except fuse.min.js (optional).
   Works with file:// protocol.
   ============================================================ */

'use strict';

// ── Canonical Bible book order ─────────────────────────────────
const BIBLE_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Psalm','Proverbs','Ecclesiastes',
  'Song of Solomon','Song of Songs','Isaiah','Jeremiah','Lamentations','Ezekiel',
  'Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
  'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation'
];

function bookOrder(ref) {
  const name = ref.replace(/\s+\d.*$/, '').trim();
  const idx = BIBLE_BOOKS.findIndex(b => name.toLowerCase().startsWith(b.toLowerCase()) || b.toLowerCase().startsWith(name.toLowerCase()));
  return idx === -1 ? 999 : idx;
}

// ── Simple fuzzy/substring search ────────────────────────────
function buildSearchIndex(lessons) {
  return lessons.map(l => ({
    lesson: l,
    searchText: [
      l.title || '',
      l.speaker || '',
      l.series || '',
      l.summary || '',
      (l.tags || []).map(t => t.tag).join(' '),
      (l.scripture_references || []).map(r => r.reference).join(' ')
    ].join(' ').toLowerCase()
  }));
}

let _searchIndex = null;

function getSearchIndex() {
  if (!_searchIndex && window.LIBRARY_DATA) {
    _searchIndex = buildSearchIndex(window.LIBRARY_DATA.lessons || []);
  }
  return _searchIndex || [];
}

function searchLessons(query, filters) {
  let results = getSearchIndex();
  if (query && query.trim()) {
    const tokens = query.toLowerCase().trim().split(/\s+/);
    results = results.filter(r => tokens.every(t => r.searchText.includes(t)));
  }
  // Apply filters
  if (filters.speaker) results = results.filter(r => r.lesson.speaker === filters.speaker);
  if (filters.series)  results = results.filter(r => r.lesson.series  === filters.series);
  if (filters.tag)     results = results.filter(r => (r.lesson.tags||[]).some(t => t.tag === filters.tag));
  if (filters.book)    results = results.filter(r =>
    (r.lesson.scripture_references||[]).some(s => s.reference.startsWith(filters.book + ' ') || s.reference.startsWith(filters.book + ':'))
  );
  return results.map(r => r.lesson);
}

// ── Template helpers ────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bibleGatewayUrl(ref) {
  return 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(ref) + '&version=NKJV';
}

function renderTag(tagObj) {
  const cls = tagObj.source === 'index' ? 'tag index-tag' : 'tag';
  return `<span class="${cls}" title="${tagObj.source === 'index' ? 'From index' : 'AI-detected'}">${esc(tagObj.tag)}</span>`;
}

function renderLessonCard(lesson) {
  const tags = (lesson.tags || []).slice(0, 5).map(renderTag).join('');
  const refCount = (lesson.scripture_references || []).length;
  const seriesBadge = lesson.series
    ? `<span class="card-series">${esc(lesson.series)}${lesson.series_part ? ' · Part ' + lesson.series_part : ''}</span>`
    : '';
  const sessionIcon = lesson.session === 'AM' ? '☀' : lesson.session === 'PM' ? '🌙' : '';
  return `
<a class="lesson-card" href="lesson/${esc(lesson.id)}.html">
  <div class="card-title">${esc(lesson.title)}</div>
  <div class="card-meta">
    <span>${esc(lesson.speaker)}</span>
    <span>${esc(lesson.date)}</span>
    ${sessionIcon ? `<span>${sessionIcon}</span>` : ''}
  </div>
  ${seriesBadge}
  <div class="card-summary">${esc(lesson.summary)}</div>
  <div class="card-footer">
    <div class="tag-list">${tags}</div>
    ${refCount ? `<span class="card-ref-count">${refCount} ref${refCount !== 1 ? 's' : ''}</span>` : ''}
  </div>
</a>`;
}

// ── Index Page ───────────────────────────────────────────────
function initIndexPage() {
  const data = window.LIBRARY_DATA;
  if (!data) return;

  const lessons = data.lessons || [];
  const container = document.getElementById('cards-container');
  const countEl   = document.getElementById('result-count');
  const searchEl  = document.getElementById('search-input');
  const clearBtn  = document.getElementById('clear-btn');

  // Populate filter dropdowns
  const speakers = [...new Set(lessons.map(l => l.speaker).filter(Boolean))].sort();
  const series   = [...new Set(lessons.map(l => l.series).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  const tags     = [...new Set(lessons.flatMap(l => (l.tags||[]).map(t => t.tag)))].filter(t => bookOrder(t) === 999).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  const books    = [...new Set(lessons.flatMap(l => (l.scripture_references||[]).map(r => r.reference.replace(/[:\s]\d.*$/, '').trim())))].filter(b => bookOrder(b) !== 999).sort((a,b)=>bookOrder(a)-bookOrder(b));

  populateSelect('speaker-select', speakers);
  populateSelect('series-select',  series);
  populateSelect('tag-select',     tags);
  populateSelect('book-select',    books);

  function render() {
    const query   = searchEl.value;
    const filters = {
      speaker: document.getElementById('speaker-select').value,
      series:  document.getElementById('series-select').value,
      tag:     document.getElementById('tag-select').value,
      book:    document.getElementById('book-select').value
    };
    const results = searchLessons(query, filters);
    container.innerHTML = results.length
      ? results.map(renderLessonCard).join('')
      : '<p style="color:var(--muted);padding:2rem 0">No lessons found. Try broadening your search.</p>';
    countEl.textContent = `Showing ${results.length} of ${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}`;
  }

  searchEl.addEventListener('input', render);
  document.querySelectorAll('.filter-select').forEach(el => el.addEventListener('change', render));
  clearBtn.addEventListener('click', () => {
    searchEl.value = '';
    document.querySelectorAll('.filter-select').forEach(el => el.value = '');
    render();
  });

  render();
}

function populateSelect(id, options) {
  const sel = document.getElementById(id);
  if (!sel) return;
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt;
    el.textContent = opt;
    sel.appendChild(el);
  });
}

// ── Scripture Index Page ─────────────────────────────────────
function initScripturePage() {
  const data = window.LIBRARY_DATA;
  if (!data) return;

  // Build aggregated scripture map across all lessons
  const refMap = {}; // "Romans 5:8" -> [{lessonId, title, type, source}, ...]
  (data.lessons || []).forEach(lesson => {
    (lesson.scripture_references || []).forEach(ref => {
      const key = ref.reference;
      if (!refMap[key]) refMap[key] = { type: ref.type, source: ref.source, lessons: [] };
      refMap[key].lessons.push({ id: lesson.id, title: lesson.title });
      // Upgrade type: quoted > referenced > index-only
      if (ref.type === 'quoted') refMap[key].type = 'quoted';
      else if (ref.type === 'referenced' && refMap[key].type === 'index-only') refMap[key].type = 'referenced';
    });
  });

  // Group by book in canonical order
  const bookGroups = {};
  Object.entries(refMap).forEach(([ref, data]) => {
    const book = ref.replace(/\s+[\d:,\-–]+.*$/, '').replace(/\s+\d+$/, '').trim();
    if (!bookGroups[book]) bookGroups[book] = [];
    bookGroups[book].push({ ref, ...data });
  });

  const sortedBooks = Object.keys(bookGroups).sort((a,b)=>bookOrder(a)-bookOrder(b));
  const container = document.getElementById('scripture-container');
  if (!container) return;

  container.innerHTML = sortedBooks.map(book => {
    const entries = bookGroups[book].sort((a,b) => {
      const na = parseInt((a.ref.match(/\d+/)||[])[0]||0);
      const nb = parseInt((b.ref.match(/\d+/)||[])[0]||0);
      return na - nb;
    });
    return `
<div class="book-section" id="book-${book.replace(/\s/g,'-')}">
  <details open>
    <summary>${esc(book)} <span class="book-count">${entries.length} passage${entries.length!==1?'s':''}</span></summary>
    <div class="ref-entries">
      ${entries.map(e => `
        <div class="ref-entry">
          <div>
            <span class="ref-passage">${esc(e.ref)}</span>
            <span class="ref-badge ${e.type}">${e.type}</span>
            ${e.type === 'index-only' ? '<br><small style="color:var(--amber)">⚑ Verify in transcript</small>' : ''}
          </div>
          <div class="ref-lessons">
            ${e.lessons.map(l => `<a class="ref-lesson-link" href="lesson/${esc(l.id)}.html">${esc(l.title)}</a>`).join('')}
          </div>
        </div>`).join('')}
    </div>
  </details>
</div>`;
  }).join('');

  // Search
  const searchEl = document.getElementById('scripture-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase();
      document.querySelectorAll('.book-section').forEach(section => {
        const text = section.textContent.toLowerCase();
        section.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
  }
}

// ── Topics Page ──────────────────────────────────────────────
function initTopicsPage() {
  const data = window.LIBRARY_DATA;
  if (!data) return;

  // Build topic map
  const topicMap = {}; // "tag" -> [{id, title, source}, ...]
  (data.lessons || []).forEach(lesson => {
    (lesson.tags || []).forEach(tagObj => {
      const key = tagObj.tag.toLowerCase();
      if (!topicMap[key]) topicMap[key] = { tag: tagObj.tag, source: tagObj.source, lessons: [] };
      topicMap[key].lessons.push({ id: lesson.id, title: lesson.title });
      // Upgrade source
      if (tagObj.source === 'both') topicMap[key].source = 'both';
      else if (tagObj.source === 'index' && topicMap[key].source === 'detected') topicMap[key].source = 'both';
    });
  });

  // Sort alphabetically, group by letter
  const letterGroups = {};
  Object.entries(topicMap).forEach(([, t]) => {
    const letter = t.tag[0].toUpperCase();
    if (!letterGroups[letter]) letterGroups[letter] = [];
    letterGroups[letter].push(t);
  });

  const letters = Object.keys(letterGroups).sort();
  const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const container = document.getElementById('topics-container');
  const alphaNav  = document.getElementById('alpha-nav');

  if (alphaNav) {
    alphaNav.innerHTML = ALL_LETTERS.map(l =>
      letters.includes(l)
        ? `<a href="#letter-${l}">${l}</a>`
        : `<a class="disabled">${l}</a>`
    ).join('');
  }

  if (container) {
    container.innerHTML = letters.map(letter => {
      const topics = letterGroups[letter].sort((a,b)=>a.tag.localeCompare(b.tag));
      return `
<div class="topic-group" id="letter-${letter}">
  <div class="topic-group-letter">${letter}</div>
  ${topics.map(t => `
    <div class="topic-entry">
      <div>
        <span class="topic-name">${esc(t.tag)}</span>
        ${t.source === 'index' || t.source === 'both' ? '<span class="topic-source index-src">index</span>' : ''}
        <div class="topic-count">${t.lessons.length} lesson${t.lessons.length!==1?'s':''}</div>
      </div>
      <div class="topic-lessons">
        ${t.lessons.map(l => `<a class="topic-lesson-link" href="lesson/${esc(l.id)}.html">${esc(l.title)}</a>`).join('')}
      </div>
    </div>`).join('')}
</div>`;
    }).join('');
  }

  // Search
  const searchEl = document.getElementById('topic-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase();
      document.querySelectorAll('.topic-entry').forEach(entry => {
        entry.style.display = !q || entry.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.topic-group').forEach(g => {
        const visible = [...g.querySelectorAll('.topic-entry')].some(e=>e.style.display!=='none');
        g.style.display = visible ? '' : 'none';
      });
    });
  }
}

// ── Series Page ──────────────────────────────────────────────
function initSeriesPage() {
  const data = window.LIBRARY_DATA;
  if (!data) return;

  const lessons = data.lessons || [];
  const seriesMap = {};

  lessons.forEach(lesson => {
    if (!lesson.series) return;
    if (!seriesMap[lesson.series]) seriesMap[lesson.series] = { lessons: [], refs: [] };
    seriesMap[lesson.series].lessons.push(lesson);
    (lesson.scripture_references || []).forEach(r => seriesMap[lesson.series].refs.push(r.reference));
  });

  // Determine the primary Bible book for a series.
  // 1. If the series name contains a Bible book name, use it.
  // 2. Otherwise require the top-cited book to have ≥2x the refs of second place.
  // 3. Otherwise return null (Topical / Other).
  function primaryBook(name, refs) {
    // Check series name for a Bible book reference
    for (const book of BIBLE_BOOKS) {
      const re = new RegExp('\\b' + book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(name)) return book;
    }
    // Count scripture refs by book
    const counts = {};
    refs.forEach(ref => {
      const book = ref.replace(/\s+\d.*$/, '').trim();
      const ord = bookOrder(book);
      if (ord !== 999) counts[book] = (counts[book] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : bookOrder(a[0]) - bookOrder(b[0])
    );
    if (!sorted.length) return null;
    // Only assign if top book has at least 2× the refs of second place
    const top = sorted[0][1];
    const second = sorted[1] ? sorted[1][1] : 0;
    return top >= 2 * Math.max(second, 1) ? sorted[0][0] : null;
  }

  const seriesList = Object.entries(seriesMap).map(([name, s]) => {
    const parts = [...s.lessons].sort((a, b) => (a.series_part || 999) - (b.series_part || 999));
    const book  = primaryBook(name, s.refs);
    return { name, book, bOrd: book ? bookOrder(book) : 9999, count: parts.length,
             desc: parts[0] ? parts[0].summary : '', parts };
  }).sort((a, b) => a.bOrd !== b.bOrd ? a.bOrd - b.bOrd : a.name.localeCompare(b.name));

  const container = document.getElementById('series-container');
  if (!container) return;

  container.innerHTML = seriesList.map(s => {
    const bookLabel = s.book || 'Topical / Other';
    const partsHtml = s.parts.map(l =>
      `<li><a href="lesson/${esc(l.id)}.html">${esc(l.title)}</a></li>`
    ).join('');
    return `
<details class="series-item">
  <summary class="series-item-summary">
    <span class="series-item-book">${esc(bookLabel)}</span>
    <span class="series-item-title">${esc(s.name)}</span>
    <span class="series-item-count">${s.count} episode${s.count !== 1 ? 's' : ''}</span>
  </summary>
  <div class="series-item-body">
    ${s.desc ? `<p class="series-item-desc">${esc(s.desc)}</p>` : ''}
    <ol class="series-parts-list">${partsHtml}</ol>
  </div>
</details>`;
  }).join('');
}

// ── Lesson Page ──────────────────────────────────────────────
function initLessonPage() {
  const lesson = window.LESSON_DATA;
  if (!lesson) return;

  // Render transcript (markdown → HTML)
  const transcriptEl = document.getElementById('transcript-body');
  if (transcriptEl && lesson.transcript) {
    transcriptEl.innerHTML = markdownToHtml(lesson.transcript);
  }

  // Render outline with anchor links (titles only — keeps sidebar compact)
  const outlineEl = document.getElementById('outline-body');
  if (outlineEl && lesson.outline && lesson.outline.length) {
    outlineEl.innerHTML = `<ul class="outline-list">
      ${lesson.outline.map((pt, i) => {
        const headerId = 'section-' + i;
        return `<li>
          <div class="outline-point"><a href="#${headerId}">${esc(pt.title)}</a></div>
          ${pt.scripture && pt.scripture.length ? `<div class="outline-scripture">${pt.scripture.map(esc).join(', ')}</div>` : ''}
        </li>`;
      }).join('')}
    </ul>`;
    // Inject id anchors into transcript headers
    if (transcriptEl) {
      const headers = transcriptEl.querySelectorAll('h2, h3');
      lesson.outline.forEach((pt, i) => {
        if (headers[i]) headers[i].id = 'section-' + i;
      });
    }
  }

  // Render scripture references
  const refsEl = document.getElementById('refs-body');
  if (refsEl && lesson.scripture_references && lesson.scripture_references.length) {
    refsEl.innerHTML = `<ul class="ref-list">
      ${lesson.scripture_references.map(r => `
        <li>
          <a href="${bibleGatewayUrl(r.reference)}" target="_blank" rel="noopener">${esc(r.reference)}</a>
          <span class="ref-type">${r.type}</span>
          ${r.type === 'index-only' ? '<span class="ref-flag" title="From index — verify in transcript">⚑</span>' : ''}
        </li>`).join('')}
    </ul>`;
  }

  // Render tags
  const tagsEl = document.getElementById('tags-body');
  if (tagsEl && lesson.tags && lesson.tags.length) {
    tagsEl.innerHTML = `<div class="tag-list">${lesson.tags.map(renderTag).join('')}</div>`;
  }

  // Render bottom scripture references section (below transcript)
  if (transcriptEl && lesson.scripture_references && lesson.scripture_references.length) {
    const bottomRefs = document.createElement('div');
    bottomRefs.className = 'bottom-refs';
    bottomRefs.innerHTML = `
      <h2 class="bottom-refs-title">Scripture References</h2>
      <ul class="bottom-refs-list">
        ${lesson.scripture_references.map(r => `
          <li>
            <a href="${bibleGatewayUrl(r.reference)}" target="_blank" rel="noopener">${esc(r.reference)}</a>
            <span class="ref-type">${r.type}</span>
            ${r.type === 'index-only' ? '<span class="ref-flag" title="From index — verify in transcript">⚑</span>' : ''}
          </li>`).join('')}
      </ul>`;
    transcriptEl.appendChild(bottomRefs);
  }

  // Print button
  const printBtn = document.getElementById('print-btn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());
}

// ── Markdown → HTML (subset: #/##/### headers, blockquotes, paragraphs) ──
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inParagraph = false;
  let inBlockquote = false;
  let bqLines = [];

  function flushBq() {
    if (bqLines.length) {
      out.push(`<blockquote><p>${bqLines.join(' ')}</p></blockquote>`);
      bqLines = [];
      inBlockquote = false;
    }
  }
  function closeParagraph() {
    if (inParagraph) { out.push('</p>'); inParagraph = false; }
  }

  for (let raw of lines) {
    const line = raw;
    if (line.startsWith('# ')) {
      flushBq(); closeParagraph();
      out.push(`<h1>${esc(line.slice(2).trim())}</h1>`);
    } else if (line.startsWith('## ')) {
      flushBq(); closeParagraph();
      out.push(`<h2>${esc(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('### ')) {
      flushBq(); closeParagraph();
      out.push(`<h3>${esc(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith('> ')) {
      closeParagraph();
      if (!inBlockquote) inBlockquote = true;
      bqLines.push(esc(line.slice(2).trim()));
    } else if (line.trim() === '') {
      flushBq(); closeParagraph();
    } else {
      flushBq();
      if (!inParagraph) { out.push('<p>'); inParagraph = true; }
      else out.push(' ');
      out.push(esc(line.trim()));
    }
  }
  flushBq(); closeParagraph();
  return out.join('');
}

// ── Auto-init based on page ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  if (body.dataset.page === 'index')     initIndexPage();
  if (body.dataset.page === 'scripture') initScripturePage();
  if (body.dataset.page === 'topics')    initTopicsPage();
  if (body.dataset.page === 'series')    initSeriesPage();
  if (body.dataset.page === 'lesson')    initLessonPage();
});
