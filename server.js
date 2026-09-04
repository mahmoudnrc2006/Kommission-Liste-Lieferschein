// Etikett-Manager – einfacher Server
// - schützt die App mit EINEM gemeinsamen Passwort (Umgebungsvariable APP_PASSWORD)
// - Login läuft über ein signiertes Cookie (JWT) – KEIN Session-Speicher auf der
//   Festplatte nötig. Das ist wichtig, weil kostenlose Render-Webservices die
//   Festplatte bei jedem Neustart/Einschlafen komplett leeren.
// - Der eigentliche Programmzustand wird bei Upstash Redis gespeichert (kostenloses
//   Konto nötig) – das bleibt dauerhaft erhalten, unabhängig vom Server selbst.

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const APP_PASSWORD = process.env.APP_PASSWORD || 'aendern-bitte';
const JWT_SECRET = process.env.SESSION_SECRET; // MUSS in Render gesetzt werden!
if (!JWT_SECRET) {
  console.warn('⚠️  SESSION_SECRET ist nicht gesetzt! Bitte in den Umgebungsvariablen setzen,');
  console.warn('   sonst werden alle Logins bei jedem Neustart des Servers ungültig.');
}
const EFFECTIVE_SECRET = JWT_SECRET || 'nur-fuer-lokale-tests-nicht-sicher';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY = 'etikett_manager_state';

app.use(express.json({ limit: '15mb' }));
app.use(express.text({ type: 'application/json', limit: '15mb' })); // für sendBeacon-Requests beim Verlassen der Seite
app.use(cookieParser());

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.auth;
  if (!token) return res.status(401).json({ error: 'not_authenticated' });
  try {
    jwt.verify(token, EFFECTIVE_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
}

// ── Login / Logout (zustandslos über signiertes Cookie) ─────────
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === APP_PASSWORD) {
    const token = jwt.sign({ authed: true }, EFFECTIVE_SECRET, { expiresIn: '30d' });
    res.cookie('auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'falsches_passwort' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const token = req.cookies && req.cookies.auth;
  if (!token) return res.json({ authed: false });
  try {
    jwt.verify(token, EFFECTIVE_SECRET);
    res.json({ authed: true });
  } catch (e) {
    res.json({ authed: false });
  }
});

// ── Upstash Redis REST Hilfsfunktionen ───────────────────────────
async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Upstash ist nicht konfiguriert (Umgebungsvariablen fehlen)');
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Upstash GET fehlgeschlagen: ${res.status}`);
  const data = await res.json();
  return data.result; // string oder null
}

async function redisSet(key, value) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Upstash ist nicht konfiguriert (Umgebungsvariablen fehlen)');
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'text/plain' },
    body: value
  });
  if (!res.ok) throw new Error(`Upstash SET fehlgeschlagen: ${res.status}`);
  return true;
}

// ── Programmzustand laden/speichern (ein großes JSON-Objekt) ────
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const raw = await redisGet(STATE_KEY);
    res.type('application/json').send(raw || '{}');
  } catch (e) {
    console.error('Lesefehler:', e.message);
    res.status(500).json({ error: 'lesefehler', details: e.message });
  }
});

app.post('/api/state', requireAuth, async (req, res) => {
  try {
    // req.body kann bereits geparstes JSON sein (fetch) oder ein roher String (sendBeacon)
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    await redisSet(STATE_KEY, bodyStr);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Schreibfehler:', e.message);
    res.status(500).json({ error: 'schreibfehler', details: e.message });
  }
});

// ── Statische Dateien (die eigentliche App) ──────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Etikett-Manager Server läuft auf Port ${PORT}`);
  console.log(`Upstash konfiguriert: ${UPSTASH_URL ? 'ja' : 'NEIN – bitte Umgebungsvariablen setzen!'}`);
});
