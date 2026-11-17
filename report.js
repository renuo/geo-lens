/* global chrome, evaluate, grade, fmtDate, esc, CATS */

// ---------------- Anleitungen pro Prüfpunkt ----------------
// Schlüssel = Label aus scoring.js
const WHO = { dev: 'Entwicklung', content: 'Redaktion', seo: 'SEO / Marketing' };

const GUIDE = {
  'Such- und Nutzer-Bots dürfen die Seite lesen': {
    who: WHO.dev, effort: '15 Min',
    why: 'Wenn ein KI-Suchbot die Seite nicht lesen darf, kann ChatGPT, Claude oder Perplexity sie weder finden noch als Quelle nennen. Das ist der wichtigste Punkt überhaupt.',
    steps: [
      'Die Datei /robots.txt auf dem Server öffnen.',
      'Für die unten genannten Bots einen eigenen Block mit «Allow: /» ergänzen (Vorlage unten).',
      'Prüfen, dass kein allgemeiner «Disallow: /» für «User-agent: *» die Seite sperrt.',
      'Datei speichern und 16NOV erneut laufen lassen.',
    ],
    snippet: (d) => {
      const blocked = d.crawl.bots.filter((b) => b.kind !== 'training' && !b.allowed);
      return { lang: 'robots.txt', code: blocked.map((b) => `User-agent: ${b.name}\nAllow: /`).join('\n\n') };
    },
  },
  'llms.txt vorhanden': {
    who: WHO.seo, effort: '30–60 Min',
    why: 'Die llms.txt ist eine kurze Markdown-Datei im Hauptverzeichnis, die Sprachmodellen sagt, worum es auf der Website geht und welche Seiten wichtig sind. Sie ist noch kein offizieller Standard, schadet aber nicht und ist schnell gemacht.',
    steps: [
      'Vorlage unten kopieren und mit den 5–15 wichtigsten Seiten der Website ergänzen.',
      'Pro Seite eine Zeile: Link plus ein Satz, was dort steht.',
      'Als /llms.txt im Hauptverzeichnis ablegen (Text, nicht HTML).',
    ],
    snippet: (d) => {
      const origin = new URL(d.meta.url).origin;
      const h2 = d.headings.filter((h) => h.level === 2).slice(0, 5);
      return {
        lang: 'llms.txt',
        code: `# ${d.meta.ogTitle || d.meta.title || new URL(d.meta.url).hostname}\n\n> ${d.meta.description || 'Ein Satz, was das Unternehmen anbietet und für wen.'}\n\n## Wichtigste Seiten\n\n- [Startseite](${origin}/): Überblick über das Angebot\n- [${d.meta.title || 'Diese Seite'}](${d.meta.url}): ${h2.map((h) => h.text).join(', ') || 'Kurzbeschreibung'}\n- [Über uns](${origin}/ueber-uns): Wer wir sind\n- [Kontakt](${origin}/kontakt): So erreichst du uns\n\n## Optional\n\n- [Blog](${origin}/blog): Fachartikel`,
      };
    },
  },
  'Keine sperrenden Meta-Robots': {
    who: WHO.dev, effort: '15 Min',
    why: '«noindex» entfernt die Seite aus der Suche, «nosnippet» oder «max-snippet:0» verbieten Textauszüge. Damit kann Google die Seite nicht in AI Overviews zitieren.',
    steps: [
      'Im <head> nach <meta name="robots"> suchen, ausserdem den HTTP-Header X-Robots-Tag prüfen.',
      'Die sperrenden Werte entfernen, ausser die Seite soll bewusst nicht erscheinen.',
    ],
    snippet: () => ({ lang: 'HTML', code: '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">' }),
  },
  'Genau eine H1': {
    who: WHO.content, effort: '15 Min',
    why: 'Die H1 ist der Haupttitel der Seite. KI-Systeme nutzen sie, um das Thema zu erkennen. Keine oder mehrere H1 machen das unklar.',
    steps: [
      'Einen klaren Haupttitel festlegen, der das Thema in 5–10 Wörtern beschreibt.',
      'Genau diesen als H1 auszeichnen, alle anderen Titel als H2 oder tiefer.',
    ],
    extra: (d) => {
      const h1 = d.headings.filter((h) => h.level === 1);
      return h1.length ? `<div class="finding">Aktuelle H1: ${h1.map((h) => `«${esc(h.text)}»`).join(', ')}</div>` : '';
    },
  },
  'Saubere Überschriften-Hierarchie': {
    who: WHO.dev, effort: '30 Min',
    why: 'Überschriften bilden das Inhaltsverzeichnis, aus dem KI-Systeme einzelne Abschnitte herausgreifen. Übersprungene Ebenen (H2 direkt zu H4) machen die Gliederung schwer lesbar.',
    steps: [
      'Im Anhang «Überschriften» die Sprünge suchen.',
      'Ebenen so anpassen, dass auf H2 immer H3 folgt. Wenn es nur ums Aussehen geht, die Grösse per CSS ändern statt die Ebene zu wechseln.',
    ],
  },
  'Fragen als Zwischentitel': {
    who: WHO.content, effort: '1 Std',
    why: 'Menschen stellen KI-Systemen Fragen. Ein Abschnitt, dessen Titel genau diese Frage ist und dessen erster Satz sie beantwortet, wird am ehesten zitiert.',
    steps: [
      'Die 3–5 häufigsten Kundenfragen zum Thema sammeln (Support, Verkauf, Google «Ähnliche Fragen»).',
      'Bestehende Zwischentitel in Fragen umformulieren (Beispiele unten) oder neue Abschnitte ergänzen.',
      'Direkt unter jeder Frage in 1–2 Sätzen antworten, danach Details.',
    ],
    extra: (d) => {
      const h = d.headings.filter((x) => x.level === 2 && !x.question).slice(0, 4);
      if (!h.length) return '';
      return `<div class="label">Diese Titel könnten Fragen werden</div>${h.map((x) => `<div class="example">«${esc(x.text)}» → z. B. «Was ist ${esc(x.text)}?» oder «Wie hilft ${esc(x.text)} bei …?»</div>`).join('')}
        <p class="small muted">Die Vorschläge sind Platzhalter. Am besten echte Kundenfragen verwenden.</p>`;
    },
  },
  'Listen und Tabellen': {
    who: WHO.content, effort: '30–60 Min',
    why: 'KI-Antworten bestehen oft aus Aufzählungen und Vergleichen. Inhalte, die schon als Liste oder Tabelle vorliegen, lassen sich direkt übernehmen.',
    steps: [
      'Aufzählungen im Fliesstext («erstens …, zweitens …») in echte Listen umwandeln.',
      'Vergleiche, Preise, technische Daten oder Schritte als Tabelle bzw. nummerierte Liste darstellen.',
    ],
  },
  'Kurze, scanbare Absätze': {
    who: WHO.content, effort: '1 Std',
    why: 'Lange Absätze vermischen mehrere Aussagen. KI-Systeme zitieren am liebsten einen Block, der genau eine Sache klar sagt.',
    steps: [
      'Absätze über 80 Wörter in zwei oder drei Teile trennen.',
      'Pro Absatz eine Kernaussage, die im ersten Satz steht.',
    ],
    extra: (d) => {
      const long = [...d.passages].sort((a, b) => b.words - a.words).filter((p) => p.words > 100).slice(0, 3);
      return long.length ? `<div class="label">Längste Absätze</div>${long.map((p) => `<div class="example">${p.words} Wörter: «${esc(p.text.slice(0, 140))} …»</div>`).join('')}` : '';
    },
  },
  'Genug Substanz': {
    who: WHO.content, effort: '½–1 Tag',
    why: 'Sehr kurze Seiten liefern zu wenig, das eine KI zitieren könnte. Gemeint ist nicht Füllmaterial, sondern Antworten auf echte Fragen.',
    steps: [
      'Seite um konkrete Inhalte ergänzen: Ablauf, Preise oder Preisrahmen, Beispiele, FAQ.',
      'Ziel: mindestens 500 Wörter Hauptinhalt, gegliedert mit Zwischentiteln.',
    ],
  },
  'Zitierfähige Passagen': {
    who: WHO.content, effort: '1–2 Std',
    why: 'KI-Systeme zitieren einzelne Abschnitte, nicht ganze Seiten. Ein guter Abschnitt ist für sich verständlich, 40–150 Wörter lang und enthält einen Fakt oder eine Definition.',
    steps: [
      'Die schwächsten Passagen unten der Reihe nach überarbeiten.',
      'Nicht mit «Dies», «Es» oder «Damit» beginnen, sondern das Thema beim Namen nennen.',
      'Pro Passage mindestens eine konkrete Zahl, ein Beispiel oder eine klare Definition einbauen.',
      'Wo möglich eine Quelle verlinken.',
    ],
    extra: (d) => {
      const weak = [...d.passages].filter((p) => p.words >= 20).sort((a, b) => a.score - b.score).slice(0, 4);
      return weak.length ? `<div class="label">Zuerst überarbeiten</div>${weak.map((p) => `<div class="example"><b>${p.score}/100</b> · ${esc(p.why.join(', '))}<br>«${esc(p.text.slice(0, 180))}${p.text.length > 180 ? ' …' : ''}»</div>`).join('')}` : '';
    },
  },
  'Zahlen und Statistiken': {
    who: WHO.content, effort: '1 Std',
    why: 'Konkrete Zahlen machen Aussagen überprüfbar. Seiten mit Statistiken werden in KI-Antworten deutlich häufiger als Quelle genannt.',
    steps: [
      'Ungefähre Aussagen durch Zahlen ersetzen («viele Kunden» → «über 300 Kunden seit 2015»).',
      'Eigene Kennzahlen nennen: Jahre, Projekte, Zufriedenheit, Dauer, Preise.',
      'Bei fremden Zahlen die Quelle und das Jahr angeben.',
    ],
  },
  'Externe Quellen verlinkt': {
    who: WHO.content, effort: '30 Min',
    why: 'Links auf seriöse Quellen (Behörden, Studien, Verbände) zeigen, dass die Aussagen belegt sind. Das stärkt das Vertrauen von Menschen und Maschinen.',
    steps: [
      'Für 2–3 zentrale Aussagen eine seriöse Quelle suchen.',
      'Direkt im Text verlinken, nicht nur in einer Liste am Seitenende.',
    ],
  },
  'Antwort zuerst (erster Absatz)': {
    who: WHO.content, effort: '30 Min',
    why: 'Der erste Absatz wird am häufigsten zitiert. Er sollte die Hauptfrage der Seite direkt beantworten: Was ist das, für wen, was ist der Nutzen.',
    steps: [
      'Den ersten Absatz in 25–120 Wörtern als direkte Antwort schreiben.',
      'Muster: «[Thema] ist [Definition]. Es hilft [Zielgruppe], [Nutzen]. [Ein konkreter Fakt].»',
    ],
    extra: (d) => (d.content.firstParagraph ? `<div class="finding">Aktuell: «${esc(d.content.firstParagraph.text.slice(0, 260))}»</div>` : ''),
  },
  'Strukturierte Daten (JSON-LD)': {
    who: WHO.dev, effort: '1 Std',
    why: 'Strukturierte Daten beschreiben die Seite in einer maschinenlesbaren Form: Wer steht dahinter, was ist das für ein Inhalt. Suchmaschinen und KI-Systeme verstehen die Seite so schneller und sicherer.',
    steps: [
      'Vorlage unten anpassen und als <script type="application/ld+json"> in den <head> einfügen.',
      'Mit dem Rich Results Test von Google prüfen (search.google.com/test/rich-results).',
    ],
    snippet: (d) => ({ lang: 'JSON-LD', code: jsonld(orgSchema(d)) }),
    extra: (d) => (d.schema.errors.length ? `<div class="finding">Fehler: ${esc(d.schema.errors.join('; '))}</div>` : ''),
  },
  'Entität mit sameAs': {
    who: WHO.seo, effort: '30 Min',
    why: 'Mit «sameAs» verknüpft man die eigene Website mit Profilen wie LinkedIn, Wikipedia oder Wikidata. So erkennen KI-Systeme, dass alle diese Angaben zur selben Firma gehören.',
    steps: [
      'Alle offiziellen Profile sammeln: LinkedIn, Instagram, Facebook, YouTube, Wikipedia, Wikidata, Handelsregister.',
      'Im Organization-Schema als sameAs-Liste eintragen (Vorlage unten).',
      'Falls noch kein Wikidata-Eintrag existiert: anlegen lassen, das stärkt die Marke im Knowledge Graph.',
    ],
    snippet: (d) => ({ lang: 'JSON-LD', code: jsonld(orgSchema(d)) }),
  },
  'Inhaltstyp ausgezeichnet': {
    who: WHO.dev, effort: '1 Std',
    why: 'Ein Schema für den Inhaltstyp (Artikel, FAQ, Produkt, Dienstleistung) sagt, was auf der Seite steht. FAQ-Schema passt besonders gut zu Frage-Antwort-Abschnitten.',
    steps: [
      'Den passenden Typ wählen: Article/BlogPosting für Artikel, FAQPage für Fragen und Antworten, Product oder Service für Angebote.',
      'Vorlage unten anpassen, die Antworten müssen identisch mit dem sichtbaren Text sein.',
    ],
    snippet: (d) => {
      const qs = d.headings.filter((h) => h.question && h.level > 1).slice(0, 5);
      if (qs.length >= 2) {
        return {
          lang: 'JSON-LD (FAQPage)',
          code: jsonld({
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: qs.map((q) => ({ '@type': 'Question', name: q.text, acceptedAnswer: { '@type': 'Answer', text: 'Antwort wie auf der Seite …' } })),
          }),
        };
      }
      return {
        lang: 'JSON-LD (Article)',
        code: jsonld({
          '@context': 'https://schema.org', '@type': 'Article',
          headline: d.headings.find((h) => h.level === 1)?.text || d.meta.title,
          description: d.meta.description || '',
          author: { '@type': 'Person', name: d.eeat.author || 'Vorname Nachname', url: new URL(d.meta.url).origin + '/team/vorname-nachname' },
          datePublished: d.eeat.published || new Date().toISOString().slice(0, 10),
          dateModified: new Date().toISOString().slice(0, 10),
          mainEntityOfPage: d.meta.canonical || d.meta.url,
          publisher: { '@type': 'Organization', name: brandName(d) },
        }),
      };
    },
  },
  'BreadcrumbList': {
    who: WHO.dev, effort: '30 Min',
    why: 'Die Breadcrumb zeigt, wo die Seite in der Website liegt. Das hilft, den Zusammenhang zwischen Seiten zu verstehen.',
    steps: ['Vorlage unten anpassen, Namen wie in der sichtbaren Navigation.'],
    snippet: (d) => {
      const u = new URL(d.meta.url);
      const parts = u.pathname.split('/').filter(Boolean);
      const items = [{ name: 'Startseite', item: u.origin + '/' }].concat(parts.map((p, i) => ({
        name: decodeURIComponent(p).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        item: u.origin + '/' + parts.slice(0, i + 1).join('/'),
      })));
      return {
        lang: 'JSON-LD',
        code: jsonld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })) }),
      };
    },
  },
  'Autor:in erkennbar': {
    who: WHO.content, effort: '30 Min',
    why: 'Inhalte von erkennbaren Fachpersonen gelten als vertrauenswürdiger. Google nennt das E-E-A-T (Erfahrung, Fachwissen, Autorität, Vertrauen).',
    steps: [
      'Unter dem Titel eine Autorenzeile ergänzen: Name, Funktion, Link zur Profilseite.',
      'Eine kurze Profilseite pro Autor:in mit Foto, Erfahrung und LinkedIn anlegen.',
      'Im Schema als author eintragen (siehe Schritt «Inhaltstyp»).',
    ],
    snippet: () => ({ lang: 'HTML', code: '<p class="byline">Von <a href="/team/vorname-nachname" rel="author">Vorname Nachname</a>, Funktion · Aktualisiert am <time datetime="2026-11-16">16. November 2026</time></p>' }),
  },
  'Datum ausgezeichnet': {
    who: WHO.dev, effort: '15 Min',
    why: 'KI-Systeme bevorzugen aktuelle Informationen. Ohne sichtbares und maschinenlesbares Datum wissen sie nicht, wie aktuell die Seite ist.',
    steps: [
      'Veröffentlichungs- und Änderungsdatum sichtbar anzeigen.',
      'Zusätzlich im Schema (datePublished, dateModified) oder als Meta-Tag hinterlegen.',
    ],
    snippet: () => ({ lang: 'HTML', code: `<meta property="article:published_time" content="2026-01-15">\n<meta property="article:modified_time" content="${new Date().toISOString().slice(0, 10)}">` }),
  },
  'Aktualität': {
    who: WHO.content, effort: '1–2 Std',
    why: 'Seiten, die länger als ein Jahr nicht überarbeitet wurden, verlieren gegenüber aktuellen Quellen. Wichtig ist eine echte Überarbeitung, nicht nur ein neues Datum.',
    steps: [
      'Zahlen, Preise, Beispiele und Links auf Aktualität prüfen.',
      'Einen neuen Abschnitt oder neue Fakten ergänzen.',
      'Danach dateModified aktualisieren.',
      'Wiederkehrend einplanen: wichtige Seiten mindestens zweimal pro Jahr prüfen.',
    ],
  },
  'Über uns, Kontakt, Impressum verlinkt': {
    who: WHO.dev, effort: '30 Min',
    why: 'Eine echte Firma mit Adresse und Ansprechpersonen ist vertrauenswürdiger. Diese Seiten sollten von jeder Seite aus erreichbar sein, meist im Footer.',
    steps: ['Fehlende Seiten anlegen bzw. im Footer verlinken: Über uns, Kontakt, Impressum, Datenschutz.'],
  },
  'Inhalt ohne JavaScript lesbar': {
    who: WHO.dev, effort: '½–2 Tage',
    why: 'Die meisten KI-Crawler (GPTBot, ClaudeBot, PerplexityBot) führen kein JavaScript aus. Text, der erst im Browser nachgeladen wird, sehen sie nicht.',
    steps: [
      'Im Browser «Seitenquelltext anzeigen» öffnen und prüfen, ob der Haupttext darin steht.',
      'Falls nicht: Server-Side Rendering oder Static Generation aktivieren (z. B. Next.js, Nuxt, Astro) oder für Bots vorrendern.',
      'Danach 16NOV erneut laufen lassen, der Wert sollte über 70 % liegen.',
    ],
  },
  'Meta Description': {
    who: WHO.seo, effort: '15 Min',
    why: 'Die Meta Description ist die Kurzbeschreibung der Seite. Suchmaschinen und KI-Systeme nutzen sie als Zusammenfassung.',
    steps: ['Eine Beschreibung mit 120–155 Zeichen schreiben: Thema, Nutzen, Zielgruppe.'],
    snippet: (d) => {
      const base = (d.content.firstParagraph?.text || d.meta.title || '').slice(0, 152);
      return { lang: 'HTML (Entwurf aus dem ersten Absatz)', code: `<meta name="description" content="${base.replace(/"/g, '&quot;')}…">` };
    },
  },
  'Sprache und Canonical': {
    who: WHO.dev, effort: '15 Min',
    why: 'Die Sprachangabe hilft, die Seite der richtigen Sprache zuzuordnen. Der Canonical sagt, welche URL die offizielle Version ist, wenn es Duplikate gibt.',
    steps: ['Beide Angaben im <head> bzw. am <html>-Tag ergänzen.'],
    snippet: (d) => ({ lang: 'HTML', code: `<html lang="de-CH">\n<link rel="canonical" href="${(d.meta.canonical || d.meta.url).split('#')[0]}">` }),
  },
};

