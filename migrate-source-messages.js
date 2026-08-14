#!/usr/bin/env node
/**
 * One-time, additive, idempotent migration: gives every pre-existing
 * transaction (from before source/canonical separation existed) a
 * synthetic sourceMessages entry wrapping its own current data, and sets
 * sourceIds = [its own id].
 *
 * What this does NOT do, deliberately:
 *  - Does not touch any existing transaction field (amount, merchant,
 *    category, splitStatus, etc.) — those are untouched.
 *  - Does not attempt to retroactively reconstruct source messages that
 *    were historically discarded as duplicates by the old
 *    findCrossSourceDuplicate logic — that data is genuinely gone
 *    (the old code never stored the losing side), and this migration
 *    does not pretend otherwise. Those transactions simply end up with
 *    exactly one source (themselves), same as before this feature existed.
 *  - Does not delete or rewrite anything. Safe to run against production
 *    data. Safe to re-run (skips any transaction that already has
 *    sourceIds, so a partial or repeated run can't double-migrate).
 *
 * Usage:
 *   node migrate-source-messages.js            # dry run, prints a summary, writes nothing
 *   node migrate-source-messages.js --apply     # writes the migration to db.json
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const apply = process.argv.includes('--apply');

if (!fs.existsSync(DB_PATH)) {
  console.log('No db.json found — nothing to migrate.');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
if (!db.sourceMessages) db.sourceMessages = {};

let alreadyMigrated = 0;
let toMigrate = 0;

for (const [id, txn] of Object.entries(db.transactions)) {
  if (txn.sourceIds) {
    alreadyMigrated++;
    continue;
  }
  toMigrate++;
  if (apply) {
    const sourceType = /\sSMS$/.test(txn.sourceParser || '') ? 'sms' : 'email';
    db.sourceMessages[id] = {
      id,
      sourceType,
      bank: txn.bank || null,
      receivedAt: txn.date || null,
      matchedTransactionId: null,
      matchMethod: null, // this was the original record, not matched to anything — same convention as new ingests
      matchConfidence: null,
    };
    txn.sourceIds = [id];
  }
}

console.log(`Transactions already migrated (has sourceIds): ${alreadyMigrated}`);
console.log(`Transactions to migrate: ${toMigrate}`);

if (!apply) {
  console.log('\nDry run — no changes written. Re-run with --apply to write this migration.');
  process.exit(0);
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`\nMigration applied. ${toMigrate} transaction(s) now have a synthetic sourceMessages entry.`);
