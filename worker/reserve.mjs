/**
 * Reservierungs-Backend der Musterpub-Demo (Cloudflare Worker, Web-Standard-APIs).
 *
 * POST JSON -> Eingaben prüfen -> E-Mail über Resend an MAIL_TO.
 * Die Bestätigung an den Absender des Formulars ist standardmäßig AUS (CONFIRM_GUEST), damit das
 * öffentliche Demo-Formular nicht als Mail-Relay für fremde Adressen missbraucht werden kann.
 *
 * Konfiguration (Cloudflare: Settings > Variables and Secrets):
 *   RESEND_API_KEY   Secret   Resend-Key mit Berechtigung "Sending access", beschränkt auf die Absender-Domain
 *   MAIL_TO          Secret   Empfänger der Anfragen
 *   MAIL_FROM        Variable z. B. "Musterpub Demo <musterpub@leonossendorf.de>" (Domain in Resend verifiziert)
 *   ALLOWED_ORIGINS  Variable Komma-getrennte Liste erlaubter Seiten, z. B. "https://musterpub.leonossendorf.de"
 *   CONFIRM_GUEST    Variable optional "true" = zusätzlich Bestätigungsmail an die angegebene Adresse
 *   MAIL_REPLY_TO    Variable optional, Reply-To der Bestätigungsmail
 */

// Dieselben Zeiten stehen in assets/js/main.js – bei Änderungen beide Dateien anpassen.
// Minuten seit 00:00. "last" = späteste Reservierungszeit.
const HOURS = {
  0: { name: 'Sonntag',    open: 14 * 60, last: 21 * 60 },
  1: { name: 'Montag',     open: 18 * 60, last: 22 * 60 },
  2: { name: 'Dienstag',   open: 18 * 60, last: 22 * 60 },
  3: { name: 'Mittwoch',   open: 18 * 60, last: 22 * 60 },
  4: { name: 'Donnerstag', open: 18 * 60, last: 22 * 60 },
  5: { name: 'Freitag',    open: 17 * 60, last: 23 * 60 + 30 },
  6: { name: 'Samstag',    open: 17 * 60, last: 23 * 60 + 30 }
};
const SLOT_STEP = 30;
const LEAD_MINUTES = 60;
const MAX_DAYS_AHEAD = 120;
const MAX_BODY_BYTES = 10_000;

const pad = (n) => String(n).padStart(2, '0');

export function berlinNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: (parseInt(g('hour'), 10) % 24) * 60 + parseInt(g('minute'), 10) };
}