const GLOSSARY = [
  ['GEO (Generative Engine Optimization)', 'Optimierung einer Website, damit KI-Systeme wie ChatGPT, Claude, Perplexity oder Google AI Overviews sie finden, verstehen und als Quelle nennen.'],
  ['AI Overviews / AI Mode', 'KI-Zusammenfassungen, die Google über bzw. anstelle der klassischen Suchresultate anzeigt.'],
  ['KI-Crawler / Bot', 'Programm, das Webseiten automatisch abruft. Such-Bots holen Inhalte für Antworten, Trainings-Bots sammeln Texte zum Trainieren von Modellen.'],
  ['robots.txt', 'Textdatei im Hauptverzeichnis, die Bots sagt, welche Bereiche sie lesen dürfen.'],
  ['llms.txt', 'Neue, freiwillige Markdown-Datei, die Sprachmodellen die wichtigsten Seiten einer Website vorstellt.'],
  ['Passage', 'Einzelner Textabschnitt. KI-Systeme zitieren meist einzelne Passagen statt ganzer Seiten.'],
  ['Strukturierte Daten / Schema / JSON-LD', 'Maschinenlesbare Zusatzinfos im Quelltext, z. B. wer die Firma ist, wer den Artikel geschrieben hat oder welche Fragen beantwortet werden.'],
  ['sameAs', 'Angabe im Schema, die auf andere offizielle Profile derselben Firma oder Person verweist.'],
  ['E-E-A-T', 'Erfahrung, Fachwissen, Autorität und Vertrauen. Kriterien, mit denen Google die Qualität von Inhalten beurteilt.'],
  ['Canonical', 'Verweis auf die offizielle URL einer Seite, wenn derselbe Inhalt unter mehreren Adressen erreichbar ist.'],
  ['Rendering / JavaScript', 'Manche Seiten bauen ihren Text erst im Browser per JavaScript auf. Viele Bots sehen dann nur eine leere Seite.'],
];

