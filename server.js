const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const db = require('./db');
const { CATEGORIES } = require('./categorize');
const { parseTransactionSms } = require('./smsParsers');
const { llmFallbackExtract } = require('./llmFallback');
const stats = require('./pipelineStats');

const PORT = 4173;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'db.json');
const START_TIME = Date.now();

// Cheap brute-force guard for the two unauthenticated endpoints
// (/api/login and /api/sms-ingest — the only routes reachable without a
// valid session or secret already). Fixed-window per-IP counter, reset
// every minute; in-memory only is fine since a PM2 restart just resets
// the window, and this is a single-user server, not a target worth a
// distributed rate limiter.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitHits = new Map(); // ip -> { count, windowStart }

function isRateLimited(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// Session auth — only meaningful when this server is reachable publicly
const SESSIONS_FILE = path.join(__dirname, '.sessions.json');
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')));
    }
  } catch {}
  return new Set();
}
function saveSessions(set) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(set)));
  } catch {}
}
const sessions = loadSessions();
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
  const cookieToken = parseCookies(req).session;
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearerToken || cookieToken;
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
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
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

  // Prevent path traversal outside public/ — the trailing separator stops a
  // sibling dir whose name happens to start with "public" (e.g. "public-evil")
  // from passing a bare startsWith() prefix check.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(content);
  });
}

function safeIsoDate(dStr) {
  if (!dStr) return new Date().toISOString();
  try {
    const parsed = new Date(dStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    // Parse DD/MM/YYYY or DD-MM-YYYY formats commonly emitted by iOS Shortcuts
    const ddmmyyyy = String(dStr).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (ddmmyyyy) {
      let day = parseInt(ddmmyyyy[1], 10);
      let month = parseInt(ddmmyyyy[2], 10) - 1;
      let year = parseInt(ddmmyyyy[3], 10);
      if (year < 100) year += 2000;
      let hours = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
      let mins = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
      let secs = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0;
      const meridiem = ddmmyyyy[7] ? ddmmyyyy[7].toLowerCase() : null;
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      const customDate = new Date(Date.UTC(year, month, day, hours, mins, secs));
      if (!isNaN(customDate.getTime())) return customDate.toISOString();
    }

    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Handles a single incoming SMS forwarded from the iOS Shortcuts automation
// (see LIVE_SETUP.md) — same regex-first, LLM-fallback, needsReview-safety-net
// pipeline as fetchAndParse.js/fetchSms.js, just triggered by a push instead
// of a poll. messageId is derived (sender+text+date hash) since Shortcuts has
// no equivalent to Gmail's messageId — same value every time the same SMS is
// forwarded, so retried/duplicate deliveries from the Shortcut are naturally
// idempotent via db.js's existing dedupe-by-id check.
async function handleSmsIngest(req, res) {
  const body = await readBody(req);
  const sender = body.sender || body.Sender || body.from || body.From || body.textSender || 'SMS';
  const text = body.text || body.Text || body.content || body.Content || body.body || body.Body || body.message || body.Message || '';
  const date = body.date || body.Date || body.time || body.Time || body.timestamp;

  if (!text) return sendJson(res, 400, { error: 'text payload is required' });

  const isoDate = safeIsoDate(date);
  const id = crypto.createHash('sha1').update(`${sender}|${text}|${isoDate}`).digest('hex');

  stats.recordEvent('smsProcessed');

  let result = parseTransactionSms({ sender, text });
  if (!result) return sendJson(res, 200, { ok: true, stored: false, reason: 'not a known SMS sender' });
  if (result.notATransaction) {
    stats.recordEvent('filteredNotTransaction');
    return sendJson(res, 200, { ok: true, stored: false, reason: 'not a transaction' });
  }

  if (result.needsLLMFallback) {
    stats.recordEvent('aiFallbackCalled');
    stats.recordUnmatchedTemplate(result.sourceParser, result.rawText);

    // Send HTTP 200 OK response IMMEDIATELY (prevents iOS Shortcut 10s HTTP timeout)
    sendJson(res, 200, { ok: true, stored: true, needsReview: true });

    // Asynchronously resolve LLM fallback in background — call the LLM
    // FIRST, then store exactly once: resolved data if the LLM succeeds
    // (goes straight through the matching engine, no needsReview gap),
    // or a needsReview placeholder only if the LLM actually fails.
    (async () => {
      try {
        const extracted = await llmFallbackExtract(result.rawText);
        stats.recordEvent('aiFallbackSuccess');
        if (extracted.notATransaction) {
          stats.recordEvent('filteredNotTransaction');
          return;
        }
        const isNew = await db.upsertTransaction(id, resolved, isoDate);
        if (isNew) {
          stats.recordEvent('transactionsProduced');
        } else {
          stats.recordEvent('transactionsDeduplicated');
        }
      } catch (err) {
        stats.recordEvent('aiFallbackFailure');
        stats.recordEvent('needsReview');
        // LLM failed — store as needsReview so the raw text isn't lost
        // and retryNeedsReview can heal it on a future fetch run.
        try {
          await db.upsertTransaction(id, {
            needsReview: true,
            sourceParser: result.sourceParser,
            rawText: result.rawText,
            sender,
          }, isoDate);
        } catch (dbErr) {
          console.error('[SMS Ingest needsReview DB Error]:', dbErr);
        }
      }
    })();
    return;
  }

  stats.recordEvent('deterministicMatch');
  sendJson(res, 200, { ok: true, stored: true });

  (async () => {
    try {
      const isNew = await db.upsertTransaction(id, result, isoDate);
      if (isNew) {
        stats.recordEvent('transactionsProduced');
      } else {
        stats.recordEvent('transactionsDeduplicated');
      }
    } catch (err) {
      console.error('[SMS Ingest DB Error]:', err);
    }
  })();
  return;
}

async function handleApi(req, res, urlPath) {
  try {
    // Unauthenticated (no session/PM2 auth) health probe — used by the
    // GCP VM's monitoring loop, deliberately excluded from rate limiting
    // and the auth gate below since it carries no user data.
    if (req.method === 'GET' && urlPath === '/api/health') {
      let dbOk = true;
      try {
        fs.accessSync(DB_PATH, fs.constants.R_OK);
      } catch {
        dbOk = false;
      }
      return sendJson(res, dbOk ? 200 : 503, {
        ok: dbOk,
        uptimeSec: Math.floor((Date.now() - START_TIME) / 1000),
        dbReadable: dbOk,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'POST' && (urlPath === '/api/sms-ingest' || urlPath === '/api/login') && isRateLimited(req)) {
      return sendJson(res, 429, { error: 'Too many requests, try again shortly' });
    }

    if (req.method === 'POST' && urlPath === '/api/sms-ingest') {
      const expected = process.env.SMS_INGEST_SECRET || '';
      if (expected.length > 0) {
        const given = req.headers['x-sms-secret'] || '';
        const match =
          given.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
        if (!match) return sendJson(res, 401, { error: 'Invalid or missing secret' });
      }
      return handleSmsIngest(req, res);
    }

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
      saveSessions(sessions);
      res.setHeader(
        'Set-Cookie',
        `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${COOKIE_SECURE ? '; Secure' : ''}`
      );
      return sendJson(res, 200, { ok: true, token });
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
