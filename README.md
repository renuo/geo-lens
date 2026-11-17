# 16NOV - KI-Sichtbarkeit in 1 Klick

Chrome-Extension, die mit einem Klick prüft, wie gut die aktuelle Seite von KI-Suchen
(ChatGPT, Claude, Perplexity, Google AI Overviews/AI Mode, Copilot) gefunden, gelesen und zitiert werden kann.

## Installieren (lokal)
1. `chrome://extensions` öffnen
2. Oben rechts **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → diesen Ordner wählen (der Ordner mit `manifest.json`)
4. Icon an die Toolbar pinnen

## Tabs
- **Übersicht**: GEO-Score 0–100, Kategorien, wichtigste Hebel, Meta, Technik (Roh-HTML vs. gerendert)
- **Crawler**: robots.txt-Status für 18 KI-Bots (Suche / Nutzer-Abruf / Training), Meta-Robots, X-Robots-Tag, llms.txt
- **Struktur**: Überschriftenbaum, Fragen-Titel, Listen/Tabellen, Absatzlänge
- **Zitierbar**: Passagen-Scoring (Länge, Fakten, Definition, Eigenständigkeit, Quellen), Zahlen, externe Quellen
- **Schema**: JSON-LD/Microdata-Typen, sameAs, Rohdaten
- **Vertrauen**: Autor, Datum, Aktualität, Über uns/Kontakt/Impressum, autoritative Quellen
- **Tools**: Prompt direkt in ChatGPT/Perplexity/Claude/Google AI Mode/Copilot öffnen, Validatoren, Markenerwähnungen

Export: Markdown in die Zwischenablage oder JSON-Download.

## PDF-Report
Die Daten für den Report werden bei jeder Analyse im Hintergrund bereitgelegt. Der Button **PDF-Report** öffnet einen
Schritt-für-Schritt-Massnahmenplan und startet direkt den Druckdialog («Als PDF speichern»). Inhalt:
- Deckblatt mit GEO-Score, Kategorien und möglichen Punkten
- Massnahmenplan nach Wirkung sortiert: Checkbox, Priorität, Wer, Aufwand, Befund, Warum, Vorgehen, vorausgefüllte Vorlagen (robots.txt, llms.txt, JSON-LD, Meta-Tags)
- Bereits erfüllte Punkte
- Anhänge: KI-Crawler, Überschriften, beste Passagen, Glossar, jeweils mit «Einfach erklärt»

## Berechtigungen
Nur `activeTab`, `scripting` und `storage` (für den Report): Die Analyse läuft erst beim Klick und nur im aktuellen Tab.
robots.txt, llms.txt und Roh-HTML werden vom Tab selbst (same-origin) geladen. Es werden keine Daten an Dritte gesendet.

## Gewichtung
Crawler 20 · Struktur 20 · Zitierbarkeit 20 · Schema 15 · Vertrauen 15 · Technik 10
