#!/usr/bin/env node
const db = require('./db');
const pipelineStats = require('./pipelineStats');

const [, , command, ...args] = process.argv;

function money(n) {
  return `\u20B9${n.toFixed(2)}`;
}

switch (command) {
  case 'unsplit': {
    const txns = db.listUnsplit();
    if (txns.length === 0) {
      console.log("Nothing to split — you're all caught up.");
      break;
    }
    for (const t of txns) {
      console.log(`${t.id}  ${money(t.amount)}  ${t.merchant || '(no merchant)'}  [${t.bank}]  ${t.rawDate || t.date || ''}`);
    }
    break;
  }

  case 'split': {
    const [transactionId, friendsArg] = args;
    if (!transactionId || !friendsArg) {
      console.log('Usage: node cli.js split <transactionId> <friend1,friend2,...>');
      break;
    }
    const friendNames = friendsArg.split(',').map((s) => s.trim()).filter(Boolean);
    const shares = db.splitTransaction(transactionId, friendNames);
    console.log('Split recorded:');
    for (const [name, amt] of Object.entries(shares)) {
      console.log(`  ${name} owes you ${money(amt)}`);
    }
    break;
  }

  case 'personal': {
    const [transactionId] = args;
    if (!transactionId) {
      console.log('Usage: node cli.js personal <transactionId>');
      break;
    }
    db.markPersonal(transactionId);
    console.log(`Marked ${transactionId} as personal — it won't show up in the unsplit list.`);
    break;
  }

  case 'ledger': {
    const balances = db.ledger();
    const names = Object.keys(balances);
    if (names.length === 0) {
      console.log('Ledger is clear — nobody owes you anything right now.');
      break;
    }
    for (const name of names) {
      console.log(`${name} owes you ${money(balances[name])}`);
    }
    break;
  }

  case 'settle': {
    const [friendName, amountStr] = args;
    if (!friendName) {
      console.log('Usage: node cli.js settle <friendName> [amount]   (omit amount to clear their full balance)');
      break;
    }
    db.settle(friendName, amountStr ? parseFloat(amountStr) : undefined);
    console.log(`Settled${amountStr ? ' ' + money(parseFloat(amountStr)) : ' full balance'} for ${friendName}.`);
    break;
  }

  case 'friends': {
    const friends = db.listFriends();
    if (friends.length === 0) {
      console.log('No friends added yet — they get created automatically the first time you split with them.');
      break;
    }
    friends.forEach((f) => console.log(f.name));
    break;
  }

  case 'stats': {
    const s = pipelineStats.getStats();
    const processed = s.smsProcessed + s.emailProcessed;
    const pct = (n) => (processed > 0 ? ((n / processed) * 100).toFixed(1) : '0.0');
    console.log(`SMS processed:              ${s.smsProcessed}`);
    console.log(`Email processed:            ${s.emailProcessed}`);
    console.log(`Filtered (OTP/promo):       ${s.filteredNotTransaction} (${pct(s.filteredNotTransaction)}%)`);
    console.log(`Deterministic match:        ${s.deterministicMatch} (${pct(s.deterministicMatch)}%)`);
    console.log(`AI fallback calls:          ${s.aiFallbackCalled} (${pct(s.aiFallbackCalled)}%)`);
    console.log(`  - succeeded:              ${s.aiFallbackSuccess}`);
    console.log(`  - failed:                 ${s.aiFallbackFailure}`);
    console.log(`needsReview (all fallbacks failed): ${s.needsReview}`);
    console.log('');
    console.log('Cross-source matching (source message -> canonical transaction):');
    const pctMatch = (n) => (s.matchAttempts > 0 ? ((n / s.matchAttempts) * 100).toFixed(1) : '0.0');
    console.log(`  Match attempts:            ${s.matchAttempts}`);
    console.log(`  - by reference number:     ${s.matchedByReference} (${pctMatch(s.matchedByReference)}%)`);
    console.log(`  - by deterministic attrs:  ${s.matchedByDeterministic} (${pctMatch(s.matchedByDeterministic)}%)`);
    console.log(`  - by confidence score:     ${s.matchedByScore} (${pctMatch(s.matchedByScore)}%)`);
    console.log(`  - by AI arbitration:       ${s.matchedByAI} (${pctMatch(s.matchedByAI)}%)`);
    console.log(`  - unmatched (new txn):     ${s.unmatchedNew} (${pctMatch(s.unmatchedNew)}%)`);
    break;
  }

  case 'sources': {
    const [transactionId] = args;
    if (!transactionId) {
      console.log('Usage: node cli.js sources <transactionId>');
      break;
    }
    const txn = db.getTransaction(transactionId);
    if (!txn) {
      console.log(`Unknown transaction: ${transactionId}`);
      break;
    }
    console.log(`${txn.sources.length} source message(s) for ${transactionId} (${money(txn.amount)} ${txn.merchant || ''}):`);
    for (const s of txn.sources) {
      console.log(`  [${s.sourceType}] ${s.id}  received ${s.receivedAt}  match=${s.matchMethod || 'original'}${s.matchConfidence != null ? ` (${s.matchConfidence})` : ''}`);
    }
    break;
  }

  case 'unmatched-templates': {
    const s = pipelineStats.getStats();
    const entries = Object.entries(s.unmatchedTemplates).sort((a, b) => b[1].count - a[1].count);
    if (entries.length === 0) {
      console.log('No unmatched templates recorded — every AI fallback call so far has been a one-off format.');
      break;
    }
    console.log('Recurring formats that hit the AI fallback — a high count means it\'s worth writing a real regex + fixture for:\n');
    for (const [key, info] of entries) {
      console.log(`[${info.count}x] ${info.sourceParser}`);
      console.log(`  ${info.sample}\n`);
    }
    break;
  }

  default:
    console.log(`Usage:
  node cli.js unsplit                          list transactions waiting to be split
  node cli.js split <id> <friend1,friend2>     even-split a transaction across you + those friends
  node cli.js personal <id>                    mark a transaction as not-to-split
  node cli.js ledger                           show who owes you what
  node cli.js settle <friend> [amount]         mark a friend's balance paid (full, or partial if amount given)
  node cli.js friends                          list known friends
  node cli.js stats                            show parse-pipeline stats (deterministic vs AI-fallback rate)
  node cli.js unmatched-templates               show recurring SMS/email formats still hitting the AI fallback
  node cli.js sources <id>                      show which source messages (SMS/email) built a canonical transaction, and how they were matched`);
}
