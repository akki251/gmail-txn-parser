# Security

This is a personal project, forked and self-hosted by each user against
their own Gmail account and their own bank alerts — there is no shared
multi-tenant deployment, so there's no central instance to report issues
against.

If you find a vulnerability in the code itself (not a hosted instance —
there isn't one), please open a GitHub issue or, for anything sensitive
(e.g. an auth bypass), email the address on the maintainer's GitHub
profile instead of filing it publicly.

## What's out of scope
- Vulnerabilities that require local `db.json`/`token.json`/`credentials.json`
  access — those files hold live tokens and financial data and are
  expected to stay off any shared machine (`.gitignore`d by design).
- Issues in a third-party fork's own deployment/config choices.

## What's in scope
- Anything in this repo's code (`bankParsers.js`, `smsParsers.js`,
  `server.js`, `public/`, etc.) that could leak data across users, allow
  auth bypass on the optional `APP_PASSWORD`/`SMS_INGEST_SECRET` gates,
  or execute injected content (XSS, command injection, etc.) from a
  parsed email/SMS.
