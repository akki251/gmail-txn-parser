# gmail-txn-parser

**Branch: `gmail-sms-shortcut`** — cloud-deployable, no Mac required:
email parsing via Gmail's API plus SMS-only bank alerts pushed from an
iOS Shortcuts automation. See [Branching](#branching) for the other
branches.

A personal tool that watches your Gmail (and, optionally, SMS-only bank
alerts from your iPhone) for transaction notifications, parses them into
structured data, categorizes spend, and gives you a phone-installable
PWA to split expenses with friends — a self-hosted mini-Splitwise
triggered by your own real spending instead of manual entry.

No multi-user auth, no third-party analytics, no hosted service — your
financial data never leaves wherever you run this, except for the calls
you explicitly wire up (Gmail's own API to read your own inbox, and an
LLM call only for the rare message a regex can't parse).

## What it does

- **Parses real bank emails** into structured transactions — amount,
  merchant, date, bank, category — via deterministic regex per bank
  template, not an LLM by default. Supports IndusInd, SBI Card, ICICI
  (debit-card purchase + account credit), HDFC (credit card + two UPI
  templates), and Axis Bank out of the box; adding your own bank is
  straightforward (see `LIVE_SETUP.md`).
- **Parses SMS-only bank alerts too**, for banks that never email —
  ingested via an iOS Shortcuts automation that POSTs the SMS to this
  server the instant it arrives (`POST /api/sms-ingest`). No Mac, no
  `chat.db`, nothing that needs to stay awake.
- **Also parses Swiggy/Zomato order emails** (`merchantParsers.js`) to
  power the "possibly shareable" suggestion heuristic.
- **Never silently loses a transaction.** A message from a known sender
  whose exact template doesn't match falls back to an LLM extraction; if
  that also fails, it's stored flagged for review with the raw text
  intact and retried automatically on every future fetch — never dropped.
- **Categorizes spend** with an editable, deterministic keyword matcher
  — no LLM call needed for this.
- **Splits and settles** expenses with friends — even split or custom
  per-friend amounts — tracks a running ledger.
- **A PWA you install on your phone** — day-wise transaction list, spend
  trend charts, a "possibly shareable" suggestion tab (transparent
  category+amount heuristic, not a trained model), and a ledger view.
  Reachable from your phone via [Tailscale](https://tailscale.com), no
  public exposure.

## Screenshots

<p float="left">
  <img src="screenshots/transactions.png" width="200" alt="Transactions tab" />
  <img src="screenshots/suggested.png" width="200" alt="Suggested splits tab" />
  <img src="screenshots/ledger.png" width="200" alt="Ledger tab" />
  <img src="screenshots/trends.png" width="200" alt="Trends tab" />
</p>

*(shown with synthetic demo data, not real transactions)*

## Quick start

```
npm install
npm test           # bank email parser fixtures, real excerpts, no network needed
npm run test:sms   # SMS parser fixtures
npm run test:merchant  # Swiggy/Zomato parser fixtures
npm run test:split # split/ledger/dedupe logic, isolated from your real data
```

Then walk through **[`LIVE_SETUP.md`](LIVE_SETUP.md)** for the real
setup: your own Google Cloud OAuth credentials, a free Groq API key,
the iOS Shortcut for SMS ingestion, background scheduling, and phone
access via Tailscale.

## Architecture

```
bankParsers.js       regex extraction per bank email sender, pure functions, no I/O
smsParsers.js          regex extraction per bank SMS sender, pure functions, no I/O
merchantParsers.js      regex extraction for Swiggy/Zomato order emails
categorize.js         deterministic merchant -> category keyword matcher
llmFallback.js         Groq API call, used only when a known sender's regex misses
db.js                  flat-JSON local store: transactions, friends, splits, ledger, dedupe, needs-review
auth.js                 Google OAuth2 loopback flow for this script's own Gmail access
fetchAndParse.js        Gmail -> bankParsers/merchantParsers -> db.js
fetch-all.sh              thin wrapper around fetchAndParse.js, used by the scheduler + the PWA's refresh button
cli.js                    review/split/settle from the terminal
server.js                  PWA backend: REST API + static file serving + POST /api/sms-ingest (SMS webhook)
public/                     PWA frontend (vanilla JS, no build step, no framework)
webhook.js                  sketch only, unused — future push-based Gmail path
test.js / test-sms.js / test-merchant.js / test-split-flow.js   fixtures pulled from real messages + isolated db.js logic tests
```

No build step, no bundler, no frontend framework, no ORM. Flat JSON file
for storage — deliberately, to avoid a native-compile dependency (see
`CLAUDE.md` for the full list of design decisions and why, plus a
section on deploying to a cloud VM).

## Design philosophy

- **Sender allowlist, not keyword blocklist.** Only mail/SMS from a
  sender you've explicitly told it to look for is ever parsed — promo,
  tax-refund, and payment-failed noise disappears without extra filter
  logic. A new bank is invisible until added — deliberate, not a bug.
- **Never guess silently.** A parsed field is only ever the direct
  output of a regex match or an LLM extraction against real message
  text — never inferred from a partial pattern with no real basis.
- **Real fixtures only.** Every parser in this repo, for every bank, was
  built from an actual message and ships with that real text as a test
  fixture — never an invented/guessed template.

## Branching

- `main` — full version, includes SMS parsing for SMS-only banks via a
  Mac's local Messages database (`chat.db`). Requires a Mac kept awake
  with Full Disk Access granted.
- `gmail-only` — email-only, no Mac/SMS dependency, deployable anywhere
  Node runs. Loses SMS-only banks entirely in exchange for a simpler
  deployment story.
- `gmail-sms-shortcut` (this branch) — `gmail-only`'s cloud-deployable
  base plus SMS-only bank alerts, sourced from an iOS Shortcuts
  automation pushing to `POST /api/sms-ingest` instead of a Mac's
  `chat.db`. Gets SMS coverage *and* stays Mac-independent.

## Forking this for yourself

This is a personal project meant to be adapted, not a hosted service.
Your bank's email/SMS templates are almost certainly different from the
ones already parsed here — treat the existing parsers as a reference
implementation and add your own the same way each one here was built
(see `LIVE_SETUP.md`). Real financial data and live credentials
(`db.json`, `token.json`, `credentials.json`) are gitignored and should
never be committed — check `.gitignore` before pushing your own fork.

## License

MIT.
