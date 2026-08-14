# Running this against your real inbox

**Branch: `gmail-sms-shortcut`** — email-only ingestion (no Mac/`chat.db`
dependency) plus SMS-only bank alerts via an iOS Shortcuts automation
instead of a Mac (see step 6). See `main` if you'd rather use the
Mac/`chat.db`-based SMS path instead.

## 0. Right now, zero setup
```
npm install
npm test
npm run test:split
npm run test:sms
```
These run against hardcoded fixtures — prove the extraction/split/dedupe
logic works, touch no real accounts, need no keys.

## 1. Get your own Gmail API credentials
This is *your* app, talking to *your* Gmail, with *your* Google Cloud
project — nobody else has access to this.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) →
   create a project (or reuse one) → **APIs & Services → Library** →
   search "Gmail API" → Enable.
2. **APIs & Services → OAuth consent screen** → User type: External →
   fill the minimal required fields → under "Test users," add your own
   Gmail address. (This keeps it in "Testing" mode — no Google
   verification review needed for personal use, since you're the only
   user.)
3. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID** → Application type: **Desktop app** → name it anything → Create.
4. Click the download icon on the credential you just made → save the
   file as `credentials.json` in this same folder. (Gitignored — never
   gets committed.)

## 2. Authenticate once
```
npm run fetch
```
First run: it prints a URL. Open it, sign in with the Gmail account you
added as a test user, approve the "read-only Gmail access" scope. It
redirects to `localhost:3987`, which the script is listening on — you'll
see "Authorized" in the browser and the parsed transactions start
printing in the terminal. A `token.json` gets saved (also gitignored) so
you won't need to re-auth on future runs.

## 3. If you hit the LLM fallback path
Any known-bank-sender message that doesn't match the regex falls through
to `llmFallback.js`, which needs:
```
export OPENROUTER_API_KEY=...
```
set in your shell before running. Get a key from
[openrouter.ai](https://openrouter.ai). If a message fails *both* the
regex and the LLM fallback (e.g. quota, outage), it's still not lost —
it's stored flagged `needsReview` with the raw text intact, visible in
the PWA, and retried automatically on every future fetch.

## 4. Add your own bank(s)
The parsers in this repo (`bankParsers.js`) were built from real messages
in one specific inbox — your bank almost certainly uses a different
template. Adding a new one:
1. Find the real sender address in your inbox.
2. Pull one real transaction message from it.
3. Write a regex against that real text, add the sender to the allowlist
   in `fetchAndParse.js`.
4. Add the real message as a fixture in `test.js`, confirm the test
   passes.

Until you've added your bank, its messages just sit unread — nothing
breaks, they're simply invisible to this tool (see `CLAUDE.md`'s
sender-allowlist rationale).

## 5. SMS-only banks, via an iOS Shortcut (no Mac needed)
Some banks only send UPI/transaction alerts by SMS, never email. Instead
of the `main` branch's Mac/`chat.db` approach, this branch receives those
SMS directly from your iPhone via a Shortcuts automation that POSTs the
message to this server the moment it arrives — nothing to keep awake.

1. Set a secret on the server (same `.env`/`ecosystem.config.js`/shell
   export pattern as `OPENROUTER_API_KEY`):
   ```
   export SMS_INGEST_SECRET=... # any long random string
   ```
2. On your iPhone: **Shortcuts app → Automation tab → + → Create Personal
   Automation → Message**. Leave "Sender" blank (filtering happens
   server-side via the sender allowlist in `smsParsers.js`, same as the
   email allowlist) and turn on "Any Sender". Tap Next.
3. Add one action: **Get Contents of URL**.
   - URL: `https://<your-server>/api/sms-ingest`
   - Method: POST
   - Headers: `X-Sms-Secret` = the secret from step 1, `Content-Type` = `application/json`
   - Request Body → JSON, with fields:
     - `sender` → the trigger's **Message → Sender** magic variable
     - `text` → the trigger's **Message → Message Content** magic variable
     - `date` → the trigger's **Message → Date Received** magic variable
