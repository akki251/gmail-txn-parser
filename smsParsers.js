/**
 * SMS transaction parser. Same sender-allowlist + regex-per-template
 * design as bankParsers.js — used for banks (ICICI) that only send UPI
 * alerts by SMS, never email.
 */

const SMS_PARSERS = [
  {
    name: 'ICICI Bank SMS',
    matchSender: (sender) => /ICICI/i.test(sender),
    parse: (text) => {
      // UPI debit: "ICICI Bank Acct XX123 debited for Rs 1.00 on 05-Aug-26;
      // JORDAN LEE credited. UPI:400000000004."
      const re =
        /ICICI Bank Acct (XX\d+) debited for Rs\s?([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4});\s*(.+?)\s+credited\.\s*UPI:(\d+)/i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'ICICI Bank',
        instrument: 'Account',
        account: m[1],
        amount: parseFloat(m[2].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[4].trim(),
        rawDate: m[3],
        paymentMode: 'UPI',
        refNo: m[5],
        type: 'debit',
        status: 'Approved',
      };
    },
  },
];

function parseTransactionSms({ sender, text }) {
  if (!text) return null;

  for (const parser of SMS_PARSERS) {
    if (parser.matchSender(sender)) {
      const result = parser.parse(text);
      if (result) {
        return { ...result, sourceParser: parser.name, needsLLMFallback: false };
      }
      return { needsLLMFallback: true, sourceParser: parser.name, rawText: text };
    }
  }
  return null;
}

module.exports = { parseTransactionSms, SMS_PARSERS };
