# gmail-txn-parser — CLAUDE.md

**Branch note**: this is the `gmail-sms-shortcut` branch — same
Mac-independent, cloud-deployable base as `gmail-only`, plus SMS-only
bank alerts ingested via an iOS Shortcuts automation that POSTs the SMS
to this server's `/api/sms-ingest` the moment it arrives, instead of
`main`'s Mac/`chat.db` read. No Mac needed for either email or SMS on
this branch. See "Branching" below.

## What this is
A personal tool: watches your Gmail for bank transaction alerts, parses
them into structured data, categorizes spend, and lets you split expenses
with friends via a PWA on your phone — a self-hosted mini-Splitwise
triggered by your own real spending instead of manual entry.

**Not for distribution as a hosted service.** No App Store, no
multi-user auth. This repo is a personal project meant to be **forked
and adapted** — clone it, point it at your own Gmail/banks, and make it
yours.

## Current status
Proven and working end-to-end against real bank data:
- **Email parsing** (`bankParsers.js` + `test.js`): IndusInd, SBI Card,
  ICICI (debit-card purchase + account credit), HDFC (credit card + two
  UPI templates), Axis Bank. Sender allowlist means non-bank mail (promo,
  tax refunds, payment-failed notices) is ignored by construction.
- **Reliability**: a message from a known sender whose template doesn't
  match any regex falls back to an LLM extraction (`llmFallback.js`)
  rather than being dropped. If *that* also fails, it's stored flagged
  `needsReview` (raw text preserved) instead of silently lost, and
  auto-retried on every subsequent fetch until it resolves.
- **Categorization** (`categorize.js`): deterministic keyword-based, not
  an LLM call — editable per-transaction if it guesses wrong.
- **Storage + splitting** (`db.js`, `cli.js`): flat-JSON store, full
  ingest → categorize → split (including custom per-friend amounts, not
  just even-split) → settle loop.
- **PWA** (`server.js` + `public/`): day-wise transaction list, Trends
  (spend charts), a "possibly shareable" suggestion tab (transparent
  category+amount heuristic, not a trained model), Ledger.
- **Scheduling**: a `launchd` job polls Gmail on an interval; a second
  runs the PWA server continuously. (`launchd` is macOS-specific — swap
  for `cron`/`systemd` on Linux; see "Deploying to the cloud" below.)

## File map
```
bankParsers.js       regex extraction per bank sender, pure functions, no I/O
smsParsers.js          regex extraction per bank SMS sender, pure functions, no I/O
categorize.js         deterministic merchant -> category keyword matcher
llmFallback.js         Groq API call, used only when a known sender's regex misses
db.js                  flat-JSON local store: transactions, friends, splits, ledger, dedupe, needs-review
auth.js                 Google OAuth2 loopback flow for this script's own Gmail access
fetchAndParse.js        Gmail -> bankParsers -> db.js
fetch-all.sh              thin wrapper (just fetchAndParse.js on this branch); used by launchd + the PWA's refresh button
cli.js                    review/split/settle from the terminal
server.js                  PWA backend: REST API + static file serving + POST /api/sms-ingest (SMS webhook)
public/                     PWA frontend (vanilla JS, no build step, no framework)
test.js / test-sms.js / test-split-flow.js   fixtures pulled from real messages + isolated db.js logic tests
webhook.js                  sketch only, unused — future push-based path (Gmail watch + Pub/Sub) if polling ever feels slow
README.md / LIVE_SETUP.md    human-facing docs
```

## Key decisions, and why (don't relitigate without cause)
1. **Sender allowlist, not keyword blocklist.** Only mail from a known
   bank sender is even parsed — this is what makes promo/tax/
   payment-failed noise disappear without extra filtering logic.
2. **Flat JSON file (`db.json`), not SQLite.** Personal-scale data, and
   this avoids a native-module compile step (`better-sqlite3` needs
   node-gyp) for zero benefit at this scale.
3. **Idempotency via Gmail's `messageId`**, plus cross-source dedupe
   in `db.js` in case any future source could double-report the same
   transaction.
4. **Parser flags `needsLLMFallback` instead of calling the LLM itself.**
   Keeps `bankParsers.js` pure and synchronous — easy to unit test with
   zero mocking.
5. **Never silently drop a transaction.** If even the LLM fallback fails,
   it's stored as `needsReview` with the raw text intact, not discarded.
   Retried automatically on every future fetch.
6. **Declined transactions and credits are excluded from the "unsplit"
   list** in `db.js`. No money left the account on a decline; a credit
   isn't a shared expense by default.
7. **No new dependencies without a real reason.** The JSON-file store
   and the plain `node:http` PWA server exist specifically to avoid
   native-compile dependencies and keep this forkable/deployable without
   a build step.

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
- Every new bank parser ships with a real fixture in `test.js` — pulled
  from an actual message, not invented — before being considered done.
- Don't add dependencies without a real reason.
- `db.json`, `token.json`, and `credentials.json` contain real financial
  data / live credentials — never commit them (see `.gitignore`).

## Branching
- `main` — full version, includes SMS parsing (`smsParsers.js`,
  `fetchSms.js`) for banks that only alert by SMS, via a Mac's local
  Messages database. Requires a Mac kept awake, Full Disk Access grants.
- `gmail-only` — email-only, no Mac/SMS dependency, deployable anywhere
  Node runs. Chosen when the tradeoff (losing SMS-only banks entirely)
  is worth simplifying the deployment story.
- `gmail-sms-shortcut` (this branch) — `gmail-only`'s cloud-deployable
  base plus SMS-only bank alerts, but sourced from an iOS Shortcuts
  automation pushing to `POST /api/sms-ingest` instead of a Mac's
  `chat.db`. Gets SMS coverage *and* stays Mac-independent — the
  Shortcut runs on the phone that already receives the SMS, no
  intermediate device needed at all.

## Deploying to the cloud (this branch)
Since there's no `chat.db`/Mac dependency here, this can run on any
Linux VM or a free-tier cloud box:
1. Do the Google OAuth flow once locally (needs a browser), then copy
   just the resulting `token.json` to the server — the refresh token
   means no repeat browser auth there.
2. Copy `credentials.json` over too (or provision fresh ones for the
   server's own Google Cloud project).
3. Replace the `launchd` jobs with `cron` entries or a `systemd` timer
   calling `fetch-all.sh` on the same interval, and a `systemd` service
   (or just `pm2`/`forever`) keeping `server.js` running continuously.
4. Tailscale still works identically installed on the cloud box instead
   of a Mac — same private-network model, nothing publicly exposed.
5. Set `SMS_INGEST_SECRET` alongside the other env vars if you're using
   the iOS Shortcuts SMS path (`LIVE_SETUP.md` step 5) — the server
   needs to be reachable from your phone (same URL the PWA itself uses)
   for the Shortcut's POST to land.

## Setting this up for your own use
Walk `LIVE_SETUP.md` end to end. Your bank almost certainly uses a
different email template than the ones already parsed here — the
existing parsers are a reference implementation, not a universal one.
Expect to add your own bank(s) the same way every one here was added:
find the real sender address, pull a real sample message, write the
regex, add the fixture, confirm the test passes.
