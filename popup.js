/* global geoAnalyze, chrome */
const view = document.getElementById('view');
let DATA = null;
let RESULT = null;
let currentTab = 'overview';

// ---------------- Rendering ----------------
const checksFor = (cat) => RESULT.checks.filter((c) => c.cat === cat)
  .map((c) => `<div class="check">${badge(c.status)}<div><div class="label">${esc(c.label)}</div><div class="detail">${esc(c.detail)}</div></div></div>`).join('');

const renderers = {
  overview() {
    const { total, cats } = RESULT;
    const r = 40, circ = 2 * Math.PI * r;
    const todo = RESULT.checks.filter((c) => c.status === 'fail' || c.status === 'warn')
      .sort((a, b) => b.weight * (a.status === 'fail' ? 2 : 1) - a.weight * (b.status === 'fail' ? 2 : 1)).slice(0, 6);
    return `
      <div class="score-wrap">
        <div class="gauge">
          <svg width="92" height="92"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
          <circle cx="46" cy="46" r="${r}" fill="none" stroke="${color(total)}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - total / 100)}"/></svg>
          <div class="num"><div>${total}<small>GEO-Score</small></div></div>
        </div>
        <div class="score-text">
          <div class="grade">${grade(total)}</div>
          <div class="url">${esc(DATA.meta.title || '(ohne Titel)')}</div>
          <div class="url">${esc(DATA.meta.url)}</div>
        </div>
      </div>
      <div class="cats">
        ${Object.entries(cats).map(([k, c]) => {
          const pct = Math.round((c.got / c.max) * 100);
          return `<div class="cat" data-go="${CATS[k].tab}"><div class="row"><span>${CATS[k].label}</span><span>${Math.round(c.got)}/${c.max}</span></div>
            <div class="bar"><i style="width:${pct}%;background:${color(pct)}"></i></div></div>`;
        }).join('')}
      </div>
      <h2>Wichtigste Hebel</h2>
      ${todo.length ? todo.map((c) => `<div class="check">${badge(c.status)}<div><div class="label">${esc(c.label)}</div><div class="detail">${esc(c.detail)}</div></div></div>`).join('') : '<div class="empty">Alles im grünen Bereich.</div>'}
      <h2>Technik</h2>
      ${checksFor('tech')}
      <h2>Meta</h2>
      <dl class="kv">
        <dt>Title</dt><dd>${esc(DATA.meta.title) || '–'} <span class="count">${DATA.meta.title.length} Z.</span></dd>
        <dt>Description</dt><dd>${esc(DATA.meta.description) || '–'} <span class="count">${DATA.meta.description.length} Z.</span></dd>
        <dt>Canonical</dt><dd>${esc(DATA.meta.canonical) || '–'}</dd>
        <dt>Sprache</dt><dd>${esc(DATA.meta.lang) || '–'}${DATA.meta.hreflang ? ` · ${DATA.meta.hreflang} hreflang` : ''}</dd>
        <dt>Robots</dt><dd>${esc(DATA.meta.robots) || '–'}${DATA.crawl.xRobots ? ` · X-Robots: ${esc(DATA.crawl.xRobots)}` : ''}</dd>
        <dt>OG-Bild</dt><dd>${DATA.meta.ogImage ? '✓' : '–'}</dd>
      </dl>`;
  },

  crawler() {
    const kindLabel = { search: 'Suche', user: 'Nutzer-Abruf', training: 'Training' };
    return `
      ${checksFor('crawler')}
      <h2>robots.txt für diese URL</h2>
      <p class="hint">${DATA.crawl.robotsTxt.found ? 'robots.txt gefunden' : `Keine robots.txt (Status ${esc(DATA.crawl.robotsTxt.status)}), alles erlaubt`}${DATA.crawl.robotsTxt.sitemaps.length ? ` · ${DATA.crawl.robotsTxt.sitemaps.length} Sitemap(s)` : ''}</p>
      <table>
        <tr><th>Bot</th><th>Zweck</th><th>Status</th></tr>
        ${DATA.crawl.bots.map((b) => `<tr>
          <td><b>${esc(b.name)}</b><div class="sub">${esc(b.vendor)}</div></td>
          <td>${kindLabel[b.kind]}</td>
          <td>${badge(b.allowed ? 'pass' : b.kind === 'training' ? 'info' : 'fail').replace(/>(OK|Fehlt|Info)</, `>${b.allowed ? 'Erlaubt' : 'Blockiert'}<`)}
            <div class="sub">${esc(b.rule || b.via)}</div></td>
        </tr>`).join('')}
      </table>
      <h2>llms.txt</h2>
      ${DATA.crawl.llms.found ? `<pre>${esc(DATA.crawl.llms.preview)}</pre>` : '<p class="hint">Nicht vorhanden. Eine llms.txt fasst die wichtigsten Seiten in Markdown für Sprachmodelle zusammen.</p>'}`;
  },

  structure() {
    const c = DATA.content;
    return `
      <div class="stats">
        <div class="stat"><b>${c.wordCount}</b><span>Wörter</span></div>
        <div class="stat"><b>${DATA.headings.length}</b><span>Titel</span></div>
        <div class="stat"><b>${c.lists}</b><span>Listen</span></div>
        <div class="stat"><b>${c.tables}</b><span>Tabellen</span></div>
      </div>
      ${checksFor('structure')}
      <h2>Überschriften</h2>
      <div class="hlist">
        ${DATA.headings.map((h) => `<div class="h" style="padding-left:${(h.level - 1) * 12}px"><span class="tag">H${h.level}</span><span>${esc(h.text)}</span>${h.question ? '<span class="q">? Frage</span>' : ''}</div>`).join('') || '<div class="empty">Keine Überschriften</div>'}
      </div>`;
  },

  citability() {
    const top = DATA.passages.slice(0, 8);
    const weak = DATA.passages.filter((p) => p.score < 50).length;
    return `
      ${checksFor('citability')}
      <h2>Beste Passagen (so würde eine KI zitieren)</h2>
      <p class="hint">${DATA.passages.length} Absätze bewertet, ${weak} davon schwach (&lt; 50).</p>
      ${top.map((p) => `<div class="passage" style="border-left-color:${color(p.score)}">
        <div class="head"><span>${p.words} Wörter</span><b style="color:${color(p.score)}">${p.score}/100</b></div>
        <p>${esc(p.text.length > 420 ? p.text.slice(0, 420) + ' …' : p.text)}</p>
        <div class="why">${p.why.map((w) => `<span class="pill">${esc(w)}</span>`).join('')}</div>
      </div>`).join('') || '<div class="empty">Keine Absätze gefunden</div>'}
      ${DATA.content.statExamples.length ? `<h2>Gefundene Zahlen</h2>${DATA.content.statExamples.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}` : ''}
      <h2>Externe Quellen (${DATA.links.outboundHosts.length} Domains)</h2>
      ${DATA.links.outboundHosts.map((h) => `<span class="pill">${esc(h)}</span>`).join('') || '<p class="hint">Keine externen Links im Hauptinhalt.</p>'}`;
  },

  schema() {
    return `
      ${checksFor('schema')}
      <h2>Typen</h2>
      ${DATA.schema.types.map((t) => `<span class="pill">${esc(t)}</span>`).join('') || '<p class="hint">Keine</p>'}
      ${DATA.schema.sameAs.length ? `<h2>sameAs</h2><table>${DATA.schema.sameAs.map((s) => `<tr><td>${esc(s)}</td></tr>`).join('')}</table>` : ''}
      ${DATA.schema.count ? `<h2>JSON-LD</h2><pre>${esc(DATA.schema.raw)}</pre>` : ''}`;
  },

  trust() {
    const e = DATA.eeat;
    return `
      ${checksFor('trust')}
      <h2>Signale</h2>
      <dl class="kv">
        <dt>Autor:in</dt><dd>${esc(e.author) || '–'}</dd>
        <dt>Veröffentlicht</dt><dd>${e.published ? esc(fmtDate(e.published)) : '–'}</dd>
        <dt>Aktualisiert</dt><dd>${e.modified ? esc(fmtDate(e.modified)) : '–'}</dd>
        <dt>Last-Modified</dt><dd>${esc(e.lastModifiedHeader) || '–'}</dd>
        <dt>Datenschutz</dt><dd>${DATA.trustPages.privacy ? '✓ verlinkt' : '–'}</dd>
        <dt>Zitate</dt><dd>${DATA.content.quotes} (blockquote/cite)</dd>
        <dt>Bilder mit Alt</dt><dd>${DATA.images.withAlt}/${DATA.images.total}</dd>
      </dl>
      ${DATA.links.authority.length ? `<h2>Autoritative Quellen</h2><table>${DATA.links.authority.map((a) => `<tr><td>${esc(a.host)}<div class="sub">${esc(a.text)}</div></td></tr>`).join('')}</table>` : ''}`;
  },

  tools() {
    const host = new URL(DATA.meta.url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    let brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (/^(co|com|org|net|ac|gov)$/.test(brand) && parts.length >= 3) brand = parts[parts.length - 3];
    const enc = encodeURIComponent;
    const u = DATA.meta.url;
    return `
      <h2>Prompt in KI-Suchen testen</h2>
      <textarea id="prompt" placeholder="z. B. Welche Anbieter für … in Zürich empfiehlst du?">Was weisst du über ${esc(brand)} (${esc(host)})? Nenne deine Quellen.</textarea>
      <div class="tool-grid" id="engines">
        <button data-engine="chatgpt">ChatGPT<small>chatgpt.com</small></button>
        <button data-engine="perplexity">Perplexity<small>perplexity.ai</small></button>
        <button data-engine="claude">Claude<small>claude.ai</small></button>
        <button data-engine="gaimode">Google AI Mode<small>google.com</small></button>
        <button data-engine="copilot">Copilot<small>copilot.microsoft.com</small></button>
        <button data-engine="all">Alle öffnen<small>5 Tabs</small></button>
      </div>
      <p class="hint">Prüfe, ob ${esc(host)} genannt oder als Quelle verlinkt wird.</p>
      <h2>Validatoren</h2>
      <div class="tool-grid">
        <a target="_blank" href="https://search.google.com/test/rich-results?url=${enc(u)}">Rich Results Test<small>Google</small></a>
        <a target="_blank" href="https://validator.schema.org/#url=${enc(u)}">Schema Validator<small>schema.org</small></a>
        <a target="_blank" href="https://pagespeed.web.dev/analysis?url=${enc(u)}">PageSpeed Insights<small>Google</small></a>
        <a target="_blank" href="${esc(new URL('/robots.txt', u).href)}">robots.txt öffnen<small>${esc(host)}</small></a>
        <a target="_blank" href="${esc(new URL('/llms.txt', u).href)}">llms.txt öffnen<small>${esc(host)}</small></a>
        <a target="_blank" href="https://www.google.com/search?q=${enc('"' + brand + '" -site:' + host)}">Markenerwähnungen<small>Google, ohne eigene Domain</small></a>
        <a target="_blank" href="https://www.reddit.com/search/?q=${enc(brand)}">Reddit-Erwähnungen<small>reddit.com</small></a>
        <a target="_blank" href="https://www.wikidata.org/w/index.php?search=${enc(brand)}">Wikidata-Eintrag<small>wikidata.org</small></a>
      </div>`;
  },
};

const ENGINES = {
  chatgpt: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}&hints=search`,
  perplexity: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
  claude: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  gaimode: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50`,
  copilot: (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}`,
};

function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
  if (!DATA) return;
  view.innerHTML = renderers[currentTab]();
  view.scrollTop = 0;
}

function markTabs() {
  const worst = {};
  RESULT.checks.forEach((c) => {
    const t = CATS[c.cat].tab;
    const rank = { fail: 2, warn: 1 }[c.status] || 0;
    worst[t] = Math.max(worst[t] || 0, rank);
  });
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.querySelector('.dot')?.remove();
    const w = worst[b.dataset.tab];
    if (w && b.dataset.tab !== 'overview') {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = w === 2 ? 'var(--fail)' : 'var(--warn)';
      b.appendChild(dot);
    }
  });
}

// ---------------- Events ----------------
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  currentTab = b.dataset.tab;
  render();
});
view.addEventListener('click', (e) => {
  const cat = e.target.closest('[data-go]');
  if (cat) { currentTab = cat.dataset.go; render(); return; }
  const eng = e.target.closest('[data-engine]');
  if (eng) {
    const q = document.getElementById('prompt').value.trim();
    if (!q) return;
    const list = eng.dataset.engine === 'all' ? Object.keys(ENGINES) : [eng.dataset.engine];
    list.forEach((k, i) => chrome.tabs.create({ url: ENGINES[k](q), active: i === list.length - 1 }));
  }
});

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

function toMarkdown() {
  const lines = [`# GEO-Report: ${DATA.meta.title}`, '', `URL: ${DATA.meta.url}`, `Datum: ${new Date(DATA.analyzedAt).toLocaleString('de-CH')}`, `**GEO-Score: ${RESULT.total}/100** (${grade(RESULT.total)})`, ''];
  for (const [k, c] of Object.entries(RESULT.cats)) {
    lines.push(`## ${CATS[k].label} (${Math.round(c.got)}/${c.max})`);
    RESULT.checks.filter((x) => x.cat === k).forEach((x) => {
      const icon = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' }[x.status];
      lines.push(`- ${icon} **${x.label}**: ${x.detail}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

document.getElementById('btn-copy').addEventListener('click', async () => {
  if (!DATA) return;
  await navigator.clipboard.writeText(toMarkdown());
  toast('Report kopiert');
});
document.getElementById('btn-json').addEventListener('click', () => {
  if (!DATA) return;
  const blob = new Blob([JSON.stringify({ score: RESULT, data: DATA }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `geo-report-${new URL(DATA.meta.url).hostname}.json`;
  a.click();
});
document.getElementById('btn-reload').addEventListener('click', run);
document.getElementById('btn-pdf').addEventListener('click', async () => {
  if (!DATA) return;
  await saveReportData(DATA);
  chrome.tabs.create({ url: chrome.runtime.getURL('report.html?print=1') });
});


// Report-Daten ablegen: chrome.storage.session, sonst localStorage (gleicher Extension-Origin)
async function saveReportData(data) {
  try {
    if (chrome.storage?.session) { await chrome.storage.session.set({ geoReport: data }); return; }
  } catch (e) { /* Fallback unten */ }
  try { localStorage.setItem('geoReport', JSON.stringify(data)); } catch (e) { /* ignorieren */ }
}

// ---------------- Start ----------------
async function run() {
  view.innerHTML = '<div class="loading">Seite wird analysiert …</div>';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/.test(tab.url || '')) {
      view.innerHTML = '<div class="error">16NOV funktioniert nur auf normalen Webseiten (http/https).</div>';
      return;
    }
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: geoAnalyze });
    if (!res || !res.result) throw new Error('Keine Daten von der Seite erhalten.');
    DATA = res.result;
    RESULT = evaluate(DATA);
    // Report-Daten sofort im Hintergrund bereitlegen
    saveReportData(DATA);
    markTabs();
    render();
  } catch (err) {
    view.innerHTML = `<div class="error">Analyse fehlgeschlagen: ${esc(err.message)}</div>`;
  }
}
run();
