// ============================================================
// Philosophy Wiki — App
// ============================================================

import { seedEntries, getEntry, getAllEntries, searchEntries } from './db.js';

// ── Loading entries ──────────────────────────────────────────
// On the Mac's own server, entries.js sits beside the app. On the public
// website the entries live in a private GitHub repo and are read with a
// read-only access key that is kept in this browser only. Entries are then
// stored on the device (IndexedDB), so the wiki still opens offline.

const DATA_REPO = 'mchughde/philosophy-wiki';
const KEY_NAME  = 'philwiki.accessKey';
const IS_LOCAL  = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

function readKey()  { try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; } }
function saveKey(k) { try { localStorage.setItem(KEY_NAME, k); } catch { /* private mode */ } }

function parseEntriesJs(text) {
  return JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
}

async function loadEntries() {
  if (IS_LOCAL) return { entries: (await import('./entries.js')).default };
  const key = readKey();
  if (!key) return { needKey: true };
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/entries.js`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
  } catch {
    return { offline: true };                     // no connection: use what's on this device
  }
  if (res.status === 401 || res.status === 404) {
    return { needKey: true, problem: "That access key didn't work, or it has expired. Please enter a new one." };
  }
  if (!res.ok) return { offline: true };          // GitHub having a bad moment
  return { entries: parseEntriesJs(await res.text()) };
}

function renderKeyScreen(problem) {
  document.getElementById('content').innerHTML = `
    <div class="key-screen">
      <h1>Philosophy Wiki</h1>
      <p>${problem || 'The entries are private. Enter your access key to read them on this device.'}</p>
      <form id="key-form">
        <input id="key-input" type="password" autocomplete="off" spellcheck="false"
               placeholder="Access key" aria-label="Access key" required />
        <button type="submit">Open the wiki</button>
      </form>
      <p class="key-note">The key is kept in this browser only. You need to enter it once on each device.</p>
    </div>`;
  document.getElementById('key-form').addEventListener('submit', e => {
    e.preventDefault();
    saveKey(document.getElementById('key-input').value.trim());
    location.reload();
  });
}

// ── Period definitions ────────────────────────────────────────

const PERIODS = [
  'Ancient Greece & Rome',
  'Medieval',
  'Early Modern',
  '18th Century',
  '19th Century',
  'Early 20th Century',
  'Mid–Late 20th Century',
  'Late 20th / 21st Century',
];

// ── Wikilink parsing ─────────────────────────────────────────

function parseWikilinks(markdown) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_, label) => {
    const slug = label.trim().toLowerCase().replace(/\s+/g, '-');
    return `[${label.trim()}](#entry:${slug})`;
  });
}

// ── Helpers ───────────────────────────────────────────────────

function formatYear(n, circa) {
  if (n == null) return '?';
  const s = n < 0 ? `${Math.abs(n)} BC` : `${n} AD`;
  return circa ? `c. ${s}` : s;
}


// ── Render: entry ─────────────────────────────────────────────

// Credit line for a CC-licensed photo (the licence requires naming the
// photographer and the licence). Public-domain photos have no photoCredit.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function photoCreditHtml(entry, { links = true } = {}) {
  const c = entry.photoCredit;
  if (!c) return '';
  const author  = links ? `<a href="${escapeHtml(c.source)}" target="_blank" rel="noopener">${escapeHtml(c.author)}</a>` : escapeHtml(c.author);
  const licence = links ? `<a href="${escapeHtml(c.licenceUrl)}" target="_blank" rel="noopener">${escapeHtml(c.licence)}</a>` : escapeHtml(c.licence);
  return `<figcaption class="photo-credit">Photo: ${author}, ${licence}, via Wikimedia Commons</figcaption>`;
}

