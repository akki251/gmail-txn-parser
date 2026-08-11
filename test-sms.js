const { parseTransactionSms } = require('./smsParsers');

// Real message pulled from Messages.app's chat.db via Text Message
// Forwarding — a live ₹1 test UPI debit, sent 2026-08-05.
const fixtures = [
  {
    label: 'ICICI — UPI debit',
    sender: 'ICICIT-S',
    text:
      'ICICI Bank Acct XX123 debited for Rs 1.00 on 05-Aug-26; JORDAN LEE credited. UPI:400000000004. Call 18002662 for dispute. SMS BLOCK 123 to 9999999999.',
  },
  {
    label: 'OneCard — credit card spend',
    sender: 'OneCrd-S',
    text: 'Rs. 189.01 sent from OneCard on 06 Aug 2026 to Dominospizza. Not you? Call on 18002109111 to report -OneCard',
  },
  {
    label: 'Random personal text — should be IGNORED (not a bank sender)',
    sender: '+919876543210',
    text: 'Can I call you later?',
  },
];

let pass = 0;
for (const fx of fixtures) {
  const result = parseTransactionSms(fx);
  console.log('\n--- ' + fx.label + ' ---');
  console.log(JSON.stringify(result, null, 2));
  if (fx.label.includes('IGNORED')) {
    if (result === null) pass++;
    else console.log('  ✗ expected null (ignored), got a result');
  } else {
    if (result && result.needsLLMFallback === false) pass++;
    else console.log('  ✗ expected a clean parse');
  }
}
console.log(`\n${pass}/${fixtures.length} fixtures behaved as expected`);
