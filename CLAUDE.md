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
- **SMS parsing** (`smsParsers.js` + `test-sms.js`): ICICI Bank (UPI debit + card debit)
  and OneCard SMS parsing.
- **Pre-filtering** (`nonTransactional.js`): drops OTPs, app activation alerts,
  and login notifications before AI fallback, gated on absence of completion verbs.
- **Multi-source reconciliation** (`matchingEngine.js` + `bankSourceConfig.js`):
  4-level matching hierarchy (1: refNo exact match, 2: tight window deterministic,
  3: weighted similarity score, 4: AI arbitration). Excludes same-channel auto-merging
  at levels 2-3 to prevent false-positive merges.
- **Reliability & LLM Fallback**: a message from a known sender whose template doesn't
  match any regex falls back to an LLM extraction (`llmFallback.js`)
  rather than being dropped. If *that* also fails, it's stored flagged
  `needsReview` (raw text preserved) instead of silently lost, and
  auto-retried on every subsequent fetch until it resolves.
- **Pipeline stats & tracking** (`pipelineStats.js`): logs pipeline counters
  and captures redacted signatures of unparsed message shapes (`node cli.js unmatched-templates`).
- **Categorization** (`categorize.js`): deterministic keyword-based, not
  an LLM call — editable per-transaction if it guesses wrong.
- **Storage + splitting** (`db.js`, `cli.js`): flat-JSON store supporting `sourceMessages`
  and canonical `transactions`, full ingest → categorize → split → settle loop.
- **PWA & Ops** (`server.js` + `public/` + `OPERATIONS.md`): day-wise transaction list,
  Trends, Suggested splits, Ledger, `/api/health` health check endpoint, and PM2 deployment runbook.

## File map
```
bankParsers.js              regex extraction per bank email sender, pure functions, no I/O
smsParsers.js                 regex extraction per bank SMS sender, pure functions, no I/O
bankSourceConfig.js           declares expected alert channels (email, SMS, or both) per bank
nonTransactional.js           pre-filter for OTPs, app activation alerts, and non-transaction noise
matchingEngine.js             4-level source reconciliation hierarchy (refNo, tight window, weighted score, LLM)
merchantNormalize.js          merchant text normalization & string similarity scoring
pipelineStats.js              pipeline instrumentation counters & redacted unmatched-template log
categorize.js                deterministic merchant -> category keyword matcher
llmFallback.js                OpenRouter API call for unmatched templates or ambiguous reconciliation
db.js                         flat-JSON local store: transactions, sourceMessages, friends, splits, ledger
auth.js                        Google OAuth2 loopback flow for Gmail API access
fetchAndParse.js               Gmail -> bankParsers -> db.js
fetch-all.sh                     thin wrapper (just fetchAndParse.js on this branch); used by scheduler + PWA refresh
cli.js                           review/split/settle + pipeline stats (`unmatched-templates`, `stats`)
server.js                     PWA backend: REST API + health check (/api/health) + POST /api/sms-ingest
migrate-source-messages.js    idempotent migration utility to upgrade pre-existing transactions to multi-source schema
public/                        PWA frontend (vanilla JS, no build step, no framework)
test.js / test-sms.js / ...   test suites for parsers, matching, filtering, stats, dedup, and splits
OPERATIONS.md                 ops runbook: health checks, PM2 process management, backups, VM deploys
README.md / LIVE_SETUP.md    human-facing docs
```

## Key decisions, and why (don't relitigate without cause)
1. **Sender allowlist, not keyword blocklist.** Only mail from a known
   bank sender is even parsed — this is what makes promo/tax/
   payment-failed noise disappear without extra filtering logic.
2. **Flat JSON file (`db.json`), not SQLite.** Personal-scale data, and
   this avoids a native-module compile step (`better-sqlite3` needs
   node-gyp) for zero benefit at this scale.
3. **Multi-source reconciliation via `matchingEngine.js`.** Incoming source
   messages (`db.sourceMessages`) are stored individually and matched against
   canonical transactions (`db.transactions`). Same-channel auto-merging at
   levels 2-3 is blocked to prevent false-positive merges.
4. **In-process write lock (`withWriteLock`) in `db.js`.** Serializes async
   matching & database writes to prevent race conditions during concurrent ingestion
   (e.g., SMS webhook firing during a Gmail poll).
5. **Parser flags `needsLLMFallback` instead of calling the LLM itself.**
   Keeps `bankParsers.js` pure and synchronous — easy to unit test with
   zero mocking.
6. **Never silently drop a transaction.** If even the LLM fallback fails,
   it's stored as `needsReview` with the raw text intact, not discarded.
   Retried automatically on every future fetch.
7. **Declined transactions and credits are excluded from the "unsplit"
   list** in `db.js`. No money left the account on a decline; a credit
   isn't a shared expense by default.
8. **No new dependencies without a real reason.** The JSON-file store
   and the plain `node:http` PWA server exist specifically to avoid
   native-compile dependencies and keep this forkable/deployable without
   a build step.

## Data shapes
Transaction (as stored in `db.json`):
```
{ id, date, bank, instrument, last4|account, amount, currency,
  merchant, type: 'debit'|'credit', status, rawDate, category,
  splitStatus: 'unsplit'|'personal'|'split',
  sourceIds: [...], sourcesMatched?: [{ sourceId, method, confidence, timestamp }],
  acknowledged?, needsReview?, rawText?, lastFailureReason? }
```
SourceMessage: `{ id, sourceType: 'email'|'sms', rawText, parsed, canonicalTransactionId, createdAt }`
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
