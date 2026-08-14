/**
 * SMS transaction parser. Same sender-allowlist + regex-per-template
 * design as bankParsers.js — used for banks (ICICI) that only send UPI
 * alerts by SMS, never email.
 */
const { isNonTransactional } = require('./nonTransactional');

const SMS_PARSERS = [
  {
    name: 'ICICI Bank SMS',
    matchSender: (sender, text) => /ICICI/i.test(sender || '') || /ICICI/i.test(text || ''),
    parse: (text) => {
      // Case 1: UPI debit: "ICICI Bank Acct XX123 debited for Rs 1.00 on 05-Aug-26;
      // JORDAN LEE credited. UPI:400000000004." — handles "Acct"/"Account", optional "for", flexible spaces
      let re =
        /ICICI Bank (?:Acct|Account)\s*(\w+)\s+(?:has been\s+)?debited(?: for)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4});?\s*(.+?)\s+credited(?:\.|\s)*?(?:UPI:?\s*|\s*)?(\d+)?/i;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Account',
          account: m[1],
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[4] ? m[4].trim() : null,
          rawDate: m[3],
          paymentMode: 'UPI',
          refNo: m[5] || null,
          type: 'debit',
          status: 'Approved',
        };
      }

      // Case 2: Card debit (Prepaid / Debit / Credit Card)
      // "Dear Customer, Rs 146.70 debited from ICICI Bank Prepaid Card 5278 on 11-Aug-26. Info- ZOMATO."
      re =
        /(?:Rs\.?|INR)\s?([\d,]+\.?\d*)\s+debited from ICICI Bank (Prepaid Card|Debit Card|Credit Card|Card|Account)\s+(\w+)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})\.\s*Info-?\s*([^.]+)\./i;
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

      // Case 3: Generic ICICI Debit Fallback
      re = /ICICI Bank (?:Acct|Account|Card)\s*(\w+)?\s*(?:debited|has been debited)\s*(?:for)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Account',
          account: m[1] || null,
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: null,
          type: 'debit',
          status: 'Approved',
        };
      }

      return null;
    },
  },

  {
    name: 'OneCard SMS',
    matchSender: (sender, text) => /OneCrd|OneCard/i.test(sender || '') || /OneCard/i.test(text || ''),
    parse: (text) => {
      const re = /(?:Rs\.?|INR)\s?([\d,]+\.?\d*)\s+sent from OneCard on\s+([\d]{1,2}\s+\w{3}\s+\d{4})\s+to\s+(.+?)\./i;
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
    if (parser.matchSender(sender, text)) {
      if (isNonTransactional(text)) return { notATransaction: true, sourceParser: parser.name };

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
