#!/usr/bin/env node
const db = require('./db');

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

  default:
    console.log(`Usage:
  node cli.js unsplit                          list transactions waiting to be split
  node cli.js split <id> <friend1,friend2>     even-split a transaction across you + those friends
  node cli.js personal <id>                    mark a transaction as not-to-split
  node cli.js ledger                           show who owes you what
  node cli.js settle <friend> [amount]         mark a friend's balance paid (full, or partial if amount given)
  node cli.js friends                          list known friends`);
}