4. Save, then turn **off** "Ask Before Running" (Shortcuts details view for
   the automation) so it fires silently in the background. iOS may show a
   one-time confirmation the first time it actually runs.
5. Add your bank's real SMS sender ID + a regex to `smsParsers.js`,
   following the same real-fixture rule as email parsers — pull one real
   message, write the regex against it, add it as a fixture in
   `test-sms.js`, confirm `npm run test:sms` passes.

Unknown senders are silently ignored (200 response, nothing stored) —
same sender-allowlist philosophy as email. A known sender whose template
doesn't match falls back to the LLM, then to `needsReview` if that also
fails — never silently dropped, same guarantee as every other source.

## 6. Run it in the background (so it keeps working without you)
Two `launchd` jobs — templates are in `launchd/` in this repo. Copy
both into `~/Library/LaunchAgents/`, then in **each** file replace:
- `/ABSOLUTE/PATH/TO/gmail-txn-parser` with this repo's actual path
- `/ABSOLUTE/PATH/TO/HOME` with your home directory
- `YOUR_OPENROUTER_API_KEY` with your real key
- `com.example.` with something identifying yours (e.g. `com.yourname.`)

```
cp launchd/com.example.gmail-txn-parser.plist ~/Library/LaunchAgents/com.yourname.gmail-txn-parser.plist
cp launchd/com.example.gmail-txn-parser-server.plist ~/Library/LaunchAgents/com.yourname.gmail-txn-parser-server.plist
# edit both files, then:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourname.gmail-txn-parser.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourname.gmail-txn-parser-server.plist
```

- The first job runs `fetch-all.sh` (Gmail) every 8 hours, plus on
  load/login. Catches up automatically shortly after your Mac wakes if
  the interval elapsed during sleep. (`launchd` is macOS-specific — on a
  Linux server, use a `cron` entry or `systemd` timer calling the same
  script instead; see `CLAUDE.md`'s cloud-deploy notes.)
- The second runs `npm run serve` continuously (`KeepAlive`, restarts
  itself if it crashes), serving the web UI + API on port 4173.

Useful commands (swap in your actual label):
```
launchctl print gui/$(id -u)/com.yourname.gmail-txn-parser
launchctl kickstart -k gui/$(id -u)/com.yourname.gmail-txn-parser   # force an immediate fetch
tail -f ~/Library/Logs/gmail-txn-parser.log
tail -f ~/Library/Logs/gmail-txn-parser-server.log
```

## 7. View and split from your iPhone (PWA over Tailscale)
The web UI at port 4173 is only reachable on your Mac's own network
interfaces by default — no auth layer, since it's meant to be private.
[Tailscale](https://tailscale.com) (free for personal use) makes it
reachable from your phone anywhere without exposing it publicly:

1. Install Tailscale on your Mac (`brew install --cask tailscale-app` or
   download from tailscale.com) and log in. Approve the VPN configuration
   profile prompt in System Settings when asked.
2. Install the Tailscale app on your iPhone from the App Store, log into
   the **same** Tailscale account.
3. On your Mac, run `tailscale ip -4` to get its Tailscale IP (stable,
   doesn't change even as your home wifi IP does).
4. On your iPhone, open Safari and go to `http://<that-ip>:4173`.
5. Tap the Share icon → **Add to Home Screen**. It launches full-screen,
   no Safari chrome, like a native app.

If the page hangs/times out from your phone but works fine from the Mac
itself, check macOS's Application Firewall (System Settings → Network →
Firewall → Options) — it may need `node` explicitly allowed to accept
incoming connections.

The home screen icon shows a day-wise transaction list, a Suggested tab
(possibly-shareable transactions), a Trends tab (spend charts), and a
Ledger tab (who owes you what); the refresh icon triggers a live Gmail
fetch on demand.

## What to expect the first time
It queries recent messages from your known bank senders and prints one
line per parsed transaction. Anything that doesn't parse cleanly still
tries the LLM fallback rather than silently dropping it — check the
terminal output for `[LLM fallback failed ...]` lines; those transactions
are safe (stored as `needsReview`, visible in the PWA), just not fully
parsed yet.
