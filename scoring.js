/* Gemeinsame Bewertung für Popup und Report */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = (status) => `<span class="badge ${status}">${{ pass: 'OK', warn: 'Prüfen', fail: 'Fehlt', info: 'Info' }[status]}</span>`;
const color = (pct) => (pct >= 75 ? 'var(--pass)' : pct >= 50 ? 'var(--warn)' : 'var(--fail)');


const CATS = {
  crawler: { label: 'KI-Crawler', tab: 'crawler' },
  structure: { label: 'Struktur', tab: 'structure' },
  citability: { label: 'Zitierbarkeit', tab: 'citability' },
  schema: { label: 'Schema', tab: 'schema' },
  trust: { label: 'Vertrauen', tab: 'trust' },
  tech: { label: 'Technik', tab: 'overview' },
};

// ---------------- Scoring ----------------
function evaluate(d) {
  const checks = [];
  const add = (cat, weight, status, label, detail) => checks.push({ cat, weight, status, label, detail });

  // KI-Crawler (20)
  const searchBots = d.crawl.bots.filter((b) => b.kind !== 'training');
  const blockedSearch = searchBots.filter((b) => !b.allowed);
  add('crawler', 10, blockedSearch.length === 0 ? 'pass' : blockedSearch.length <= 2 ? 'warn' : 'fail',
    'Such- und Nutzer-Bots dürfen die Seite lesen',
    blockedSearch.length ? `Blockiert: ${blockedSearch.map((b) => b.name).join(', ')}` : 'Alle KI-Suchbots (ChatGPT, Claude, Perplexity, Google, Bing) erlaubt');
  const blockedTraining = d.crawl.bots.filter((b) => b.kind === 'training' && !b.allowed);
  add('crawler', 2, blockedTraining.length ? 'info' : 'pass', 'Trainings-Crawler',
    blockedTraining.length ? `Blockiert: ${blockedTraining.map((b) => b.name).join(', ')}. Bewusste Entscheidung, beeinflusst KI-Suche kaum.` : 'Keine Trainings-Crawler blockiert');
  add('crawler', 3, d.crawl.llms.found ? 'pass' : 'warn', 'llms.txt vorhanden',
    d.crawl.llms.found ? `${d.crawl.llms.size} Zeichen${d.crawl.llmsFull.found ? ', llms-full.txt ebenfalls vorhanden' : ''}` : 'Keine /llms.txt gefunden (optionaler, aufkommender Standard)');
  const robots = (d.meta.robots + ' ' + d.crawl.xRobots).toLowerCase();
  const badRobots = ['noindex', 'nosnippet', 'noai', 'max-snippet:0'].filter((k) => robots.includes(k));
  add('crawler', 5, badRobots.length ? 'fail' : 'pass', 'Keine sperrenden Meta-Robots',
    badRobots.length ? `Gefunden: ${badRobots.join(', ')}. Verhindert Snippets bzw. Zitate in AI Overviews.` : (robots.trim() ? `robots: ${robots.trim()}` : 'Keine Einschränkungen'));

  // Struktur (20)
  const h1 = d.headings.filter((h) => h.level === 1).length;
  add('structure', 4, h1 === 1 ? 'pass' : h1 === 0 ? 'fail' : 'warn', 'Genau eine H1', `${h1} H1 gefunden`);
  add('structure', 3, d.headingSkips === 0 ? 'pass' : 'warn', 'Saubere Überschriften-Hierarchie',
    d.headingSkips ? `${d.headingSkips} Sprünge (z. B. H2 → H4)` : 'Keine Ebenen übersprungen');
  const qh = d.headings.filter((h) => h.question && h.level > 1).length;
  add('structure', 4, qh >= 3 ? 'pass' : qh >= 1 ? 'warn' : 'fail', 'Fragen als Zwischentitel',
    `${qh} Überschriften als Frage formuliert. KI-Systeme matchen Prompts gern auf Frage-Antwort-Blöcke.`);
  const structEls = d.content.lists + d.content.tables;
  add('structure', 3, structEls >= 2 ? 'pass' : structEls === 1 ? 'warn' : 'fail', 'Listen und Tabellen',
    `${d.content.lists} Listen, ${d.content.tables} Tabellen`);
  add('structure', 3, d.content.avgParagraphWords && d.content.avgParagraphWords <= 80 ? 'pass' : d.content.avgParagraphWords <= 120 ? 'warn' : 'fail',
    'Kurze, scanbare Absätze', `Ø ${d.content.avgParagraphWords} Wörter pro Absatz (Ziel ≤ 80)`);
  add('structure', 3, d.content.wordCount >= 500 ? 'pass' : d.content.wordCount >= 250 ? 'warn' : 'fail',
    'Genug Substanz', `${d.content.wordCount} Wörter im Hauptinhalt`);

  // Zitierbarkeit (20)
  const strong = d.passages.filter((p) => p.score >= 70).length;
  add('citability', 8, strong >= 3 ? 'pass' : strong >= 1 ? 'warn' : 'fail', 'Zitierfähige Passagen',
    `${strong} Absätze mit Score ≥ 70 (eigenständig, 40–150 Wörter, mit Fakten)`);
  add('citability', 5, d.content.stats >= 5 ? 'pass' : d.content.stats >= 2 ? 'warn' : 'fail', 'Zahlen und Statistiken',
    `${d.content.stats} konkrete Werte gefunden`);
  add('citability', 4, d.links.outboundHosts.length >= 3 ? 'pass' : d.links.outboundHosts.length >= 1 ? 'warn' : 'fail', 'Externe Quellen verlinkt',
    `${d.links.outboundHosts.length} externe Domains, davon ${d.links.authority.length} Links auf Behörden/Wissenschaft/Wikipedia`);
  const fp = d.content.firstParagraph;
  add('citability', 3, fp && fp.words >= 25 && fp.words <= 120 ? 'pass' : fp ? 'warn' : 'fail', 'Antwort zuerst (erster Absatz)',
    fp ? `Erster Absatz: ${fp.words} Wörter. Ideal ist eine direkte Antwort in 25–120 Wörtern.` : 'Kein Einleitungsabsatz gefunden');

  // Schema (15)
  const types = d.schema.types;
  add('schema', 5, d.schema.count > 0 && !d.schema.errors.length ? 'pass' : d.schema.count > 0 || types.length ? 'warn' : 'fail', 'Strukturierte Daten (JSON-LD)',
    d.schema.errors.length ? d.schema.errors.join('; ') : d.schema.count ? `${d.schema.count} JSON-LD Blöcke` : types.length ? 'Nur Microdata gefunden' : 'Keine strukturierten Daten');
  const entity = types.some((t) => /^(Organization|LocalBusiness|Corporation|Person|.*Store|Restaurant|.*Business)$/i.test(t));
  add('schema', 4, entity && d.schema.sameAs.length ? 'pass' : entity ? 'warn' : 'fail', 'Entität mit sameAs',
    entity ? `${d.schema.sameAs.length} sameAs-Verweise (Wikipedia, LinkedIn, Wikidata …) verknüpfen die Marke im Knowledge Graph` : 'Kein Organization/Person-Schema');
  const contentType = types.find((t) => /^(Article|NewsArticle|BlogPosting|TechArticle|FAQPage|HowTo|Product|Service|Recipe|Event|Course|QAPage|WebPage|AboutPage|CollectionPage)$/i.test(t));
  add('schema', 4, contentType && !/^WebPage$/i.test(contentType) ? 'pass' : contentType ? 'warn' : 'fail', 'Inhaltstyp ausgezeichnet',
    contentType ? `Typ: ${types.filter((t) => /Article|Posting|FAQ|HowTo|Product|Service|Recipe|Event|Course|QA|Page/.test(t)).join(', ')}` : 'Kein Article/FAQPage/Product/… Schema');
  add('schema', 2, types.includes('BreadcrumbList') ? 'pass' : 'warn', 'BreadcrumbList', types.includes('BreadcrumbList') ? 'Vorhanden' : 'Fehlt');

  // Vertrauen (15)
  add('trust', 5, d.eeat.author ? 'pass' : 'fail', 'Autor:in erkennbar', d.eeat.author || 'Kein Autor in Schema, Meta oder Byline');
  const date = d.eeat.modified || d.eeat.published || d.eeat.lastModifiedHeader;
  add('trust', 4, d.eeat.published || d.eeat.modified ? 'pass' : 'fail', 'Datum ausgezeichnet',
    [d.eeat.published && `Veröffentlicht: ${fmtDate(d.eeat.published)}`, d.eeat.modified && `Aktualisiert: ${fmtDate(d.eeat.modified)}`].filter(Boolean).join(' · ') || 'Kein datePublished/dateModified');
  const ageDays = date ? Math.round((Date.now() - new Date(date).getTime()) / 864e5) : null;
  add('trust', 3, ageDays !== null && !isNaN(ageDays) ? (ageDays <= 365 ? 'pass' : ageDays <= 730 ? 'warn' : 'fail') : 'warn', 'Aktualität',
    ageDays !== null && !isNaN(ageDays) ? `Letzte Änderung vor ${ageDays} Tagen` : 'Alter unbekannt');
  const tp = d.trustPages;
  const tpCount = [tp.about, tp.contact, tp.imprint].filter(Boolean).length;
  add('trust', 3, tpCount === 3 ? 'pass' : tpCount >= 1 ? 'warn' : 'fail', 'Über uns, Kontakt, Impressum verlinkt',
    `Über uns ${tp.about ? '✓' : '✗'} · Kontakt ${tp.contact ? '✓' : '✗'} · Impressum ${tp.imprint ? '✓' : '✗'}`);

  // Technik (10)
  const ratio = d.content.rawWordCount !== null && d.content.wordCount ? d.content.rawWordCount / d.content.wordCount : null;
  add('tech', 6, ratio === null ? 'warn' : ratio >= 0.7 ? 'pass' : ratio >= 0.3 ? 'warn' : 'fail', 'Inhalt ohne JavaScript lesbar',
    ratio === null ? 'Roh-HTML konnte nicht geladen werden' : `${Math.min(100, Math.round(ratio * 100))} % des Texts stehen schon im HTML. Die meisten KI-Crawler führen kein JavaScript aus.`);
  add('tech', 2, d.meta.description ? 'pass' : 'warn', 'Meta Description', d.meta.description ? `${d.meta.description.length} Zeichen` : 'Fehlt');
  add('tech', 2, d.meta.lang && d.meta.canonical ? 'pass' : 'warn', 'Sprache und Canonical',
    `lang="${d.meta.lang || '–'}" · Canonical ${d.meta.canonical ? '✓' : '✗'}`);

  const factor = { pass: 1, warn: 0.5, fail: 0, info: 1 };
  const cats = {};
  for (const c of checks) {
    cats[c.cat] ??= { got: 0, max: 0 };
    cats[c.cat].got += c.weight * factor[c.status];
    cats[c.cat].max += c.weight;
  }
  const total = Math.round(Object.values(cats).reduce((s, c) => s + c.got, 0));
  return { checks, cats, total };
}

function fmtDate(s) {
  const dt = new Date(s);
  return isNaN(dt) ? s : dt.toLocaleDateString('de-CH');
}
function grade(n) {
  if (n >= 85) return 'Sehr gut zitierbar';
  if (n >= 70) return 'Gut, mit Potenzial';
  if (n >= 50) return 'Mittel';
  return 'Schwach für KI-Suche';
}

