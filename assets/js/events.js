/* Events aus einem veröffentlichten Google Sheet (CSV) laden und anzeigen.
 * Spalten (Kopfzeile, Groß-/Kleinschreibung egal):
 *   datum        2026-10-24 oder 24.10.2026
 *   uhrzeit      21:00 (optional)
 *   kategorie    z. B. Musik, Quiz, Sport, Party (optional)
 *   titel        Pflicht
 *   beschreibung optional
 *   sichtbar     "nein" blendet die Zeile aus (optional, Standard: sichtbar)
 * Texte aus dem Sheet werden ausschließlich als Text eingefügt (kein innerHTML). */
(function () {
  'use strict';

  var grid = document.getElementById('eventGrid');
  var statusEl = document.getElementById('eventsStatus');
  var filtersEl = document.getElementById('eventFilters');
  if (!grid || !statusEl || !filtersEl) return;

  var MAX_EVENTS = 60;
  var CAT_STYLE = {
    Musik: 'bg-gold-500/15 text-gold-300',
    Quiz: 'bg-sky-500/15 text-sky-300',
    Sport: 'bg-clover-500/20 text-emerald-300',
    Party: 'bg-fuchsia-500/15 text-fuchsia-300'
  };
  var CAT_DEFAULT = 'bg-white/10 text-stone-300';

  var events = [];
  var activeCat = 'Alle';

  function setStatus(text) { statusEl.textContent = text; statusEl.hidden = !text; }

  /* ---------- CSV-Parser (RFC 4180, inkl. Anführungszeichen und Zeilenumbrüche in Feldern) ---------- */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = '', inQ = false, i = 0, c;
    while (i < text.length) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function berlinToday() {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var g = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    return g('year') + '-' + g('month') + '-' + g('day');
  }

  function normDate(s) {
    s = (s || '').trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    var y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function normTime(s) {
    var m = /^(\d{1,2}):(\d{2})/.exec((s || '').trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return '';
    return String(+m[1]).padStart(2, '0') + ':' + m[2];
  }

  function toEvents(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = function (n) { return head.indexOf(n); };
    var iDate = idx('datum'), iTime = idx('uhrzeit'), iCat = idx('kategorie'),
        iTitle = idx('titel'), iDesc = idx('beschreibung'), iVis = idx('sichtbar');
    if (iDate < 0 || iTitle < 0) throw new Error('Spalten "datum" und "titel" fehlen');
    var today = berlinToday(), out = [];
    rows.slice(1).forEach(function (r) {
      var get = function (i) { return i >= 0 && r[i] != null ? r[i].trim() : ''; };
      if (/^(nein|no|false|0|x)$/i.test(get(iVis))) return;
      var date = normDate(get(iDate)), title = get(iTitle).slice(0, 120);
      if (!date || !title || date < today) return;
      out.push({ date: date, time: normTime(get(iTime)), cat: get(iCat).slice(0, 30), title: title, desc: get(iDesc).slice(0, 400) });
    });
    out.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    return out.slice(0, MAX_EVENTS);
  }

  /* ---------- Darstellung ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function card(ev) {
    var p = ev.date.split('-').map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    var mon = dt.toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }).replace('.', '');
    var wd = dt.toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'UTC' });

    var art = el('article', 'flex gap-5 rounded-2xl border border-white/10 bg-pub-800 p-5 transition duration-300 hover:-translate-y-1 hover:border-gold-500/50');
    var box = el('div', 'flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-pub-950 ring-1 ring-gold-500/30');
    box.appendChild(el('span', 'font-display text-3xl font-extrabold leading-none text-gold-400', String(p[2])));
    box.appendChild(el('span', 'mt-1 text-xs font-semibold uppercase tracking-wider text-stone-400', mon));
    var body = el('div', 'min-w-0');
    if (ev.cat) body.appendChild(el('span', 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (CAT_STYLE[ev.cat] || CAT_DEFAULT), ev.cat));
    body.appendChild(el('h3', 'mt-2 text-lg font-bold leading-snug text-white break-words', ev.title));
    body.appendChild(el('p', 'text-xs text-stone-500', wd + (ev.time ? ' · ' + ev.time + ' Uhr' : '')));
    if (ev.desc) body.appendChild(el('p', 'mt-2 text-sm leading-relaxed text-stone-400 break-words', ev.desc));
    art.appendChild(box); art.appendChild(body);
    return art;
  }

  function render() {
    var list = events.filter(function (e) { return activeCat === 'Alle' || e.cat === activeCat; });
    grid.textContent = '';
    list.forEach(function (e) { grid.appendChild(card(e)); });

    var cats = ['Alle'];
    events.forEach(function (e) { if (e.cat && cats.indexOf(e.cat) < 0) cats.push(e.cat); });
    filtersEl.textContent = '';
    if (cats.length > 2) {
      cats.forEach(function (c) {
        var b = el('button', 'rounded-full border px-4 py-2 text-sm font-semibold transition ' +
          (c === activeCat ? 'border-gold-500 bg-gold-500 text-pub-950' : 'border-white/15 text-stone-300 hover:border-gold-400 hover:text-gold-300'), c);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(c === activeCat));
        b.addEventListener('click', function () { activeCat = c; render(); });
        filtersEl.appendChild(b);
      });
    }
    setStatus(events.length ? '' : 'Aktuell sind keine Events geplant. Schau bald wieder vorbei!');
  }

  /* ---------- Laden ---------- */
  var url = (window.PUB_CONFIG && window.PUB_CONFIG.SHEET_CSV_URL) || '';
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url) || url.indexOf('output=csv') < 0) {
    setStatus('Die Anbindung an Google Sheets ist in dieser Demo noch nicht eingerichtet, deshalb werden hier noch keine Events angezeigt.');
    return;
  }

  var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 10000);
  fetch(url, { signal: ctrl.signal, cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (t) { events = toEvents(parseCSV(t)); render(); })
    .catch(function () { setStatus('Die Events konnten gerade nicht geladen werden. Bitte versuche es später noch einmal.'); })
    .then(function () { clearTimeout(timer); });
})();
