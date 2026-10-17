# Musterpub – Design-Demo

Technische Design-Demo für die Website eines Irish Pubs (HTML, Tailwind CSS, JavaScript).

**Kein echter Betrieb:** „Musterpub“ ist erfunden. Alle Namen, Adressen, Kontaktdaten und Öffnungszeiten sind Beispieldaten.
Das Reservierungsformular ist eine Attrappe und sendet oder speichert nichts.

## Aufbau

- `index.html`, `hinweis.html` – Seiten
- `assets/css/styles.css` – gebautes Tailwind-CSS (v3)
- `assets/fonts/` – Inter (SIL Open Font License)
- `assets/js/main.js` – Menü, Öffnungszeiten mit Live-Status, Formular-Demo
- `src/input.css`, `tailwind.config.js` – Quellen für das CSS

CSS neu bauen: `tailwindcss -c tailwind.config.js -i src/input.css -o assets/css/styles.css --minify`
