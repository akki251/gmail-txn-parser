/**
 * SMS transaction parser. Same sender-allowlist + regex-per-template
 * design as bankParsers.js — used for banks (ICICI) that only send UPI
 * alerts by SMS, never email.
 */
const { isNonTransactional } = require('./nonTransactional');

const SMS_PARSERS = [
  {
    name: 'ICICI Bank SMS',
    matchSender: (sender) => /ICICI/i.test(sender),
    parse: (text) => {
      // Case 1: UPI debit: "ICICI Bank Acct XX123 debited for Rs 1.00 on 05-Aug-26;
      // JORDAN LEE credited. UPI:400000000004." — "for" is sometimes absent
      // ("debited Rs 22500.00 on 14-Aug-26"), so it's optional here.
      let re =
        /ICICI Bank Acct (XX\d+|\d+) debited(?: for)? Rs\s?([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4});\s*(.+?)\s+credited\.\s*UPI:(\d+)/i;
      let m = text.match(re);
      if (m) {
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
      }

      // Case 2: Card debit (Prepaid / Debit / Credit Card)
      // "Dear Customer, Rs 146.70 debited from ICICI Bank Prepaid Card 5278 on 11-Aug-26. Info- ZOMATO."
      re =
        /Rs\s?([\d,]+\.?\d*)\s+debited from ICICI Bank (Prepaid Card|Debit Card|Credit Card|Card)\s+(\w+)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})\.\s*Info-?\s*([^.]+)\./i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: m[2].trim(),
          last4: m[3],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[5].trim(),
          rawDate: m[4],
          type: 'debit',
          status: 'Approved',
        };
      }

      return null;
    },
  },

  {
    name: 'OneCard SMS',
    matchSender: (sender) => /OneCrd/i.test(sender),
    parse: (text) => {
      // "Rs. 189.01 sent from OneCard on 06 Aug 2026 to Dominospizza.
      // Not you? Call on 18002109111 to report -OneCard"
      const re = /Rs\.?\s?([\d,]+\.?\d*)\s+sent from OneCard on\s+([\d]{1,2}\s+\w{3}\s+\d{4})\s+to\s+(.+?)\./i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'OneCard',
        instrument: 'Credit Card',
        amount: parseFloat(m[1].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[3].trim(),
        rawDate: m[2],
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
      // OTP/login/password-reset SMS from a known bank sender — not a
      // transaction, skip before wasting a parse attempt or an LLM call.
      if (isNonTransactional(text)) return { notATransaction: true, sourceParser: parser.name };

      // A thrown error (regex bug, unexpected input shape, etc.) is exactly
      // the "silly parsing error" case that must still reach the LLM
      // fallback, not crash and silently drop the message — same safety
      // net as a clean `return null` regex miss.
      let result;
      try {
        result = parser.parse(text);
      } catch {
        result = null;
      }
      if (result) {
        return { ...result, sourceParser: parser.name, needsLLMFallback: false };
      }
      return { needsLLMFallback: true, sourceParser: parser.name, rawText: text };
    }
  }
  return null;
}

module.exports = { parseTransactionSms, SMS_PARSERS };
