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
    label: 'ICICI — UPI debit (no "for" before Rs)',
    sender: 'ICICIT-S',
    text:
      'ICICI Bank Acct XX299 debited Rs 22500.00 on 14-Aug-26; AKSHANSH SHRIVA credited. UPI:213151704707. Call 18002662 dispute. SMS BLOCK 299 to 9215676766',
  },
  {
    label: 'ICICI — incoming UPI credit',
    sender: 'ICICIT-S',
    text:
      'Dear Customer, Acct XX299 is credited with Rs 1.00 on 15-Aug-26 from AKSHANSH SHRIVA. UPI:213256165737-ICICI Bank.',
  },
  {
    label: 'ICICI — Prepaid Card debit',
    sender: 'ICICIT-S',
    text:
      'Dear Customer, Rs 146.70 debited from ICICI Bank Prepaid Card 5278 on 11-Aug-26. Info- ZOMATO. The Available Balance is Rs 1,543.86 . Call 022 50405238 for dispute or SMS BLOCK 5278 to 9215676766',
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
  {
    label: 'ICICI OTP SMS — should be SKIPPED (known sender, not a transaction)',
    sender: 'ICICIB-S',
    text: 'OTP to complete your registration on ICICI Bank iMobile app is 123456. Valid for 5 mins. Do not share this OTP with anyone. -ICICI Bank',
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
  } else if (fx.label.includes('SKIPPED')) {
    if (result && result.notATransaction === true) pass++;
    else console.log('  ✗ expected notATransaction: true');
  } else {
    if (result && result.needsLLMFallback === false) pass++;
    else console.log('  ✗ expected a clean parse');
  }
}
console.log(`\n${pass}/${fixtures.length} fixtures behaved as expected`);
