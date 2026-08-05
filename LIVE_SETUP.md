# Running this against your real inbox

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
export GEMINI_API_KEY=...
```
set in your shell before running. Get a free key from
[aistudio.google.com](https://aistudio.google.com). If a message fails
*both* the regex and the LLM fallback (e.g. free-tier quota), it's still
not lost — it's stored flagged `needsReview` with the raw text intact,
visible in the PWA, and retried automatically on every future fetch.

## 4. Add your own bank(s)
The parsers in this repo (`bankParsers.js`, `smsParsers.js`) were built
from real messages in one specific inbox — your bank almost certainly
uses a different template. Adding a new one:
1. Find the real sender address (email) or sender ID (SMS) in your
   inbox/Messages.
2. Pull one real transaction message from it.
3. Write a regex against that real text, add the sender to the allowlist
   in `fetchAndParse.js`/`fetchSms.js`.
4. Add the real message as a fixture in `test.js`/`test-sms.js`, confirm
   the test passes.

Until you've added your bank, its messages just sit unread — nothing
breaks, they're simply invisible to this tool (see `CLAUDE.md`'s
sender-allowlist rationale).

## 5. SMS-only banks (optional — needs a Mac)
Some banks only send UPI/transaction alerts by SMS, never email. If
Apple's iPhone-to-Mac **Text Message Forwarding** is available to you,
this repo can read those too, via your Mac's local Messages database —
no third-party service, nothing leaves your machine.

1. **iPhone**: Settings → Messages → Text Message Forwarding → enable
   for your Mac. A verification code should appear on the Mac — if it
   doesn't, make sure Messages.app is open and in the foreground on the
   Mac, then toggle forwarding off and back on.
2. **Mac**: System Settings → Privacy & Security → Full Disk Access →
   add **both** `/usr/bin/sqlite3` and your Node binary (e.g.
   `/opt/homebrew/bin/node` — run `which node` to confirm the path).
   Both are needed: macOS attributes file-access permission up the
   process chain for background/`launchd`-spawned processes, not just to
   the immediate binary reading the file.
3. Edit `smsParsers.js` and `fetchSms.js`'s `SMS_SENDER_PATTERNS` for
   your own bank's SMS sender ID (found via a one-off query against
   `~/Library/Messages/chat.db` once forwarding is live), same
   real-fixture rule as email parsers.
4. `npm run fetch:sms` to test standalone.

## 6. Run it in the background (so it keeps working without you)
Two `launchd` jobs — templates are in `launchd/` in this repo. Copy
both into `~/Library/LaunchAgents/`, then in **each** file replace:
- `/ABSOLUTE/PATH/TO/gmail-txn-parser` with this repo's actual path
- `/ABSOLUTE/PATH/TO/HOME` with your home directory
- `YOUR_GEMINI_API_KEY` with your real key
- `com.example.` with something identifying yours (e.g. `com.yourname.`)

```
cp launchd/com.example.gmail-txn-parser.plist ~/Library/LaunchAgents/com.yourname.gmail-txn-parser.plist
cp launchd/com.example.gmail-txn-parser-server.plist ~/Library/LaunchAgents/com.yourname.gmail-txn-parser-server.plist
# edit both files, then:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourname.gmail-txn-parser.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourname.gmail-txn-parser-server.plist
```

- The first job runs `fetch-all.sh` (Gmail + SMS) every 8 hours, plus on
  load/login. Catches up automatically shortly after your Mac wakes if
  the interval elapsed during sleep.
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
Ledger tab (who owes you what); the refresh icon triggers a live fetch
from both Gmail and SMS on demand.

## What to expect the first time
It queries recent messages from your known bank senders and prints one
line per parsed transaction. Anything that doesn't parse cleanly still
tries the LLM fallback rather than silently dropping it — check the
terminal output for `[LLM fallback failed ...]` lines; those transactions
are safe (stored as `needsReview`, visible in the PWA), just not fully
parsed yet.
