const { isNonTransactional } = require('./nonTransactional');

const fixtures = [
  {
    label: 'ICICI OTP — should be filtered',
    text: 'OTP to complete your registration on ICICI Bank iMobile app is 123456. Valid for 5 mins. Do not share this OTP with anyone. -ICICI Bank',
    expectFiltered: true,
  },
  {
    label: 'SBI Card login alert — should be filtered',
    text: 'Dear AKSHANSH S, You have successfully logged in to your SBI Credit Card online account from iPhone 14 Plus on 09 Aug 2026 at 10:06PM.',
    expectFiltered: true,
  },
  {
    label: 'SBI Card registration OTP — should be filtered',
    text: 'One Time Password (OTP) for online registration of your SBI Card ending XX4937 is 460169. This password is valid only for one transaction or for 30 mins whichever is earlier.',
    expectFiltered: true,
  },
  {
    label: 'ICICI UPI debit — should NOT be filtered (real transaction)',
    text: 'ICICI Bank Acct XX123 debited for Rs 1.00 on 05-Aug-26; JORDAN LEE credited. UPI:400000000004.',
    expectFiltered: false,
  },
  {
    label: 'ICICI card debit mentioning OTP requirement — should NOT be filtered (real transaction with amount)',
    text: 'Rs 500.00 debited from ICICI Bank Debit Card 5278 on 11-Aug-26 at Merchant X. OTP verification required for this transaction.',
    expectFiltered: false,
  },
  {
    label: 'ICICI iMobile app activation — should be filtered (real message)',
    text: 'iMobile Activation. Dear Customer, Greetings from ICICI Bank. You have successfully activated iMobile application on your registered mobile number XXXXXXX633 on Aug 04, 2026.',
    expectFiltered: true,
  },
  {
    label: 'SBI Card OTP quoting the pending amount — should be filtered (real message, amount present but no completion verb)',
    text: 'Dear Cardholder, The One Time Password (OTP) for your transaction at Merchant X of INR 799.00 with your SBI Credit Card ending 4937 is 573032. This OTP is valid for 8 minutes or 1 successful attempt.',
    expectFiltered: true,
  },
  {
    label: 'SBI Card Touch ID login enabled — should be filtered (real message)',
    text: 'Dear Customer, Touch ID based login has been enabled on your mobile phone iPhone on 09-08-2026. You can now login using your fingerprint based authentication.',
    expectFiltered: true,
  },
  {
    label: 'OneCard bill-ready reminder — should be filtered (real message, amount present but no completion verb)',
    text: "Your Indian Bank One Credit Card bill of Rs. 3,948.68 is ready. Pay by 22 Aug, 2026 via the OneCard app.",
    expectFiltered: true,
  },
  {
    label: 'OneCard foreign-currency spend — should NOT be filtered (real transaction, has completion verb "spent")',
    text: "That's a hit! SGD 1.38 spent at Merchant Y with your Indian Bank One Credit Card xxXX6566. Reward points added.",
    expectFiltered: false,
  },
];

let pass = 0;
for (const fx of fixtures) {
  const result = isNonTransactional(fx.text);
  console.log(`--- ${fx.label} ---`);
  console.log(`  filtered: ${result}`);
  if (result === fx.expectFiltered) pass++;
  else console.log(`  ✗ expected filtered=${fx.expectFiltered}`);
}
console.log(`\n${pass}/${fixtures.length} fixtures behaved as expected`);
process.exit(pass === fixtures.length ? 0 : 1);
