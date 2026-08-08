const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const db = require('./db');
const { CATEGORIES } = require('./categorize');

const PORT = 4173;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Session auth — only meaningful when this server is reachable publicly
// (behind Caddy/HTTPS on the cloud deployment). Sessions live in memory
// only; a restart just means logging in again, acceptable for a single
// personal user. COOKIE_SECURE should be set once actually served over
// HTTPS — plain http://localhost testing needs it unset, since browsers
// never send a Secure cookie back over plain HTTP.
const sessions = new Set();
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return cookies;
}

function isAuthed(req) {
  if (!process.env.APP_PASSWORD) return true; // no password configured -> auth disabled (local dev default)
  const token = parseCookies(req).session;
  return !!token && sessions.has(token);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  const relative = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, relative);

  // Prevent path traversal outside public/
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleApi(req, res, urlPath) {
  try {
    if (req.method === 'POST' && urlPath === '/api/login') {
      const { password } = await readBody(req);
      const expected = process.env.APP_PASSWORD || '';
      const given = password || '';
      // Constant-time compare, but only when lengths already match —
      // timingSafeEqual throws on mismatched buffer lengths, so a
      // length check first (itself not timing-sensitive information,
      // since password length isn't the secret here) avoids that.
      const match =
        expected.length > 0 &&
        given.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
      if (!match) return sendJson(res, 401, { error: 'Incorrect password' });

      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      res.setHeader(
        'Set-Cookie',
        `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${COOKIE_SECURE ? '; Secure' : ''}`
      );
      return sendJson(res, 200, { ok: true });
    }

    if (!isAuthed(req)) {
      return sendJson(res, 401, { error: 'Not authenticated' });
    }

    if (req.method === 'GET' && urlPath === '/api/transactions') {
      return sendJson(res, 200, db.listAll());
    }
    const txnDetailMatch = urlPath.match(/^\/api\/transactions\/([^/]+)$/);
    if (req.method === 'GET' && txnDetailMatch) {
      const txn = db.getTransaction(decodeURIComponent(txnDetailMatch[1]));
      if (!txn) return sendJson(res, 404, { error: 'Unknown transaction' });
      return sendJson(res, 200, txn);
    }
    if (req.method === 'POST' && urlPath === '/api/acknowledge') {
      const { transactionId, acknowledged } = await readBody(req);
      if (!transactionId) return sendJson(res, 400, { error: 'transactionId is required' });
      db.setAcknowledged(transactionId, acknowledged);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && urlPath === '/api/retry-review') {
      const { transactionId } = await readBody(req);
      if (!transactionId) return sendJson(res, 400, { error: 'transactionId is required' });
      const healed = await db.retryNeedsReview(transactionId);
      return sendJson(res, 200, { ok: true, healed });
    }
    if (req.method === 'POST' && urlPath === '/api/category') {
      const { transactionId, category } = await readBody(req);
      if (!transactionId || !category) return sendJson(res, 400, { error: 'transactionId and category are required' });
      db.setCategory(transactionId, category);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && urlPath === '/api/unsplit') {
      return sendJson(res, 200, db.listUnsplit());
    }
    if (req.method === 'GET' && urlPath === '/api/categories') {
      return sendJson(res, 200, CATEGORIES);
    }
    if (req.method === 'GET' && urlPath === '/api/friends') {
      return sendJson(res, 200, db.listFriends());
    }
    if (req.method === 'GET' && urlPath === '/api/ledger') {
      return sendJson(res, 200, db.ledger());
    }
    if (req.method === 'POST' && urlPath === '/api/split') {
      const { transactionId, friends, customShares } = await readBody(req);
      if (!transactionId || !Array.isArray(friends) || friends.length === 0) {
        return sendJson(res, 400, { error: 'transactionId and friends[] are required' });
      }
      const shares = db.splitTransaction(transactionId, friends, customShares);
      return sendJson(res, 200, { shares });
    }
    if (req.method === 'POST' && urlPath === '/api/personal') {
      const { transactionId } = await readBody(req);
      if (!transactionId) return sendJson(res, 400, { error: 'transactionId is required' });
      db.markPersonal(transactionId);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && urlPath === '/api/settle') {
      const { friendName, amount } = await readBody(req);
      if (!friendName) return sendJson(res, 400, { error: 'friendName is required' });
      db.settle(friendName, amount);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && urlPath === '/api/refresh') {
      return execFile('./fetch-all.sh', [], { cwd: __dirname, timeout: 60000 }, (err, stdout, stderr) => {
        const output = [stdout, stderr, err && !stderr ? err.message : ''].filter(Boolean).join('\n');
        sendJson(res, 200, { ok: !err, output });
      });
    }
    sendJson(res, 404, { error: 'Unknown route' });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath.startsWith('/api/')) {
    handleApi(req, res, urlPath);
  } else {
    serveStatic(req, res, urlPath);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`gmail-txn-parser server listening on http://0.0.0.0:${PORT}`);
});