function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function addDays(str, n) {
  const dt = parseDate(str);
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Prüft und normalisiert die Eingaben. Gibt { error } oder { value } zurück. */
export function validate(body, now = berlinNow()) {
  if (!body || typeof body !== 'object') return { error: 'Ungültige Anfrage.' };

  const name = clean(body.name);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const message = String(body.message ?? '').replace(/\r/g, '').trim();
  const guests = Number(body.guests);
  const time = clean(body.time);
  const date = clean(body.date);

  if (body.consent !== true) return { error: 'Bitte bestätige den Hinweis zur Datenübermittlung.' };
  if (!name || name.length > 100) return { error: 'Bitte gib einen Namen an (max. 100 Zeichen).' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { error: 'Bitte gib eine gültige E-Mail-Adresse an.' };
  if (phone.length > 40) return { error: 'Die Telefonnummer ist zu lang.' };
  if (message.length > 500) return { error: 'Die Nachricht ist zu lang (max. 500 Zeichen).' };
  if (!Number.isInteger(guests) || guests < 1 || guests > 100) return { error: 'Bitte gib eine Personenzahl zwischen 1 und 100 an.' };

  const dt = parseDate(date);
  if (!dt) return { error: 'Bitte wähle ein gültiges Datum.' };
  if (date < now.date) return { error: 'Das Datum liegt in der Vergangenheit.' };
  if (date > addDays(now.date, MAX_DAYS_AHEAD)) return { error: 'Reservierungen sind maximal 120 Tage im Voraus möglich.' };

  const h = HOURS[dt.getUTCDay()];
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return { error: 'Bitte wähle eine Uhrzeit.' };
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (!(minutes >= h.open && minutes <= h.last && (minutes - h.open) % SLOT_STEP === 0)) {
    return { error: `Am ${h.name} ist eine Reservierung nur innerhalb der Öffnungszeiten möglich.` };
  }
  if (date === now.date && minutes < now.minutes + LEAD_MINUTES) return { error: 'Diese Uhrzeit ist zu kurzfristig.' };

  return { value: { name, email, phone, message, guests, date, time, weekday: h.name } };
}

const formatDate = (d) => parseDate(d).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const deDate = (d) => d.split('-').reverse().join('.');

const wrap = (inner) => `<!doctype html><html lang="de"><body style="margin:0;background:#f4efe8;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#2a1a12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1a1310;padding:20px 28px;color:#e8bd5c;font-size:22px;font-weight:bold">Musterpub <span style="font-size:13px;color:#b9a47a;font-weight:normal">· Design-Demo</span></td></tr>
<tr><td style="padding:28px">${inner}</td></tr>
<tr><td style="background:#f4efe8;padding:16px 28px;font-size:12px;color:#7a6a5c">Diese Nachricht stammt aus dem Formular einer Design-Demo. Musterpub ist ein erfundener Betrieb.</td></tr>
</table></td></tr></table></body></html>`;

const row = (label, value) => `<tr><td style="padding:6px 16px 6px 0;color:#7a6a5c;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;font-weight:bold">${value}</td></tr>`;

export function buildMails(v) {
  const dateLong = formatDate(v.date);
  const msgHtml = v.message ? escapeHtml(v.message).replace(/\n/g, '<br>') : '–';

  const owner = {
    subject: `[Musterpub-Demo] ${v.name}, ${deDate(v.date)} ${v.time} Uhr, ${v.guests} Pers.`.slice(0, 200),
    html: wrap(`
    <h1 style="margin:0 0 16px;font-size:20px">Neue Reservierungsanfrage</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px">
      ${row('Name', escapeHtml(v.name))}
      ${row('Datum', escapeHtml(dateLong))}
      ${row('Uhrzeit', escapeHtml(v.time) + ' Uhr')}
      ${row('Personen', String(v.guests))}
      ${row('E-Mail', escapeHtml(v.email))}
      ${row('Telefon', v.phone ? escapeHtml(v.phone) : '–')}
      ${row('Nachricht', msgHtml)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#7a6a5c">Antworten auf diese Mail gehen direkt an die angegebene Adresse.</p>`),
    text: ['Neue Reservierungsanfrage (Musterpub-Demo)', '', `Name: ${v.name}`, `Datum: ${dateLong}`, `Uhrzeit: ${v.time} Uhr`,
      `Personen: ${v.guests}`, `E-Mail: ${v.email}`, `Telefon: ${v.phone || '–'}`, `Nachricht: ${v.message || '–'}`].join('\n')
  };

  const guest = {
    subject: `Deine Anfrage bei Musterpub am ${deDate(v.date)} um ${v.time} Uhr`,
    html: wrap(`
    <h1 style="margin:0 0 12px;font-size:20px">Deine Anfrage ist eingegangen</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hallo ${escapeHtml(v.name)}, das sind deine Angaben aus der Design-Demo:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px">
      ${row('Datum', escapeHtml(dateLong))}
      ${row('Uhrzeit', escapeHtml(v.time) + ' Uhr')}
      ${row('Personen', String(v.guests))}
      ${v.message ? row('Nachricht', msgHtml) : ''}
    </table>
    <p style="margin:20px 0 0;font-size:14px;color:#7a6a5c">Hinweis: Musterpub ist ein erfundener Betrieb, es gibt keinen echten Tisch.</p>`),
    text: [`Hallo ${v.name},`, '', 'das sind deine Angaben aus der Design-Demo:', '', `Datum: ${dateLong}`, `Uhrzeit: ${v.time} Uhr`,
      `Personen: ${v.guests}`, ...(v.message ? [`Nachricht: ${v.message}`] : []), '',
      'Hinweis: Musterpub ist ein erfundener Betrieb, es gibt keinen echten Tisch.'].join('\n')
  };
  return { owner, guest };
}

async function sendResend(fetchFn, apiKey, payload) {
  const res = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignorieren */ }
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/** Plattformneutrale Verarbeitung. Gibt { status, body } zurück. */
export async function handleReservation(body, ctx) {
  const { env, fetchFn = fetch, nowFn = () => new Date(), log = console.error } = ctx;

  // Honeypot: Bots füllen das versteckte Feld aus. Unauffällige Antwort, aber kein Versand.
  if (body && typeof body === 'object' && body.website) return { status: 200, body: { ok: true } };

  const { error, value } = validate(body, berlinNow(nowFn()));
  if (error) return { status: 400, body: { error } };

  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.MAIL_TO) {
    log('Konfiguration unvollständig: RESEND_API_KEY, MAIL_FROM und MAIL_TO müssen gesetzt sein.');
    return { status: 500, body: { error: 'Der Reservierungsdienst ist noch nicht eingerichtet. Es wurde nichts gesendet.' } };
  }

  const mails = buildMails(value);
  try {
    await sendResend(fetchFn, env.RESEND_API_KEY, {
      from: env.MAIL_FROM, to: [env.MAIL_TO], reply_to: value.email,
      subject: mails.owner.subject, html: mails.owner.html, text: mails.owner.text
    });
  } catch (e) {
    log('Versand fehlgeschlagen:', e.message);
    return { status: 502, body: { error: 'Die Anfrage konnte nicht übermittelt werden. Es wurde nichts gesendet.' } };
  }

  let confirmationSent = false;
  if (String(env.CONFIRM_GUEST).toLowerCase() === 'true') {
    try {
      const payload = { from: env.MAIL_FROM, to: [value.email], subject: mails.guest.subject, html: mails.guest.html, text: mails.guest.text };
      if (env.MAIL_REPLY_TO) payload.reply_to = env.MAIL_REPLY_TO;
      await sendResend(fetchFn, env.RESEND_API_KEY, payload);
      confirmationSent = true;
    } catch (e) {
      log('Bestätigungsmail fehlgeschlagen:', e.message);
    }
  }
  return { status: 200, body: { ok: true, confirmationSent } };
}

/* ---------- Cloudflare-Worker-Einstieg mit CORS ---------- */
const allowedOrigins = (env) => String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ok = allowedOrigins(env).includes(origin);
    const json = (status, data) => new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(ok ? corsHeaders(origin) : {}) }
    });

    if (request.method === 'OPTIONS') return ok ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    if (request.method !== 'POST') return json(405, { error: 'Methode nicht erlaubt.' });
    if (!ok) return json(403, { error: 'Diese Seite darf den Reservierungsdienst nicht nutzen.' });

    let text;
    try { text = await request.text(); } catch { return json(400, { error: 'Ungültige Anfrage.' }); }
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'Anfrage zu groß.' });
    let body;
    try { body = JSON.parse(text); } catch { return json(400, { error: 'Ungültige Anfrage.' }); }

    const { status, body: out } = await handleReservation(body, { env });
    return json(status, out);
  }
};
