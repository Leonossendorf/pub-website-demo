# Musterpub – Design-Demo

Technische Design-Demo für die Website eines Irish Pubs (HTML, Tailwind CSS, JavaScript).

**Kein echter Betrieb:** „Musterpub“ ist erfunden. Alle Namen, Adressen, Kontaktdaten und Öffnungszeiten sind Beispieldaten.

## Aufbau

| Pfad | Zweck |
|---|---|
| `index.html`, `hinweis.html` | Seiten |
| `assets/css/styles.css` | gebautes Tailwind-CSS (v3) |
| `assets/fonts/` | Inter (SIL Open Font License), lokal eingebunden |
| `assets/js/config.js` | **Einzige Stelle für Einstellungen** (Sheet-URL, Backend-Adresse) |
| `assets/js/events.js` | Events aus Google Sheets laden |
| `assets/js/main.js` | Menü, Öffnungszeiten, Live-Status, Formular |
| `worker/` | Reservierungs-Backend (Cloudflare Worker, sendet über Resend) |
| `tests/` | Tests für das Backend: `node --test tests/reserve.test.mjs` |
| `docs/events-vorlage.csv` | Vorlage für das Google Sheet |

## Events per Google Sheet

1. Neues Google Sheet anlegen, Blatt „Events“, Inhalt von `docs/events-vorlage.csv` einfügen (Datei > Importieren).
   Spalten: `datum` (2026-10-24 oder 24.10.2026), `uhrzeit`, `kategorie`, `titel`, `beschreibung`, `sichtbar` (`nein` blendet aus).
2. **Datei > Teilen > Im Web veröffentlichen**, Blatt „Events“, Format **Kommagetrennte Werte (.csv)**, veröffentlichen.
3. Den Link in `assets/js/config.js` bei `SHEET_CSV_URL` eintragen.

Änderungen im Sheet erscheinen nach spätestens ein paar Minuten (Google cacht veröffentlichte Tabellen kurz).
Vergangene Termine werden automatisch ausgeblendet. Veröffentlicht wird nur dieses eine Blatt, nicht das ganze Dokument; lege dort nichts Vertrauliches ab.

## Reservierungsformular (Cloudflare Worker + Resend)

GitHub Pages kann keinen Server-Code ausführen. Das Formular schickt deshalb per `fetch` an den Worker in `worker/`.

1. In Resend einen API-Key mit der Berechtigung „Sending access“ anlegen, beschränkt auf die Absender-Domain.
2. Im Ordner `worker/`:
   ```
   npx wrangler deploy
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put MAIL_TO
   ```
   `MAIL_FROM`, `ALLOWED_ORIGINS` und `CONFIRM_GUEST` stehen in `worker/wrangler.toml` (keine Geheimnisse).
3. Die Worker-Adresse (`https://…workers.dev`) in `assets/js/config.js` bei `RESERVE_ENDPOINT` eintragen.
4. Empfehlung: in Cloudflare eine Rate-Limiting-Regel für den Worker anlegen.

Wichtig: Den Resend-Key und die Empfänger-Adresse **nie** in `config.js` oder sonstwo im Repository ablegen.
Die Bestätigungsmail an die Adresse aus dem Formular ist absichtlich aus (`CONFIRM_GUEST = "false"`), damit das öffentliche Formular
nicht an fremde Adressen mailen kann.

## Domain

Die Seite soll unter `musterpub.leonossendorf.de` laufen: DNS-`CNAME` `musterpub` → `leonossendorf.github.io`, dann in den Pages-Einstellungen
dieses Repositorys als Custom Domain eintragen und „Enforce HTTPS“ aktivieren. `ALLOWED_ORIGINS` im Worker muss dazu passen.

CSS neu bauen: `tailwindcss -c tailwind.config.js -i src/input.css -o assets/css/styles.css --minify`
