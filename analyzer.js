// Wird per chrome.scripting.executeScript in die aktive Seite injiziert.
// Muss vollständig in sich geschlossen sein (keine Referenzen nach aussen).
async function geoAnalyze() {
  const doc = document;
  const loc = location;
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const countWords = (s) => (clean(s).match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length;
  const meta = (n) =>
    doc.querySelector(`meta[name="${n}" i]`)?.getAttribute('content') ||
    doc.querySelector(`meta[property="${n}" i]`)?.getAttribute('content') || '';

  // ---------- Meta ----------
  const robotsMeta = [meta('robots'), meta('googlebot')].filter(Boolean).join(', ').toLowerCase();
  const metaInfo = {
    url: loc.href,
    title: clean(doc.title),
    description: meta('description'),
    canonical: doc.querySelector('link[rel="canonical"]')?.href || '',
    lang: doc.documentElement.getAttribute('lang') || '',
    hreflang: doc.querySelectorAll('link[rel="alternate"][hreflang]').length,
    robots: robotsMeta,
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
    ogImage: meta('og:image'),
  };

  // ---------- Hauptinhalt ----------
  const main =
    doc.querySelector('main') ||
    doc.querySelector('article') ||
    doc.querySelector('[role="main"]') ||
    doc.body;
  const mainText = main.innerText || '';
  const wordCount = countWords(mainText);

  // ---------- Überschriften ----------
  const qRe = /^(wie|was|warum|wieso|weshalb|wann|wo|wer|welche[rsmn]?|wozu|kann|ist|sind|gibt|soll|how|what|why|when|where|who|which|can|is|are|does|do|should|will)\b/i;
  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((h) => h.offsetParent !== null || h.getClientRects().length)
    .map((h) => {
      const text = clean(h.innerText);
      return {
        level: Number(h.tagName[1]),
        text,
        question: /\?\s*$/.test(text) || qRe.test(text),
      };
    })
    .filter((h) => h.text);
  let skips = 0;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) skips++;
  }

  // ---------- Absätze & Passagen ----------
  const pronounStart = /^(dies|diese[rsmn]?|das|es|sie|er|dort|damit|dabei|darum|deshalb|aber|jedoch|this|that|these|those|it|they|he|she|there|however|but|also)\b/i;
  const defRe = /\b(ist|sind|bezeichnet|bedeutet|versteht man|definiert|is|are|refers to|means|is defined as)\b/i;
  const numRe = /(\d+[.,]?\d*\s?(%|prozent|percent|chf|eur|€|\$|usd|mio|mrd|million|billion|kg|km|stunden|jahre|tage)|\b(19|20)\d{2}\b|\b\d{2,}[.,']?\d*\b)/i;
  const host = loc.hostname.replace(/^www\./, '');
  // Textblöcke: <p> plus "Blatt"-Container (div/li/…) ohne weitere Block-Kinder,
  // damit auch Seiten erfasst werden, die Fliesstext nicht in <p> setzen.
  const blockSel = 'p,div,section,article,ul,ol,li,table,h1,h2,h3,h4,h5,h6,blockquote,dl,dd,header,footer,nav,aside,form';
  const paragraphs = [...main.querySelectorAll('p, li, dd, blockquote, div')]
    .filter((el) => el.tagName === 'P' || !el.querySelector(blockSel))
    .filter((el) => !el.closest('nav, header, footer, aside, form, [role="navigation"]') && (el.offsetParent !== null || el.getClientRects().length))
    .map((p) => {
      const text = clean(p.innerText);
      const w = countWords(text);
      const hasLink = [...p.querySelectorAll('a[href]')].some((a) => {
        try { return new URL(a.href).hostname.replace(/^www\./, '') !== host; } catch { return false; }
      });
      return { text, words: w, hasLink };
    })
    .filter((p) => p.words >= 12);

  const passages = paragraphs.map((p) => {
    let score = 0;
    const why = [];
    if (p.words >= 40 && p.words <= 150) { score += 35; why.push('ideale Länge'); }
    else if (p.words >= 25 && p.words <= 220) { score += 20; why.push('ok Länge'); }
    else score += 5;
    if (numRe.test(p.text)) { score += 20; why.push('Zahl/Fakt'); }
    const firstSentence = p.text.split(/(?<=[.!?])\s/)[0] || '';
    if (defRe.test(firstSentence)) { score += 15; why.push('Definition'); }
    if (!pronounStart.test(p.text)) { score += 15; why.push('eigenständig'); }
    else why.push('beginnt mit Verweiswort');
    if (p.hasLink) { score += 15; why.push('Quelle verlinkt'); }
    return { text: p.text, words: p.words, score, why };
  });
  const avgParagraphWords = paragraphs.length
    ? Math.round(paragraphs.reduce((s, p) => s + p.words, 0) / paragraphs.length)
    : 0;
  const firstParagraph = paragraphs[0] || null;

  const statMatches = mainText.match(/\d+[.,]?\d*\s?(%|prozent|percent)|\b\d{1,3}(['’.,]\d{3})+\b|\b\d+[.,]\d+\b/gi) || [];

  // ---------- Struktur-Elemente ----------
  const lists = main.querySelectorAll('ul,ol').length;
  const tables = main.querySelectorAll('table').length;
  const faqBlocks = main.querySelectorAll('details, dl').length;
  const quotes = main.querySelectorAll('blockquote, q, cite').length;

  // ---------- Links ----------
  const authorityRe = /(\.gov|\.edu|\.admin\.ch|\.europa\.eu|wikipedia\.org|doi\.org|who\.int|oecd\.org|bfs\.admin\.ch|nature\.com|sciencedirect\.com|ncbi\.nlm\.nih\.gov|statista\.com)$/i;
  const outbound = [];
  let internal = 0;
  main.querySelectorAll('a[href]').forEach((a) => {
    let u;
    try { u = new URL(a.href); } catch { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    const h = u.hostname.replace(/^www\./, '');
    if (h === host) internal++;
    else outbound.push({ host: h, href: u.href, text: clean(a.innerText).slice(0, 80), authority: authorityRe.test(h) });
  });
  const outboundHosts = [...new Set(outbound.map((o) => o.host))];

  const allLinksText = [...doc.querySelectorAll('a[href]')].map((a) => (clean(a.innerText) + ' ' + a.getAttribute('href')).toLowerCase());
  const trustPages = {
    about: allLinksText.some((t) => /über uns|ueber-uns|about|team|wir sind/.test(t)),
    contact: allLinksText.some((t) => /kontakt|contact/.test(t)),
    imprint: allLinksText.some((t) => /impressum|imprint|legal notice/.test(t)),
    privacy: allLinksText.some((t) => /datenschutz|privacy/.test(t)),
  };

  // ---------- Strukturierte Daten ----------
  const schemaTypes = new Set();
  const schemaErrors = [];
  const sameAs = new Set();
  let schemaAuthor = '';
  let schemaPublished = '';
  let schemaModified = '';
  const rawSchemas = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const t = node['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach((x) => schemaTypes.add(String(x)));
    if (node.sameAs) (Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs]).forEach((s) => sameAs.add(s));
    if (node.author && !schemaAuthor) {
      const a = Array.isArray(node.author) ? node.author[0] : node.author;
      schemaAuthor = typeof a === 'string' ? a : a?.name || '';
    }
    if (node.datePublished && !schemaPublished) schemaPublished = node.datePublished;
    if (node.dateModified && !schemaModified) schemaModified = node.dateModified;
    Object.values(node).forEach((v) => typeof v === 'object' && walk(v));
  };
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s, i) => {
    try {
      const data = JSON.parse(s.textContent);
      rawSchemas.push(data);
      walk(data);
    } catch (e) {
      schemaErrors.push(`JSON-LD Block ${i + 1}: ${e.message}`);
    }
  });
  const microdata = [...doc.querySelectorAll('[itemtype]')].map((el) => el.getAttribute('itemtype').split('/').pop());
  microdata.forEach((t) => schemaTypes.add(t));

  // ---------- Autor & Datum ----------
  const bylineEl = doc.querySelector('[rel="author"], [itemprop="author"], .author, .byline, [class*="author" i]');
  const author = schemaAuthor || meta('author') || meta('article:author') || (bylineEl ? clean(bylineEl.innerText).slice(0, 80) : '');
  const published = schemaPublished || meta('article:published_time') || doc.querySelector('time[datetime]')?.getAttribute('datetime') || '';
  const modified = schemaModified || meta('article:modified_time') || meta('og:updated_time') || '';

  // ---------- Bilder ----------
  const imgs = [...main.querySelectorAll('img')].filter((i) => i.naturalWidth > 40 || i.width > 40);
  const imgsWithAlt = imgs.filter((i) => clean(i.getAttribute('alt'))).length;

  // ---------- Roh-HTML vs. gerendert (KI-Crawler rendern meist kein JS) ----------
  let rawWordCount = null;
  let xRobots = '';
  let lastModifiedHeader = '';
  try {
    const res = await fetch(loc.href, { credentials: 'include', cache: 'no-store' });
    xRobots = res.headers.get('x-robots-tag') || '';
    lastModifiedHeader = res.headers.get('last-modified') || '';
    const html = await res.text();
    const rawDoc = new DOMParser().parseFromString(html, 'text/html');
    rawDoc.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());
    const rawMain = rawDoc.querySelector('main') || rawDoc.querySelector('article') || rawDoc.querySelector('[role="main"]') || rawDoc.body;
    rawWordCount = rawMain ? countWords(rawMain.textContent) : 0;
  } catch (e) { /* ignorieren */ }

  // ---------- robots.txt ----------
  const bots = [
    { name: 'OAI-SearchBot', vendor: 'OpenAI', kind: 'search' },
    { name: 'ChatGPT-User', vendor: 'OpenAI', kind: 'user' },
    { name: 'GPTBot', vendor: 'OpenAI', kind: 'training' },
    { name: 'Claude-SearchBot', vendor: 'Anthropic', kind: 'search' },
    { name: 'Claude-User', vendor: 'Anthropic', kind: 'user' },
    { name: 'ClaudeBot', vendor: 'Anthropic', kind: 'training' },
    { name: 'PerplexityBot', vendor: 'Perplexity', kind: 'search' },
    { name: 'Perplexity-User', vendor: 'Perplexity', kind: 'user' },
    { name: 'Googlebot', vendor: 'Google', kind: 'search' },
    { name: 'Google-Extended', vendor: 'Google', kind: 'training' },
    { name: 'Bingbot', vendor: 'Microsoft', kind: 'search' },
    { name: 'Applebot', vendor: 'Apple', kind: 'search' },
    { name: 'Applebot-Extended', vendor: 'Apple', kind: 'training' },
    { name: 'Meta-ExternalAgent', vendor: 'Meta', kind: 'training' },
    { name: 'Amazonbot', vendor: 'Amazon', kind: 'search' },
    { name: 'CCBot', vendor: 'Common Crawl', kind: 'training' },
    { name: 'Bytespider', vendor: 'ByteDance', kind: 'training' },
    { name: 'cohere-ai', vendor: 'Cohere', kind: 'training' },
  ];
  let robotsTxt = { status: null, text: '', sitemaps: [] };
  try {
    const r = await fetch(loc.origin + '/robots.txt', { cache: 'no-store', redirect: 'follow' });
    robotsTxt.status = r.status;
    const ct = r.headers.get('content-type') || '';
    if (r.ok && !/html/i.test(ct)) robotsTxt.text = await r.text();
  } catch (e) { robotsTxt.status = 'Fehler'; }

  const groups = [];
  {
    let cur = null;
    let lastWasUA = false;
    robotsTxt.text.split(/\r?\n/).forEach((line) => {
      const l = line.replace(/#.*/, '').trim();
      const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) return;
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === 'user-agent') {
        if (!lastWasUA || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
        cur.agents.push(val.toLowerCase());
        lastWasUA = true;
      } else if (key === 'allow' || key === 'disallow') {
        if (cur) cur.rules.push({ allow: key === 'allow', path: val });
        lastWasUA = false;
      } else if (key === 'sitemap') {
        robotsTxt.sitemaps.push(val);
      } else {
        lastWasUA = false;
      }
    });
  }
  const path = loc.pathname + loc.search;
  const ruleMatches = (pattern, p) => {
    if (pattern === '') return false;
    // '*' = Wildcard, abschliessendes '$' = Ende-Anker (bleibt unescaped)
    const esc = pattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + esc).test(p);
  };
  const botResults = bots.map((b) => {
    const token = b.name.toLowerCase();
    let matched = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
    let via = b.name;
    if (!matched.length) { matched = groups.filter((g) => g.agents.includes('*')); via = '*'; }
    if (!matched.length) return { ...b, allowed: true, via: 'keine Regel', rule: '' };
    const rules = matched.flatMap((g) => g.rules);
    let best = null;
    rules.forEach((r) => {
      if (!ruleMatches(r.path, path)) return;
      const len = r.path.length;
      if (!best || len > best.path.length || (len === best.path.length && r.allow)) best = r;
    });
    return {
      ...b,
      allowed: !best || best.allow,
      via,
      rule: best ? `${best.allow ? 'Allow' : 'Disallow'}: ${best.path}` : '',
    };
  });

  // ---------- llms.txt ----------
  const fetchTextFile = async (p) => {
    try {
      const r = await fetch(loc.origin + p, { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || /html/i.test(ct)) return { found: false, status: r.status };
      const t = await r.text();
      return { found: true, status: r.status, size: t.length, preview: t.slice(0, 800) };
    } catch (e) { return { found: false, status: 'Fehler' }; }
  };
  const [llms, llmsFull] = await Promise.all([fetchTextFile('/llms.txt'), fetchTextFile('/llms-full.txt')]);

  return {
    meta: metaInfo,
    content: {
      wordCount,
      rawWordCount,
      paragraphs: paragraphs.length,
      avgParagraphWords,
      firstParagraph,
      lists,
      tables,
      faqBlocks,
      quotes,
      stats: statMatches.length,
      statExamples: [...new Set(statMatches)].slice(0, 8),
    },
    headings,
    headingSkips: skips,
    passages: passages.sort((a, b) => b.score - a.score),
    links: {
      internal,
      outboundCount: outbound.length,
      outboundHosts,
      authority: outbound.filter((o) => o.authority),
      outbound: outbound.slice(0, 40),
    },
    trustPages,
    schema: {
      types: [...schemaTypes],
      errors: schemaErrors,
      sameAs: [...sameAs],
      count: rawSchemas.length,
      raw: JSON.stringify(rawSchemas, null, 2).slice(0, 6000),
    },
    eeat: { author, published, modified, lastModifiedHeader },
    images: { total: imgs.length, withAlt: imgsWithAlt },
    crawl: { xRobots, robotsTxt: { status: robotsTxt.status, sitemaps: robotsTxt.sitemaps, found: !!robotsTxt.text }, bots: botResults, llms, llmsFull },
    analyzedAt: new Date().toISOString(),
  };
}
