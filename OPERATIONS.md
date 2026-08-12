# Operations runbook (gmail-sms-shortcut branch)

Production-readiness runbook for the live deployment: GCP VM
`whatsapp-calendar-bot`, PM2, port 4173. Written for a single-user
personal tool — deliberately not a full ops platform (see CLAUDE.md:
"do not build a massive observability platform").

## 1. Health check

`GET /api/health` — unauthenticated, no session/secret required (it
carries no user data), so PM2/monitoring/curl can hit it directly:

```
curl http://localhost:4173/api/health
{"ok":true,"uptimeSec":1234,"dbReadable":true,"timestamp":"..."}
```

Returns `503` with `"ok":false` if `db.json` isn't readable — the one
failure mode that matters for this app (everything else is either "the
process is up" — which PM2 already tracks — or "Gmail/parsing is
broken", which surfaces as `needsReview` entries in the UI, not a
crash).

**Alerting**: point a free external uptime checker (UptimeRobot,
Healthchecks.io, or similar — 5-minute interval is plenty) at
`http://<tailscale-or-public-host>:4173/api/health` for push/email
alerts on downtime. Building custom alerting infra for a single-user
tool isn't worth it; wiring an existing free service to an endpoint we
already have is a 5-minute setup, not a project.

**PM2's own restart tracking** is the other half of "alerting" here:
```
pm2 status                 # shows restart count per process
pm2 startup && pm2 save    # survive VM reboot
pm2 logs gmail-txn-parser --lines 100   # recent errors
```
A climbing restart count in `pm2 status` (checked whenever you're on
the box, or scripted into the uptime checker's target if you want one
more signal) is the crash-loop signal; `/api/health` is the "is it
actually serving" signal. Together that's full coverage without a
metrics stack.

## 2. Backup / restore for `db.json`

`db.json` is the entire database (flat JSON, see CLAUDE.md "Key
decisions" #2). Losing it loses transaction history, splits, and the
friends ledger.

**Backup** — cron on the VM, daily, keeps 14 days locally plus an
off-box copy so a lost/corrupted VM disk doesn't take the backups with
it:

```bash
# /home/<user>/gmail-txn-parser/scripts/backup-db.sh
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
cp db.json "backups/db-$(date +%Y%m%d-%H%M%S).json"
find backups -name 'db-*.json' -mtime +14 -delete
```
```
# crontab -e
0 3 * * * /home/<user>/gmail-txn-parser/scripts/backup-db.sh >> /home/<user>/gmail-txn-parser/backup.log 2>&1
```

Off-box copy (pick one, both are a single line): `rclone` to any cloud
storage, or `scp`/`rsync` the `backups/` dir to a second machine on the
Tailscale network on the same schedule. Either is enough insurance for
personal-scale data — no need for a managed backup service.

**Restore**:
```bash
pm2 stop gmail-txn-parser
cp backups/db-<timestamp>.json db.json
pm2 start gmail-txn-parser
```
Since ingestion is idempotent on `messageId` (email) / derived hash
(SMS) — see CLAUDE.md #3 — restoring an older backup and letting the
next scheduled fetch run is safe: anything that arrived after the
backup gets re-ingested from Gmail/the Shortcut, nothing double-counts.

`backups/` should be added to `.gitignore` (it will contain real
financial data, same as `db.json` itself).

## 3. Rollback (bad deploy on the GCP VM)

Deploys here are a manual `git pull` + `pm2 restart`, not a CI/CD
pipeline, so rollback is the same shape in reverse:

```bash
ssh <vm>
cd gmail-txn-parser
git log --oneline -5        # find the last-known-good commit
git checkout <last-good-sha>
npm ci                      # in case dependencies changed
pm2 restart gmail-txn-parser
pm2 logs gmail-txn-parser --lines 50   # confirm it came back clean
```

If the bad deploy also corrupted `db.json` (e.g. a bad migration), also
restore the pre-deploy backup per §2 — take a manual backup
(`./scripts/backup-db.sh`) immediately before any deploy that changes
`db.js`'s data shape, on top of the daily cron.

For an infra-level failure (VM itself broken, not just the app), a
periodic GCP disk snapshot of `whatsapp-calendar-bot` is the actual
rollback path — cheap to schedule (GCP Console → VM → Snapshots →
schedule) and out of scope for this app-level runbook, but worth
turning on once, since it's a checkbox, not an engineering project.

## 4. Rate limiting — `/api/sms-ingest` and `/api/login`

**Decision: minimal in-memory per-IP rate limit added, nothing
heavier.**

Both routes are the only ones reachable without an existing session —
`/api/sms-ingest` is gated by `SMS_INGEST_SECRET` (timing-safe
compare), `/api/login` by `APP_PASSWORD` (same). The only realistic
risk from lacking a rate limit was unlimited brute-force attempts
against those secrets. A fixed-window per-IP counter (20 requests/min,
in `server.js`) closes that off at negligible cost — no new
dependency, ~15 lines.

**Why nothing heavier** (no CAPTCHA, no WAF, no distributed rate
limiter, no IP banning): this is a single-user tool behind a
Tailscale-private or low-traffic public endpoint, not a target
attackers are pointing tooling at specifically. An in-memory counter
resets on PM2 restart, which is an acceptable gap at this scale — a
determined attacker restarting our process to reset a rate limit isn't
a realistic threat model here. If this ever moves to a genuinely public
multi-user deployment, revisit with a real secret (long random token,
documented in `LIVE_SETUP.md` step 5) as the primary defense, same as
today.
