import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleReservation, validate, escapeHtml } from '../worker/reserve.mjs';

// Fester Zeitpunkt: Samstag, 17.10.2026, 15:00 Uhr deutscher Zeit (13:00 UTC, Sommerzeit bis 25.10.)
const NOW = () => new Date('2026-10-17T13:00:00Z');
const ENV = { RESEND_API_KEY: 'test-key', MAIL_FROM: 'Demo <demo@example.test>', MAIL_TO: 'owner@example.test', ALLOWED_ORIGINS: 'https://demo.example.test' };

const good = (over = {}) => ({
  name: 'Erika Beispiel', email: 'erika@example.test', phone: '', date: '2026-10-24', time: '19:00',
  guests: 6, message: 'Test', website: '', consent: true, ...over
});

function mockFetch(results = []) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = results[calls.length - 1] ?? { ok: true };
    return { ok: r.ok, status: r.ok ? 200 : 500, text: async () => 'fail' };
  };
  fn.calls = calls;
  return fn;
}
const ctx = (f, env = ENV) => ({ env, fetchFn: f, nowFn: NOW, log: () => {} });

test('gültige Anfrage: genau eine Mail an MAIL_TO, keine Bestätigung an Dritte (Standard)', async () => {
  const f = mockFetch();
  const r = await handleReservation(good(), ctx(f));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, confirmationSent: false });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.resend.com/emails');
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(f.calls[0].body.to, ['owner@example.test']);
  assert.equal(f.calls[0].body.reply_to, 'erika@example.test');
  assert.match(f.calls[0].body.subject, /^\[Musterpub-Demo\] .*24\.10\.2026 19:00 Uhr, 6 Pers\./);
});

test('CONFIRM_GUEST=true sendet zusätzlich die Bestätigung', async () => {
  const f = mockFetch();
  const r = await handleReservation(good(), ctx(f, { ...ENV, CONFIRM_GUEST: 'true' }));
  assert.equal(r.body.confirmationSent, true);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].body.to, ['erika@example.test']);
});

test('Fehler bei der Bestätigung -> 200 mit confirmationSent:false', async () => {
  const f = mockFetch([{ ok: true }, { ok: false }]);
  const r = await handleReservation(good(), ctx(f, { ...ENV, CONFIRM_GUEST: 'true' }));
  assert.equal(r.status, 200);
  assert.equal(r.body.confirmationSent, false);
});

test('Personenzahl 1 bis 100', () => {
  const now = { date: '2026-10-17', minutes: 900 };
  for (const g of [1, 40, 100]) assert.ok(validate(good({ guests: g }), now).value);
  for (const g of [0, 101, 2.5, 'abc']) assert.ok(validate(good({ guests: g }), now).error);
});

test('Öffnungszeiten der Demo je Wochentag', () => {
  const now = { date: '2026-10-17', minutes: 900 };
  // Montag 2026-10-19: 18:00–22:00
  assert.ok(validate(good({ date: '2026-10-19', time: '18:00' }), now).value);
  assert.ok(validate(good({ date: '2026-10-19', time: '22:00' }), now).value);
  assert.ok(validate(good({ date: '2026-10-19', time: '17:30' }), now).error);
  assert.ok(validate(good({ date: '2026-10-19', time: '22:30' }), now).error);
  // Sonntag 2026-10-18: 14:00–21:00
  assert.ok(validate(good({ date: '2026-10-25', time: '14:00' }), now).value);
  assert.ok(validate(good({ date: '2026-10-25', time: '21:30' }), now).error);
  // Freitag 2026-10-23: bis 23:30
  assert.ok(validate(good({ date: '2026-10-23', time: '23:30' }), now).value);
  assert.ok(validate(good({ date: '2026-10-23', time: '17:10' }), now).error);
});

