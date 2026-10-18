/* Musterpub (Demo) – Frontend-Logik: Menü, Öffnungszeiten, Live-Status, Reservierungsformular (ohne Versand) */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- Öffnungszeiten (Minuten seit 00:00; Werte über 1440 = nach Mitternacht) ---------- */
  // Erfundene Beispielzeiten der Demo.
  var HOURS = [
    { d: 1, name: 'Montag',     open: 18 * 60, close: 23 * 60, last: 22 * 60 },
    { d: 2, name: 'Dienstag',   open: 18 * 60, close: 23 * 60, last: 22 * 60 },
    { d: 3, name: 'Mittwoch',   open: 18 * 60, close: 23 * 60, last: 22 * 60 },
    { d: 4, name: 'Donnerstag', open: 18 * 60, close: 23 * 60, last: 22 * 60 },
    { d: 5, name: 'Freitag',    open: 17 * 60, close: 25 * 60, last: 23 * 60 + 30 },
    { d: 6, name: 'Samstag',    open: 17 * 60, close: 25 * 60, last: 23 * 60 + 30 },
    { d: 0, name: 'Sonntag',    open: 14 * 60, close: 22 * 60, last: 21 * 60 }
  ];
  var LEAD_MINUTES = 60;   // frühestens 1 Stunde im Voraus
  var MAX_DAYS_AHEAD = 120;
  var SLOT_STEP = 30;

  function fmt(min) { return pad(Math.floor(min / 60) % 24) + ':' + pad(min % 60); }
  function byDay(d) { return HOURS.filter(function (h) { return h.d === d; })[0]; }

  function berlinNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    var g = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      day: map[g('weekday')],
      minutes: (parseInt(g('hour'), 10) % 24) * 60 + parseInt(g('minute'), 10),
      date: g('year') + '-' + g('month') + '-' + g('day')
    };
  }

  function addDays(dateStr, n) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function weekdayOf(dateStr) {
    var p = dateStr.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  }

  function getStatus() {
    var now = berlinNow(), t = now.minutes;
    var today = byDay(now.day), yest = byDay((now.day + 6) % 7);
    if (yest.close > 1440 && t < yest.close - 1440) return { open: true, until: yest.close - 1440, day: now.day };
    if (t >= today.open && t < Math.min(today.close, 1440)) return { open: true, until: today.close, day: now.day };
    if (t < today.open) return { open: false, next: today.open, label: 'heute', day: now.day };
    var nd = byDay((now.day + 1) % 7);
    return { open: false, next: nd.open, label: 'morgen', day: now.day };
  }

  function renderHours() {
    var body = $('#hoursBody');
    var st = getStatus();
    if (body) {
      body.innerHTML = HOURS.map(function (x) {
        var isToday = x.d === st.day;
        return '<tr class="' + (isToday ? 'today-row' : '') + '">' +
          '<th scope="row" class="py-3.5 pl-3 pr-4 font-medium ' + (isToday ? 'text-gold-300' : 'text-stone-200') + '">' + x.name +
          (isToday ? ' <span class="ml-1 text-xs font-semibold text-gold-400">· heute</span>' : '') + '</th>' +
          '<td class="py-3.5 pr-3 text-right text-stone-300">' + fmt(x.open) + ' – ' + fmt(x.close) + ' Uhr</td></tr>';
      }).join('');
    }
    var dot = $('#statusDot'), txt = $('#statusText'), badge = $('#statusBadge');
    if (!dot || !txt) return;
    if (st.open) {
      dot.className = 'h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]';
      txt.textContent = 'Jetzt geöffnet – bis ' + fmt(st.until) + ' Uhr';
      if (badge) { badge.textContent = 'Jetzt geöffnet'; badge.className = 'rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300'; }
    } else {
      dot.className = 'h-3 w-3 rounded-full bg-rose-400';
      txt.textContent = 'Aktuell geschlossen – öffnet ' + st.label + ' um ' + fmt(st.next) + ' Uhr';
      if (badge) { badge.textContent = 'Geschlossen'; badge.className = 'rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300'; }
    }
  }

  /* ---------- Mobile Menü ---------- */
  function initMenu() {
    var btn = $('#menuBtn'), nav = $('#mobileNav');
    if (!btn || !nav) return;
    function setMenu(open) {
      nav.classList.toggle('hidden', !open);
      $('#iconOpen').classList.toggle('hidden', open);
      $('#iconClose').classList.toggle('hidden', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    }
    btn.addEventListener('click', function () { setMenu(nav.classList.contains('hidden')); });
    document.querySelectorAll('.m-link').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  /* ---------- Header beim Scrollen ---------- */
  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;
    function onScroll() {
      var s = window.scrollY > 40;
      ['bg-pub-950/90', 'backdrop-blur', 'shadow-lg', 'shadow-black/30'].forEach(function (c) { header.classList.toggle(c, s); });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Scroll-Reveal ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Reservierungsformular ---------- */
  function initForm() {
    var form = $('#resForm');
    if (!form) return;
    var dateEl = $('#date'), timeEl = $('#time'), msgEl = $('#formMsg'), btn = $('#submitBtn');

    var now = berlinNow();
    dateEl.min = now.date;
    dateEl.max = addDays(now.date, MAX_DAYS_AHEAD);

    function fillSlots() {
      timeEl.innerHTML = '';
      var v = dateEl.value;
      if (!v) { timeEl.innerHTML = '<option value="">Erst Datum wählen</option>'; timeEl.disabled = true; return; }
      var h = byDay(weekdayOf(v)), n = berlinNow(), slots = [];
      for (var m = h.open; m <= h.last; m += SLOT_STEP) {
        if (v === n.date && m < n.minutes + LEAD_MINUTES) continue;
        slots.push(m);
      }
      if (!slots.length) {
        timeEl.innerHTML = '<option value="">Keine Zeiten mehr frei – bitte anderes Datum</option>';
        timeEl.disabled = true;
        return;
      }
      timeEl.disabled = false;
      timeEl.innerHTML = '<option value="">Uhrzeit wählen</option>' + slots.map(function (m) {
        return '<option value="' + fmt(m) + '">' + fmt(m) + ' Uhr</option>';
      }).join('');
      var hint = $('#hoursHint');
      if (hint) hint.textContent = h.name + ': geöffnet ' + fmt(h.open) + ' – ' + fmt(h.close) + ' Uhr';
    }
    fillSlots();
    dateEl.addEventListener('change', fillSlots);

    function show(kind, text) {
      msgEl.className = 'mt-4 rounded-xl px-4 py-3 text-sm ' +
        (kind === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300');
      msgEl.textContent = text;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        name: $('#name').value.trim(),
        email: $('#email').value.trim(),
        phone: $('#phone').value.trim(),
        date: dateEl.value,
        time: timeEl.value,
        guests: parseInt($('#guests').value, 10),
        message: $('#msg').value.trim(),
        website: $('#website').value,           // Honeypot
        consent: $('#consent').checked
      };
      if (!data.name || !data.email || !data.date || !data.time || !(data.guests >= 1)) {
        show('err', 'Bitte Name, E-Mail, Datum, Uhrzeit und Personenzahl angeben.'); return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { show('err', 'Bitte eine gültige E-Mail-Adresse angeben.'); return; }
      if (!data.consent) { show('err', 'Bitte bestätige den Hinweis zur Datenübermittlung.'); return; }

      var endpoint = (window.PUB_CONFIG && window.PUB_CONFIG.RESERVE_ENDPOINT) || '';
      if (!/^https:\/\//.test(endpoint)) {
        show('err', 'Die Online-Reservierung ist in dieser Demo noch nicht aktiviert. Es wurde nichts gesendet.');
        return;
      }
      btn.disabled = true; btn.classList.add('opacity-60');
      show('ok', 'Anfrage wird gesendet …');
      var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 15000);
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl.signal
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (res.ok && res.body && res.body.ok === true) {
          show('ok', 'Danke, ' + data.name + '! Deine Anfrage wurde an den Betreiber der Demo übermittelt.' +
            (res.body.confirmationSent === true ? ' Eine Bestätigung ist unterwegs an ' + data.email + '.' : ''));
          form.reset(); fillSlots();
        } else {
          show('err', (res.body && res.body.error) || 'Das hat leider nicht geklappt. Es wurde nichts gesendet.');
        }
      }).catch(function () {
        show('err', 'Keine Verbindung zum Reservierungsdienst. Es wurde nichts gesendet.');
      }).then(function () { clearTimeout(timer); btn.disabled = false; btn.classList.remove('opacity-60'); });
    });
  }

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  initMenu(); initHeader(); initReveal(); renderHours(); initForm();
  setInterval(renderHours, 60000);
})();