function renderEntry(entry) {
  const content = document.getElementById('content');

  const processedBody = parseWikilinks(entry.body);
  const htmlBody = marked.parse(processedBody);

  const tagsHtml = (entry.tags || [])
    .map(t => `<span class="tag">${t}</span>`)
    .join('');

  const photoSrc = entry.photo
    ? (entry.photo.startsWith('http') ? entry.photo : `./photos/${entry.photo}`)
    : null;

  const photoHtml = photoSrc
    ? `<figure class="entry-photo">
         <img src="${photoSrc}" alt="${entry.title}" />
         ${photoCreditHtml(entry)}
       </figure>`
    : '';

  content.innerHTML = `
    <article>
      ${photoHtml}
      <header class="entry-header">
        <h1 class="entry-title">${entry.title}</h1>
        <div class="entry-meta">
          <span class="entry-dates">${formatYear(entry.born, entry.circaBorn)} – ${formatYear(entry.died, entry.circaDied)}</span>
          <span class="entry-tags">${tagsHtml}</span>
        </div>
      </header>
      <div class="entry-body">${htmlBody}</div>
    </article>
  `;

  // Update active link and ensure its group is open
  document.querySelectorAll('#entry-list a').forEach(a => {
    const isActive = a.dataset.slug === entry.slug;
    a.classList.toggle('active', isActive);
    if (isActive) {
      const group = a.closest('details.sidebar-group');
      if (group) group.open = true;
    }
  });

  document.title = `${entry.title} — Philosophy Wiki`;
}

// ── Render: index ─────────────────────────────────────────────

async function renderIndex() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div id="index-page">
      <div class="index-header">
        <h1>Philosophy Wiki</h1>
      </div>
      <p class="subtitle"><em>A personal reference on the history of Western philosophy.</em></p>
      <p class="intro">One hundred entries, from Socrates to Martha Nussbaum — surveying the full sweep of Western thought from Ancient Greece and Rome through the medieval schools, the early moderns, the Enlightenment, and into the 20th and 21st centuries. Each entry covers biographical details, key ideas, major works, and quotes: enough to orient a reader new to a thinker, and a reliable reference for those returning to one.</p>
      <p class="intro">The coverage is weighted towards the modern period, and from the 19th century onwards skews continental: Hegel, Marx, Nietzsche, and Husserl give way to existentialism, phenomenology, the Frankfurt School, and the post-structuralist generation. The analytic tradition appears at its founding moments but is not the primary focus.</p>
      <p class="intro">Taken together, the hundred entries are intended as a substantive introduction to the history of Western philosophy — not exhaustive, but a sound foundation for further study.</p>
      <div class="cover-single">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/1280px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg"
          alt="The School of Athens by Raphael" />
        <span class="cover-caption">Raphael, <em>The School of Athens</em>, 1509–11</span>
      </div>
    </div>
  `;

  document.querySelectorAll('#entry-list a').forEach(a => a.classList.remove('active'));
  document.title = 'Philosophy Wiki';
}


// ── Sidebar ───────────────────────────────────────────────────

async function buildSidebar() {
  const entries = await getAllEntries();
  const list = document.getElementById('entry-list');

  // Group by period, preserving PERIODS order; ungrouped entries go last
  const grouped = {};
  PERIODS.forEach(p => { grouped[p] = []; });
  grouped['Other'] = [];

  entries
    .sort((a, b) => (a.born ?? 9999) - (b.born ?? 9999))
    .forEach(e => {
      const p = e.period && grouped[e.period] ? e.period : 'Other';
      grouped[p].push(e);
    });

  // Determine which period contains the active entry
  const activeSlug = location.hash.startsWith('#entry:')
    ? location.hash.slice(7) : null;

  const allPeriods = [...PERIODS, 'Other'];

  list.innerHTML = allPeriods
    .filter(p => grouped[p] && grouped[p].length > 0)
    .map(p => {
      const hasActive = grouped[p].some(e => e.slug === activeSlug);
      const items = grouped[p].map(e => `
        <li>
          <a href="#entry:${e.slug}" data-slug="${e.slug}"
            class="${e.slug === activeSlug ? 'active' : ''}">${e.title}</a>
        </li>
      `).join('');
      return `
        <details class="sidebar-group" ${hasActive ? 'open' : ''}>
          <summary class="sidebar-group-header">${p}</summary>
          <ul class="sidebar-group-list">${items}</ul>
        </details>
      `;
    }).join('');
}

// ── Router ────────────────────────────────────────────────────

async function route() {
  const hash = location.hash;

  if (hash.startsWith('#entry:')) {
    const slug = hash.slice(7);
    const entry = await getEntry(slug);
    if (entry) {
      renderEntry(entry);
    } else {
      document.getElementById('content').innerHTML =
        `<p class="state-msg">Entry "<strong>${slug}</strong>" not found.</p>`;
    }
  } else {
    renderIndex();
  }

  window.scrollTo(0, 0);
}

// ── Search ────────────────────────────────────────────────────

let searchTimeout = null;

function initSearch() {
  const input = document.getElementById('search');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();

    if (!q) {
      results.innerHTML = '';
      results.classList.remove('visible');
      return;
    }

    searchTimeout = setTimeout(async () => {
      const hits = await searchEntries(q);
      if (!hits.length) {
        results.innerHTML = '<div class="search-result"><span class="search-result-title">No results</span></div>';
      } else {
        results.innerHTML = hits.slice(0, 8).map(e => {
          const idx = e.body.toLowerCase().indexOf(q.toLowerCase());
          let excerpt = '';
          if (idx !== -1) {
            const start = Math.max(0, idx - 30);
            excerpt = (start > 0 ? '…' : '') +
              e.body.slice(start, idx + q.length + 60).replace(/\n/g, ' ') + '…';
          }
          return `
            <div class="search-result" data-slug="${e.slug}">
              <div class="search-result-title">${e.title}</div>
              ${excerpt ? `<div class="search-result-excerpt">${excerpt}</div>` : ''}
            </div>
          `;
        }).join('');
      }
      results.classList.add('visible');
    }, 180);
  });

  results.addEventListener('click', e => {
    const item = e.target.closest('[data-slug]');
    if (!item) return;
    location.hash = `#entry:${item.dataset.slug}`;
    input.value = '';
    results.innerHTML = '';
    results.classList.remove('visible');
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('visible');
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      results.classList.remove('visible');
    }
  });
}