test('Vergangenheit, zu kurzfristig, zu weit in der Zukunft, ungültiges Datum', () => {
  const now = { date: '2026-10-17', minutes: 15 * 60 };
  assert.ok(validate(good({ date: '2026-10-16', time: '19:00' }), now).error);
  assert.equal(validate(good({ date: '2026-10-17', time: '17:00' }), now).error, undefined);
  assert.ok(validate(good({ date: '2026-10-17', time: '17:00' }), { ...now, minutes: 16 * 60 + 30 }).error);
  assert.ok(validate(good({ date: '2027-03-01', time: '19:00' }), now).error);
  assert.ok(validate(good({ date: '2026-02-30', time: '19:00' }), now).error);
});

test('Pflichtfelder, Einwilligung, E-Mail-Format', () => {
  const now = { date: '2026-10-17', minutes: 900 };
  assert.ok(validate(good({ name: '' }), now).error);
  assert.ok(validate(good({ email: 'kein-email' }), now).error);
  assert.ok(validate(good({ consent: false }), now).error);
  assert.ok(validate(good({ message: 'x'.repeat(501) }), now).error);
  assert.ok(validate(null, now).error);
});

test('Ungültige Eingaben lösen keinen Versand aus; Honeypot ebenfalls nicht', async () => {
  let f = mockFetch();
  assert.equal((await handleReservation(good({ time: '03:00' }), ctx(f))).status, 400);
  assert.equal(f.calls.length, 0);
  f = mockFetch();
  const r = await handleReservation(good({ website: 'http://spam.example' }), ctx(f));
  assert.equal(r.status, 200);
  assert.equal(f.calls.length, 0);
});

test('HTML in Eingaben wird escaped, Zeilenumbrüche kommen nicht in den Betreff', async () => {
  const f = mockFetch();
  await handleReservation(good({ name: '<script>alert(1)</script>\r\nBcc: x@example.test', message: '<img src=x onerror=alert(1)>' }), ctx(f));
  const c = f.calls[0].body;
  assert.ok(!c.html.includes('<script>') && !c.html.includes('<img src=x'));
  assert.ok(c.html.includes('&lt;script&gt;'));
  assert.ok(!/[\r\n]/.test(c.subject));
  assert.equal(escapeHtml(`"&'<>`), '&quot;&amp;&#39;&lt;&gt;');
});

test('Resend-Fehler -> 502, fehlende Konfiguration -> 500, jeweils ehrliche Meldung', async () => {
  let r = await handleReservation(good(), ctx(mockFetch([{ ok: false }])));
  assert.equal(r.status, 502);
  assert.match(r.body.error, /nichts gesendet/);
  const f = mockFetch();
  r = await handleReservation(good(), ctx(f, { RESEND_API_KEY: 'x' }));
  assert.equal(r.status, 500);
  assert.equal(f.calls.length, 0);
});

/* ---------- Worker-Einstieg / CORS ---------- */
const req = (method, origin, body) => new Request('https://worker.example.test/', {
  method, headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body)
});

test('CORS: erlaubte Origin wird gespiegelt, fremde und fehlende werden abgelehnt', async () => {
  let res = await worker.fetch(req('OPTIONS', 'https://demo.example.test'), ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://demo.example.test');
  res = await worker.fetch(req('OPTIONS', 'https://evil.example'), ENV);
  assert.equal(res.status, 403);
  res = await worker.fetch(req('POST', 'https://evil.example', good()), ENV);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  res = await worker.fetch(req('POST', '', good()), ENV);
  assert.equal(res.status, 403);
  res = await worker.fetch(req('GET', 'https://demo.example.test'), ENV);
  assert.equal(res.status, 405);
});

test('Worker lehnt kaputtes JSON und zu große Bodies ab', async () => {
  let res = await worker.fetch(new Request('https://w.test/', { method: 'POST', headers: { Origin: 'https://demo.example.test' }, body: '{kaputt' }), ENV);
  assert.equal(res.status, 400);
  res = await worker.fetch(new Request('https://w.test/', { method: 'POST', headers: { Origin: 'https://demo.example.test' }, body: 'x'.repeat(10_001) }), ENV);
  assert.equal(res.status, 413);
});
