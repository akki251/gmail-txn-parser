# gmail-txn-parser — CLAUDE.md

## What this is
A personal, local-only tool: watches your Gmail (and optionally SMS, via
your Mac) for bank transaction alerts, parses them into structured data,
categorizes spend, and lets you split expenses with friends via a PWA on
your phone — a self-hosted mini-Splitwise triggered by your own real
spending instead of manual entry.

**Not for distribution as a hosted service.** No App Store, no
multi-user auth, no cloud hosting requirement. Runs on your own machine,
for your own use, on your own financial data. This repo is a personal
project meant to be **forked and adapted** — clone it, point it at your
own Gmail/banks, and make it yours. Keep the "runs on your machine, your
data never leaves it" property unless you deliberately choose to change
that for your own fork.

## Current status
Proven and working end-to-end against real bank data:
- **Email parsing** (`bankParsers.js` + `test.js`): IndusInd, SBI Card,
  ICICI (debit-card purchase + account credit), HDFC (credit card + two
  UPI templates), Axis Bank. Sender allowlist means non-bank mail (promo,
  tax refunds, payment-failed notices) is ignored by construction.
- **SMS parsing** (`smsParsers.js` + `fetchSms.js`): for banks that only
  alert by SMS (no email), read from your Mac's `chat.db` via iPhone Text
  Message Forwarding. See `LIVE_SETUP.md` for the two permission grants
  this needs.
- **Reliability**: a message from a known sender whose template doesn't
  match any regex falls back to an LLM extraction (`llmFallback.js`)
  rather than being dropped. If *that* also fails, it's stored flagged
  `needsReview` (raw text preserved) instead of silently lost, and
  auto-retried on every subsequent fetch until it resolves.
- **Cross-source dedupe** (`db.js`): the same real transaction arriving
  via two channels (e.g. email + SMS) is recognized via UPI reference
  number first, falling back to same-bank/amount/type within a 5-minute
  window, and not double-stored.
- **Categorization** (`categorize.js`): deterministic keyword-based, not
  an LLM call — editable per-transaction if it guesses wrong.
- **Storage + splitting** (`db.js`, `cli.js`): flat-JSON store, full
  ingest → categorize → split → settle loop.
- **PWA** (`server.js` + `public/`): day-wise transaction list, Trends
  (spend charts), a "possibly shareable" suggestion tab (transparent
  category+amount heuristic, not a trained model), Ledger, all reachable
  from your phone via Tailscale.
- **Scheduling**: two `launchd` jobs (see `LIVE_SETUP.md`) — one polls
  Gmail+SMS on an interval, one runs the PWA server continuously.

## File map
```
bankParsers.js       regex extraction per bank sender (email), pure functions, no I/O
smsParsers.js        regex extraction per bank sender (SMS), same shape as bankParsers.js
categorize.js         deterministic merchant -> category keyword matcher
llmFallback.js         Groq API call, used only when a known sender's regex misses
db.js                  flat-JSON local store: transactions, friends, splits, ledger, dedupe, needs-review
auth.js                 Google OAuth2 loopback flow for this script's own Gmail access
fetchAndParse.js        Gmail -> bankParsers -> db.js
fetchSms.js              chat.db -> smsParsers -> db.js
fetch-all.sh              runs both fetchers in sequence; used by launchd + the PWA's refresh button
cli.js                    review/split/settle from the terminal
server.js                  PWA backend: REST API + static file serving
public/                     PWA frontend (vanilla JS, no build step, no framework)
test.js / test-sms.js / test-split-flow.js   fixtures pulled from real messages + isolated db.js logic tests
webhook.js                  sketch only, unused — future push-based path (Gmail watch + Pub/Sub) if polling ever feels slow
README.md / LIVE_SETUP.md    human-facing docs
```

## Key decisions, and why (don't relitigate without cause)
1. **Sender allowlist, not keyword blocklist.** Only mail/SMS from a
   known bank sender is even parsed — this is what makes promo/tax/
   payment-failed noise disappear without extra filtering logic.
2. **Flat JSON file (`db.json`), not SQLite.** Personal-scale data, and
   this avoids a native-module compile step (`better-sqlite3` needs
   node-gyp) for zero benefit at this scale.
3. **Idempotency via a stable message ID** (Gmail `messageId` or SMS
   `guid`), plus cross-source dedupe on top for the same real transaction
   arriving via two channels.
4. **Parser flags `needsLLMFallback` instead of calling the LLM itself.**
   Keeps `bankParsers.js`/`smsParsers.js` pure and synchronous — easy to
   unit test with zero mocking.
5. **Never silently drop a transaction.** If even the LLM fallback fails,
   it's stored as `needsReview` with the raw text intact, not discarded.
   Retried automatically on every future fetch.
6. **Declined transactions and credits are excluded from the "unsplit"
   list** in `db.js`. No money left the account on a decline; a credit
   isn't a shared expense by default.
7. **No new dependencies without a real reason.** The JSON-file store,
   the plain `node:http` PWA server, and shelling out to the system
   `sqlite3` CLI (instead of a native SQLite binding) all exist
   specifically to avoid native-compile dependencies and keep this
   forkable without a build step.

## Data shapes
Transaction (as stored in `db.json`):
```
{ id, date, bank, instrument, last4|account, amount, currency,
  merchant, type: 'debit'|'credit', status, rawDate, category,
  splitStatus: 'unsplit'|'personal'|'split',
  acknowledged?, needsReview?, rawText?, lastFailureReason? }
```
Split: `{ id, transactionId, friendId, shareAmount, settled }`

## Non-negotiables
- Stays local-only: no cloud DB, no third-party analytics/telemetry.
- Every new bank parser (email or SMS) ships with a real fixture in
  `test.js`/`test-sms.js` — pulled from an actual message, not invented
  — before being considered done. This is the standard every parser in
  this repo has been held to.
- Don't add dependencies without a real reason.
- `db.json`, `token.json`, and `credentials.json` contain real financial
  data / live credentials — never commit them (see `.gitignore`).

## Setting this up for your own use
Walk `LIVE_SETUP.md` end to end — it covers Google Cloud OAuth setup,
the Groq API key, the two `launchd` jobs, and (optionally) SMS
forwarding + Tailscale for phone access. Your bank almost certainly uses
a different email/SMS template than the ones already parsed here — the
existing parsers are a reference implementation, not a universal one.
Expect to add your own bank(s) the same way every one here was added:
find the real sender address, pull a real sample message, write the
regex, add the fixture, confirm the test passes.