// ---------------- Helfer ----------------
function jsonld(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}
function brandName(d) {
  return (d.meta.ogTitle || d.meta.title || new URL(d.meta.url).hostname).split(/\s[|–—-]\s/)[0].trim();
}
function orgSchema(d) {
  const origin = new URL(d.meta.url).origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandName(d),
    url: origin + '/',
    logo: origin + '/logo.png',
    description: d.meta.description || 'Kurzbeschreibung des Unternehmens',
    sameAs: d.schema.sameAs.length ? d.schema.sameAs : [
      'https://www.linkedin.com/company/…',
      'https://www.instagram.com/…',
      'https://www.wikidata.org/wiki/Q…',
    ],
  };
}

function priorityOf(c) {
  const impact = c.weight * (c.status === 'fail' ? 1 : 0.5);
  return { impact, level: impact >= 4 ? 'high' : impact >= 2 ? 'mid' : 'low' };
}
const PRIO_LABEL = { high: 'Priorität hoch', mid: 'Priorität mittel', low: 'Priorität niedrig' };
const ST_LABEL = { pass: 'OK', warn: 'Prüfen', fail: 'Fehlt', info: 'Info' };

// ---------------- Render ----------------
function renderReport(d) {
  const R = evaluate(d);
  const host = new URL(d.meta.url).hostname.replace(/^www\./, '');
  const date = new Date(d.analyzedAt);
  document.title = `GEO-Report ${host} ${date.toISOString().slice(0, 10)}`;

  const open = R.checks
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .map((c) => ({ ...c, ...priorityOf(c) }))
    .sort((a, b) => b.impact - a.impact);
  const passed = R.checks.filter((c) => c.status === 'pass' || c.status === 'info');
  const potential = Math.round(open.reduce((s, c) => s + c.impact, 0));

  const r = 52, circ = 2 * Math.PI * r;
  const col = (p) => (p >= 75 ? 'var(--pass)' : p >= 50 ? 'var(--warn)' : 'var(--fail)');

  const steps = open.map((c, i) => {
    const g = GUIDE[c.label] || { who: '–', effort: '–', why: '', steps: [] };
    const snip = g.snippet ? g.snippet(d) : null;
    return `
      <div class="step ${c.level}">
        <div class="head"><span class="box"></span><span class="no">${i + 1}.</span><h3>${esc(c.label)}</h3></div>
        <div class="meta">
          <span class="tag ${c.level}">${PRIO_LABEL[c.level]}</span>
          <span class="tag pts">+${Math.round(c.impact * 10) / 10} Punkte</span>
          <span class="tag">${esc(CATS[c.cat].label)}</span>
          <span class="tag">Wer: ${esc(g.who)}</span>
          <span class="tag">Aufwand: ${esc(g.effort)}</span>
        </div>
        <div class="body">
          <div class="finding"><b>Befund:</b> ${esc(c.detail)}</div>
          ${g.why ? `<p><b>Warum wichtig:</b> ${esc(g.why)}</p>` : ''}
          ${g.steps.length ? `<div class="label">So gehst du vor</div><ol>${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          ${g.extra ? g.extra(d) : ''}
          ${snip && snip.code ? `<div class="label">Vorlage: ${esc(snip.lang)}</div><pre>${esc(snip.code)}</pre>` : ''}
          <div class="done">Erledigt am: ____________ &nbsp;·&nbsp; Von: ____________</div>
        </div>
      </div>`;
  }).join('');

  const kindLabel = { search: 'Suche', user: 'Nutzer-Abruf', training: 'Training' };

  document.getElementById('report').innerHTML = `
    <div class="muted small">GEO-Report · erstellt mit 16NOV am ${esc(date.toLocaleString('de-CH'))}</div>
    <h1>${esc(d.meta.title || host)}</h1>
    <div class="muted url">${esc(d.meta.url)}</div>

    <div class="cover">
      <div class="gauge">
        <svg width="120" height="120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="${col(R.total)}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - R.total / 100)}"/></svg>
        <div class="num"><div><b>${R.total}</b><span>von 100</span></div></div>
      </div>
      <div>
        <div class="grade">${esc(grade(R.total))}</div>
        <p class="muted">Der GEO-Score zeigt, wie gut diese Seite von KI-Suchen gelesen, verstanden und zitiert werden kann.
        Mit den ${open.length} Schritten in diesem Report sind bis zu <b>+${potential} Punkte</b> möglich.</p>
      </div>
    </div>

    <div class="cats">
      ${Object.entries(R.cats).map(([k, c]) => {
        const pct = Math.round((c.got / c.max) * 100);
        return `<div class="cat"><div class="row"><span>${CATS[k].label}</span><span>${Math.round(c.got)}/${c.max}</span></div><div class="bar"><i style="width:${pct}%;background:${col(pct)}"></i></div></div>`;
      }).join('')}
    </div>

    <div class="summary">
      <div><b>${open.length}</b><span>Offene Schritte</span></div>
      <div><b style="color:var(--fail)">${open.filter((c) => c.level === 'high').length}</b><span>Priorität hoch</span></div>
      <div><b style="color:var(--accent)">+${potential}</b><span>Punkte möglich</span></div>
      <div><b style="color:var(--pass)">${passed.length}</b><span>Bereits erfüllt</span></div>
    </div>

    <div class="plain">
      <b class="t">Einfach erklärt: So arbeitest du mit diesem Report</b>
      <p>Die Schritte sind nach Wirkung sortiert: oben das, was am meisten bringt. Arbeite sie von oben nach unten ab und hake jeden erledigten Schritt ab.
      Bei jedem Schritt steht, wer ihn typischerweise erledigt (Entwicklung, Redaktion oder SEO/Marketing), wie lange er etwa dauert und was genau zu tun ist.
      Wo es passt, gibt es eine fertige Vorlage zum Kopieren. Wenn alle Schritte mit hoher Priorität erledigt sind, die Seite mit 16NOV erneut prüfen.</p>
    </div>

    <h2>Massnahmenplan</h2>
    ${steps || '<p>Keine offenen Punkte. Die Seite erfüllt alle Prüfungen.</p>'}

    <h2 class="page-break">Bereits erfüllt</h2>
    <table>
      <tr><th>Prüfpunkt</th><th>Kategorie</th><th>Ergebnis</th></tr>
      ${passed.map((c) => `<tr><td><span class="st ${c.status}">${ST_LABEL[c.status]}</span> ${esc(c.label)}</td><td>${esc(CATS[c.cat].label)}</td><td class="muted">${esc(c.detail)}</td></tr>`).join('')}
    </table>

    <h2>Anhang A: KI-Crawler</h2>
    <div class="plain"><b class="t">Einfach erklärt</b><p>«Suche» und «Nutzer-Abruf» sind die Bots, die Inhalte für Antworten in ChatGPT, Claude, Perplexity und Co. holen. Diese sollten erlaubt sein.
    «Training» sammelt Texte zum Trainieren von KI-Modellen. Ob man diese zulässt, ist eine geschäftliche Entscheidung und beeinflusst die Sichtbarkeit kaum.</p></div>
    <table>
      <tr><th>Bot</th><th>Anbieter</th><th>Zweck</th><th>Status</th><th>Regel</th></tr>
      ${d.crawl.bots.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.vendor)}</td><td>${kindLabel[b.kind]}</td>
        <td><span class="st ${b.allowed ? 'pass' : b.kind === 'training' ? 'info' : 'fail'}">${b.allowed ? 'Erlaubt' : 'Blockiert'}</span></td>
        <td class="muted small">${esc(b.rule || b.via)}</td></tr>`).join('')}
    </table>
    <p class="small muted" style="margin-top:6px">robots.txt: ${d.crawl.robotsTxt.found ? 'vorhanden' : 'nicht gefunden'} · llms.txt: ${d.crawl.llms.found ? 'vorhanden' : 'nicht gefunden'}${d.crawl.robotsTxt.sitemaps.length ? ` · Sitemap: ${esc(d.crawl.robotsTxt.sitemaps[0])}` : ''}</p>

    <h2>Anhang B: Überschriften</h2>
    <div class="htree">
      ${d.headings.slice(0, 60).map((h) => `<div style="padding-left:${(h.level - 1) * 14}px"><span class="lv">H${h.level}</span>${esc(h.text)}${h.question ? ' <span class="st pass">Frage</span>' : ''}</div>`).join('') || '<p class="muted">Keine Überschriften gefunden.</p>'}
      ${d.headings.length > 60 ? `<p class="muted small">… und ${d.headings.length - 60} weitere</p>` : ''}
    </div>

    <h2>Anhang C: Passagen</h2>
    <div class="plain"><b class="t">Einfach erklärt</b><p>Jeder Textabschnitt erhält bis zu 100 Punkte: für die richtige Länge (40–150 Wörter), konkrete Zahlen, eine Definition, einen eigenständigen Einstieg und eine verlinkte Quelle.
    Die besten Passagen sind Vorbilder für den Rest der Seite.</p></div>
    <table>
      <tr><th style="width:60px">Score</th><th>Passage</th></tr>
      ${d.passages.slice(0, 5).map((p) => `<tr><td><b>${p.score}</b></td><td>${esc(p.text.slice(0, 300))}${p.text.length > 300 ? ' …' : ''}<div class="muted small">${esc(p.why.join(', '))}</div></td></tr>`).join('') || '<tr><td colspan="2" class="muted">Keine Passagen gefunden</td></tr>'}
    </table>

    <h2>Anhang D: Glossar</h2>
    <dl class="glossary">${GLOSSARY.map(([t, x]) => `<dt>${esc(t)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>

    <div class="footer">
      Die Bewertung basiert auf Faustregeln für KI-Sichtbarkeit und misst keine tatsächlichen Platzierungen in KI-Antworten.
      Ob die Seite genannt wird, lässt sich mit dem Tools-Tab von 16NOV direkt in ChatGPT, Perplexity, Claude, Google AI Mode und Copilot testen.
    </div>`;
}

// ---------------- Start ----------------
document.getElementById('btn-print').addEventListener('click', () => window.print());

(async () => {
  const box = document.getElementById('report');
  try {
    let geoReport = null;
    try {
      if (chrome.storage?.session) ({ geoReport } = await chrome.storage.session.get('geoReport'));
    } catch (e) { /* Fallback unten */ }
    if (!geoReport) {
      try { geoReport = JSON.parse(localStorage.getItem('geoReport') || 'null'); } catch (e) { /* ignorieren */ }
    }
    if (!geoReport) {
      box.innerHTML = '<p>Keine Analyse gefunden. Bitte 16NOV auf einer Webseite öffnen und dort «PDF-Report» klicken.</p>';
      return;
    }
    renderReport(geoReport);
    if (new URLSearchParams(location.search).get('print') === '1') {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => window.print(), 500);
    }
  } catch (e) {
    box.innerHTML = `<p>Report konnte nicht erstellt werden: ${esc(e.message)}</p>`;
  }
})();
