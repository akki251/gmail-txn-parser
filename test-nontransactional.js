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
