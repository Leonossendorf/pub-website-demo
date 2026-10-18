/* Konfiguration der Demo – hier nur öffentliche Werte eintragen, niemals API-Schlüssel! */
window.PUB_CONFIG = {
  // Google Sheet als einfaches CMS für Events:
  // Datei > Teilen > Im Web veröffentlichen > Blatt "Events" > Format "Kommagetrennte Werte (.csv)" > Link hier einfügen.
  // Beispiel: 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv'
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBMDrY2-bWX8VtcsYpiG_3WIBenmgudB4Fj2kP493k4IYokXMu5pVC1pJxXaoXAUszOPH5WCmM3W5q/pub?gid=1385824710&single=true&output=csv',

  // Öffentliche HTTPS-Adresse des Reservierungs-Backends (siehe worker/ und README.md).
  // Beispiel: 'https://musterpub-reserve.DEIN-NAME.workers.dev'
  RESERVE_ENDPOINT: 'https://musterpub-reserve.leon-ossendorf.workers.dev'
};
