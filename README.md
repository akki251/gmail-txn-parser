# gmail-txn-parser

**Branch: `gmail-only`** — email-only version, no Mac/SMS dependency,
deployable to any server. See `main` for the version that also parses
SMS-only bank alerts via a Mac's local Messages database.

A personal tool that watches your Gmail for bank transaction alerts,
parses them into structured data, categorizes spend, and gives you a
phone-installable PWA to split expenses with friends — a self-hosted
mini-Splitwise triggered by your own real spending instead of manual
entry.

No cloud hosting requirement (though this branch is deployable to one if
you want), no third-party analytics, no multi-user accounts — your
financial data never leaves wherever you run this, except for the two
calls you explicitly wire up (Gmail's own API to read your own inbox,
and an LLM call only for the rare message a regex can't parse).

## What it does

- **Parses real bank emails** into structured transactions — amount,
  merchant, date, bank, category — via deterministic regex per bank
  template, not an LLM by default. Supports IndusInd, SBI Card, ICICI,
  HDFC, and Axis Bank out of the box; adding your own bank is
  straightforward (see `LIVE_SETUP.md`).
- **Never silently loses a transaction.** A message from a known bank
  whose exact template doesn't match falls back to an LLM extraction; if
  that also fails, it's stored flagged for review with the raw text
  intact and retried automatically on every future fetch — never dropped.
- **Categorizes spend** with an editable, deterministic keyword matcher
  — no LLM call needed for this.
- **Splits and settles** expenses with friends — even split or custom
  per-friend amounts — tracks a running ledger.
- **A PWA you install on your phone** — day-wise transaction list, spend
  trend charts, a "possibly shareable" suggestion tab (transparent
  category+amount heuristic, not a trained model — grows more accurate
  as your real split history does), and a ledger view. Reachable from
  your phone via [Tailscale](https://tailscale.com), no public exposure.

## Quick start

```
npm install
npm test           # parser fixtures, real excerpts, no network needed
npm run test:split # split/ledger/dedupe logic, isolated from your real data
```

Then walk through **[`LIVE_SETUP.md`](LIVE_SETUP.md)** for the real
setup: your own Google Cloud OAuth credentials, a free Groq API key,
background scheduling, and phone access via Tailscale.

## Architecture

```
bankParsers.js       regex extraction per bank sender
categorize.js         deterministic merchant -> category matcher
llmFallback.js         LLM call, used only when a known sender's regex misses
db.js                  flat-JSON local store + split/ledger/dedupe logic
auth.js                 Google OAuth2 loopback flow
fetchAndParse.js        Gmail -> bankParsers -> db.js
fetch-all.sh              thin wrapper, used by the scheduler + the PWA refresh button
cli.js                    terminal review/split/settle
server.js                  PWA backend (plain node:http, no framework)
public/                     PWA frontend (vanilla JS, no build step)
launchd/                     plist templates for background scheduling (macOS)
test.js / test-split-flow.js   real-message fixtures + isolated logic tests
```

No build step, no bundler, no frontend framework, no ORM. Flat JSON file
for storage — deliberately, to avoid a native-compile dependency. See
`CLAUDE.md` for the full list of design decisions and why, plus a section
on deploying this branch to a cloud VM.

## Design philosophy

- **Sender allowlist, not keyword blocklist.** Only mail from a bank
  you've explicitly told it to look for is ever parsed. A new bank is
  invisible until added — deliberate, not a bug.
- **Never guess silently.** A parsed field is only ever the direct
  output of a regex match or an LLM extraction against real message
  text — never inferred from a partial pattern with no real basis.
- **Real fixtures only.** Every parser in this repo, for every bank, was
  built from an actual message and ships with that real text as a test
  fixture — never an invented/guessed template.

## Forking this for yourself

This is a personal project meant to be adapted, not a hosted service.
Your bank's email templates are almost certainly different from the
ones already parsed here — treat the existing parsers as a reference
implementation and add your own the same way each one here was built
(see `LIVE_SETUP.md`). Real financial data and live credentials
(`db.json`, `token.json`, `credentials.json`) are gitignored and should
never be committed — check `.gitignore` before pushing your own fork.

## License

MIT.
