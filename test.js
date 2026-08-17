const { parseTransactionEmail } = require('./bankParsers');

// These are trimmed excerpts of the actual sentence-bearing HTML from real
// emails in the inbox (marketing boilerplate stripped for brevity — the
// parser strips full HTML fine, this is just to keep the fixture readable).
const fixtures = [
  {
    label: 'IndusInd — approved purchase',
    sender: 'transactionalert@indusind.com',
    htmlBody:
      '<td>The transaction on your IndusInd Bank Credit Card ending 1234 for INR 717.38 on 11-07-2026 11:27:48 am at Bigtree Entertainment Pr is Approved. Available Limit: INR 199,290.30. <br/><br/> In case you have not authorized this transaction...</td>',
  },
  {
    label: 'IndusInd — declined purchase — should be SKIPPED',
    sender: 'transactionalert@indusind.com',
    htmlBody:
      '<td>The transaction on your IndusInd Bank Credit Card ending 1234 for INR 399.00 on 02-08-2026 12:05:42 AM at EPC*EPIC GAMES STORE is Declined. Pls call 18602677777 for queries.</td>',
  },
  {
    label: 'SBI Card — UPI spend',
    sender: 'onlinesbicard@sbicard.com',
    htmlBody:
      '<div class="res-text"><p>This is to inform you that,</p>Rs.510.90 spent on your SBI Credit Card ending with 5678 at JioRecharge on 24-07-26 via UPI (Ref No. 400000000001). Trxn. not done by you? Report at https://sbicard.com/Dispute .</div>',
  },
  {
    label: 'ICICI — debit card purchase',
    sender: 'alert@icici.bank.in',
    plaintextBody:
      'Dear Customer,\n\nGreetings from ICICI Bank.\n\nA purchase of Rs. 2,530.86 has been made using your Debit Card linked to ICICI Bank Account XX123 on 08-Jun-26. Info: VIN*FPL Technol.\n\nThe Available Balance in your account is Rs. 30,077.92.',
  },
  {
    label: 'ICICI — account credited (interest)',
    sender: 'customernotification@icici.bank.in',
    plaintextBody:
      'Dear Customer, Greetings from ICICI Bank. Your ICICI Bank Account XX123 has been credited with INR 413 on 30-Jun-26. Info: XX123:Int.Pd:30-03-2026 to 29-06-2026.',
  },
  {
    label: 'HDFC Bank — credit card payment',
    sender: 'alerts@hdfcbank.bank.in',
    htmlBody:
      '<p>Dear Customer,</p><p>Greetings from HDFC Bank.</p><p>We would like to inform you that <b>Rs. 577.00</b> has been debited from your HDFC Bank Credit Card ending <b>8901</b> towards <b>RAZ*SWIGGY</b> on <b>02 Aug, 2026</b> at <b>22:49:05</b>.</p>',
  },
  {
    label: 'HDFC Bank — UPI debit from account',
    sender: 'alerts@hdfcbank.bank.in',
    plaintextBody:
      "Dear Customer, Greetings from HDFC Bank! Rs.22500.00 is debited from your account ending 2345 towards VPA nippon.bdpg.mf@validicici (Nippon India Mutual Fund) on 01-08-26. UPI transaction reference no.: 400000000002. If you did not authorize this transaction, please report it immediately.",
  },
  {
    label: 'HDFC Bank — UPI credit into account',
    sender: 'alerts@hdfcbank.bank.in',
    plaintextBody:
      "Dear Customer, Greetings from HDFC Bank! We're writing to inform you that Rs.5000.00 has been successfully credited to your HDFC Bank account ending in 2345. Transaction Details: a. Date: 01-08-26 b. Sender: JORDAN LEE (VPA: 9999999999@ptyes) c. UPI Reference No.: 400000000003",
  },
  {
    label: 'Axis Bank — credit card purchase',
    sender: 'alerts@axis.bank.in',
    plaintextBody:
      "04-08-2026 Dear Jordan Lee, \r\n\r\n Here's the summary of your Axis Bank Credit Card Transaction: \r\n Transaction Amount: \r\n INR 113.4\r\n Merchant Name: \r\n Burger King \r\n Axis Bank Credit Card No. \r\n XX4567\r\n Date & Time: \r\n 04-08-2026, 19:44:03 IST \r\n Available Limit*: \r\n INR 34439.6\r\n If this transaction was not intiated by you, SMS BLOCK 4567 to +919999999999.",
  },
  {
    label: 'Swiggy payment-failed — should be IGNORED (not a bank sender)',
    sender: 'noreply@swiggy.in',
    plaintextBody:
      'Hi Jordan, Thanks for using Swiggy! Your payment for Swiggy order #242975203003926 was not completed.',
  },
  {
    label: 'Income tax refund — should be IGNORED (not a bank sender)',
    sender: 'intimations@cpc.incometax.gov.in',
    plaintextBody: 'Your Refund has been credited. Status: Your Refund has been...',
  },
  {
    label: 'SBI Card OTP email — should be SKIPPED (known sender, not a transaction)',
    sender: 'onlinesbicard@sbicard.com',
    plaintextBody:
      'Untitled Document Dear Cardholder, One Time Password (OTP) for online registration of your SBI Card ending XX4937 is 460169 . This password is valid only for one transaction or for 30 mins whichever is earlier. Do not share it with anyone. Warm regards, SBI Card',
  },
  {
    label: 'SBI Card login-alert email — should be SKIPPED (known sender, not a transaction)',
    sender: 'onlinesbicard@sbicard.com',
    plaintextBody:
      'Dear AKSHANSH S, You have successfully logged in to your SBI Credit Card online account from iPhone 14 Plus on 09 Aug 2026 at 10:06PM. If you did not take this action, please call us on the Helpline number mentioned on the back of your SBI Credit Card.',
  },
];

let pass = 0;
for (const fx of fixtures) {
  const result = parseTransactionEmail(fx);
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
