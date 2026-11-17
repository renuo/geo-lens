# GEO Lens: AI visibility in one click

A Chrome extension that checks, in one click, how well the current page can be found, read and cited by AI search
(ChatGPT, Claude, Perplexity, Google AI Overviews/AI Mode, Copilot).

The extension's interface and the PDF report are in German.

## Install (local)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`)
4. Pin the icon to the toolbar

Then open any website and click the llama.

## Tabs
- **Übersicht** (Overview): GEO score 0–100, categories, biggest levers, meta tags, technical checks (raw vs. rendered HTML)
- **Crawler**: robots.txt status for 18 AI bots (search / user fetch / training), meta robots, X-Robots-Tag, llms.txt
- **Struktur** (Structure): heading tree, question headings, lists/tables, paragraph length
- **Zitierbar** (Citable): passage scoring (length, facts, definitions, self-containedness, sources), numbers, external sources
- **Schema**: JSON-LD/Microdata types, sameAs, raw data
- **Vertrauen** (Trust): author, date, freshness, about/contact/legal pages, authoritative sources
- **Tools**: open a prompt directly in ChatGPT/Perplexity/Claude/Google AI Mode/Copilot, validators, brand mentions

Export: Markdown to the clipboard or JSON download.

## PDF report
The report data is prepared in the background with every analysis. The **PDF-Report** button opens a
step-by-step action plan and immediately starts the print dialog (choose "Save as PDF"). Contents:
- Cover page with GEO score, categories and points available
- Action plan sorted by impact: checkbox, priority, owner, effort, finding, why, how, prefilled templates (robots.txt, llms.txt, JSON-LD, meta tags)
- Items already passing
- Appendices: AI crawlers, headings, best passages, glossary, each with a plain-language explanation

## Permissions
Only `activeTab`, `scripting`, `storage` (for the report) and `clipboardWrite` (for the Markdown export).
The analysis runs only when you click, and only in the current tab. robots.txt, llms.txt and the raw HTML
are fetched by the tab itself (same-origin). No data is sent to third parties.

## Scoring weights
Crawler 20 · Structure 20 · Citability 20 · Schema 15 · Trust 15 · Technical 10