// ── Event delegation: wikilinks ───────────────────────────────

function initContentEvents() {
  document.getElementById('content').addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('#entry:')) {
      e.preventDefault();
      location.hash = href;
    }
  });
}

// ── PDF Export ───────────────────────────────────────────────

// Convert an image URL to a base64 data URL so it renders reliably in print.
// Falls back to the original URL if conversion fails (e.g. strict CORS).
async function photoToDataUrl(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(src); // canvas tainted — use original URL as fallback
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

async function exportEntryPDF(entry) {
  // Convert photo to data URL for reliable print rendering
  let photoHtml = '';
  if (entry.photo) {
    const src = entry.photo.startsWith('http') ? entry.photo : `./photos/${entry.photo}`;
    const dataUrl = await photoToDataUrl(src);
    photoHtml = `<figure class="print-photo"><img src="${dataUrl}" alt="${entry.title}" />${photoCreditHtml(entry, { links: false })}</figure>`;
  }

  const body = marked.parse(parseWikilinks(entry.body));
  const tags = (entry.tags || []).join(' · ');

  const entryHtml = `
    <article class="print-entry">
      ${photoHtml}
      <header class="print-header">
        <h1 class="print-title">${entry.title}</h1>
        <p class="print-dates">${formatYear(entry.born, entry.circaBorn)} – ${formatYear(entry.died, entry.circaDied)}</p>
        <p class="print-tags">${tags}</p>
      </header>
      <div class="print-body">${body}</div>
    </article>
  `;

  let container = document.getElementById('pdf-print-container');
  if (container) container.remove();

  container = document.createElement('div');
  container.id = 'pdf-print-container';
  container.innerHTML = entryHtml;
  document.body.appendChild(container);

  const savedTitle = document.title;
  const savedUrl   = location.href;
  document.title   = entry.title;
  history.replaceState(null, '', location.origin + (location.pathname || '/'));

  window.addEventListener('afterprint', () => {
    document.title = savedTitle;
    history.replaceState(null, '', savedUrl);
    container.remove();
  }, { once: true });

  await new Promise(resolve => setTimeout(resolve, 200));
  window.print();
}

// ── Site title → home ─────────────────────────────────────────

function initHomeLink() {
  document.getElementById('site-title').addEventListener('click', () => {
    location.hash = '';
    renderIndex();
  });
}

// ── Service worker ────────────────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
}

// ── Boot ──────────────────────────────────────────────────────

async function boot() {
  const loaded = await loadEntries();
  if (loaded.entries) {
    try {
      await seedEntries(loaded.entries);
    } catch (err) {
      console.error('Seeding failed:', err);
    }
  }

  if (loaded.needKey) {
    renderKeyScreen(loaded.problem);
    registerSW();
    return;
  }

  const stored = await getAllEntries().catch(() => []);
  if (!stored.length) {
    document.getElementById('content').innerHTML =
      '<p class="state-msg">The wiki couldn\'t reach GitHub. Connect to the internet once on this device to load the entries.</p>';
    registerSW();
    return;
  }

  await buildSidebar();
  initSearch();
  initHomeLink();
  initContentEvents();

  window.addEventListener('hashchange', route);
  await route();
  registerSW();
}

boot();
