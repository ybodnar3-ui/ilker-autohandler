# Hayat Gruppe — Automobile

Vitrine für den Fahrzeugbestand der [Hayat Gruppe](https://hayatgruppe.com) (Wien),
automatisch synchronisiert aus dem willhaben-Bestand.

**Live:** https://ilker-autohandler.vercel.app

## Wie es funktioniert

- **Parser (24/7):** GitHub Actions (`.github/workflows/deploy.yml`) scrapet alle
  30 Minuten den willhaben-Bestand des Händlers, wählt saubere Titelbilder (ohne
  Werbe-Banner) und schreibt `web/data.js`.
- **Hosting:** [Vercel](https://ilker-autohandler.vercel.app) deployt die statische
  Seite unter `web/` bei jedem Commit automatisch neu.
- **Fotos:** direkt von willhaben verlinkt — kein eigener Bildspeicher nötig.

Der Bestand wird nie geleert veröffentlicht: eine Plausibilitätsprüfung
(`sync/src/sanity.ts`) hält den letzten guten Stand, falls willhaben ausfällt.

## Struktur

| Pfad | Zweck |
|---|---|
| `web/` | Die Website (wird von Vercel als Root ausgeliefert) |
| `sync/src/` | Scraping-, Normalisierungs- und Plausibilitäts-Logik (101 Tests) |
| `sync/scripts/sync-fs.ts` | Node-Runner: willhaben → `catalog.json` |
| `sync/scripts/pick-covers.py` | Banner-Erkennung → saubere Titelbilder |
| `sync/scripts/build-data.ts` | baut `web/data.js` für die Seite |

## Befehle (im `sync/`-Verzeichnis)

```bash
npm test           # Tests
npm run sync:fs    # willhaben scrapen → catalog.json
npm run build:data # web/data.js bauen
```
