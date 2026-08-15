/**
 * Deterministic Bank SMS Regex Engine for React Native Expo.
 * Pure regex filters for ICICI, HDFC, SBI, Axis, IndusInd, and OneCard.
 */
const { isNonTransactional } = require('./nonTransactional');

const SMS_PARSERS = [
  {
    name: 'ICICI Bank SMS',
    matchSender: (sender, text) => /ICICI/i.test(sender || '') || /ICICI/i.test(text || ''),
    parse: (text) => {
      // Case 1: UPI debit
      let re = /ICICI Bank (?:Acct|Account)\s*(\w+)\s+(?:has been\s+)?debited(?: for)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4});?\s*(.+?)\s+credited(?:\.|\s)*?(?:UPI:?\s*|\s*)?(\d+)?/i;
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

      // Case 2: Card debit
      re = /(?:Rs\.?|INR)\s?([\d,]+\.?\d*)\s+debited from ICICI Bank (Prepaid Card|Debit Card|Credit Card|Card|Account)\s+(\w+)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})\.\s*Info-?\s*([^.]+)\./i;
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
    name: 'HDFC Bank SMS',
    matchSender: (sender, text) => /HDFCBK|HDFC/i.test(sender || '') || /HDFC Bank/i.test(text || ''),
    parse: (text) => {
      // HDFC UPI Debit: "Money Transfer: Rs 250.00 debited from A/C **1234 to ZOMATO on 14-AUG-26"
      let re = /(?:Money Transfer:\s*)?(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+debited from (?:A\/C|Acct)\s+(\*+\w+)\s+to\s+(.+?)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4})/i;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'HDFC Bank',
          instrument: 'Account',
          account: m[2].replace(/\*/g, ''),
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[3].trim(),
          rawDate: m[4],
          type: 'debit',
          status: 'Approved',
        };
      }
      return null;
    },
  },

  {
    name: 'SBI Card SMS',
    matchSender: (sender, text) => /SBICRD|SBICARD|SBI/i.test(sender || '') || /SBI Card/i.test(text || ''),
    parse: (text) => {
      // SBI Card: "Rs. 510.90 spent on your SBI Credit Card ending 5678 at JioRecharge on 24-Jul-26."
      const re = /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+spent on your SBI Credit Card ending\s+(\w+)\s+at\s+(.+?)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4})/i;
      const m = text.match(re);
      if (m) {
        return {
          bank: 'SBI Card',
          instrument: 'Credit Card',
          last4: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[3].trim(),
          rawDate: m[4],
          type: 'debit',
          status: 'Approved',
        };
      }
      return null;
    },
  },

  {
    name: 'Axis Bank SMS',
    matchSender: (sender, text) => /AXISBK|AXIS/i.test(sender || '') || /Axis Bank/i.test(text || ''),
    parse: (text) => {
      const re = /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+spent on Axis Bank (?:Credit|Debit) Card XX(\w+)\s+at\s+(.+?)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4})/i;
      const m = text.match(re);
      if (m) {
        return {
          bank: 'Axis Bank',
          instrument: 'Card',
          last4: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[3].trim(),
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

  {
    name: 'Axio Pay Later SMS',
    matchSender: (sender, text) => /axio/i.test(sender || '') || /axio/i.test(text || ''),
    parse: (text) => {
      const re = /(?:availing Pay Later credit|spent|debited|charged)(?: of)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'Axio',
        instrument: 'Pay Later',
        amount: parseFloat(m[1].replace(/,/g, '')),
        currency: 'INR',
        merchant: 'Axio Pay Later',
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
