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
      // Case 1: UPI debit (e.g. "ICICI Bank Acct XX123 debited for Rs 230.33 on 19-Aug-26; Swiggy credited. UPI: 123456789012")
      let re = /ICICI Bank (?:Acct|Account|A\/c)?\s*(\w+)?\s+(?:has been\s+)?debited(?: for| by)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4});?\s*(?:(.+?)\s+credited|(?:to|at)\s+([^.;]+))?\.?\s*(?:UPI:?\s*(\d+))?/i;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Account',
          account: m[1] || null,
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: (m[4] || m[5]) ? (m[4] || m[5]).trim() : null,
          rawDate: m[3],
          paymentMode: 'UPI',
          refNo: m[6] || null,
          type: 'debit',
          status: 'Approved',
        };
      }

      // Case 2: Card debit / Spent (e.g. "Rs 230.33 debited from ICICI Bank Credit Card XX1234 on 19-Aug-26. Info: Swiggy")
      re = /(?:Rs\.?|INR)\s?([\d,]+\.?\d*)\s+(?:debited from|spent on)\s+ICICI Bank (Prepaid Card|Debit Card|Credit Card|Card|Account)\s*(\w+)?\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})(?:\.\s*Info-?\s*([^.]+?)(?:\.|$))?/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: m[2] ? m[2].trim() : 'Card',
          last4: m[3] || null,
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[5] ? m[5].trim() : null,
          rawDate: m[4],
          type: 'debit',
          status: 'Approved',
        };
      }

      // Case 3: Used for transaction at merchant (e.g. "Your ICICI Bank Credit Card XX1234 has been used for a transaction of INR 230.33 on 19-Aug-26 at SWIGGY")
      re = /ICICI Bank (?:Credit Card|Debit Card|Card)\s*(\w+)?\s+(?:has been|was)?\s*used for (?:a )?transaction of\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4})\s+at\s+([^.]+)/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Credit Card',
          last4: m[1] || null,
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[4] ? m[4].trim() : null,
          rawDate: m[3],
          type: 'debit',
          status: 'Approved',
        };
      }

      // Case 4: UPI incoming credit
      re = /Acct\s*(\w+)?\s*is credited with\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+on\s+([\d]{1,2}-[\w]{3}-[\d]{2,4})\s+from\s+(.+?)\.\s*UPI:?\s*(\d+)/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Account',
          account: m[1] || null,
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[4].trim(),
          rawDate: m[3],
          paymentMode: 'UPI',
          refNo: m[5],
          type: 'credit',
          status: 'Approved',
        };
      }

      // Case 5: Generic ICICI Debit Fallback
      re = /ICICI Bank (?:Acct|Account|Card)\s*(\w+)?\s*(?:debited|has been debited|spent)\s*(?:for)?\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i;
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
      // Case 1: HDFC UPI Debit: "Money Transfer: Rs 250.00 debited from A/C **1234 to ZOMATO on 14-AUG-26"
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

      // Case 2: HDFC UPI Credit: "Credit Alert!\nRs.1.00 credited to HDFC Bank A/c XX6770 on 17-08-26 from VPA 8966970633@ptyes (UPI 213469064050)"
      re = /Credit Alert!\s*(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*credited to HDFC Bank A\/c\s*(?:[A-Za-z*]+)?(\d+)\s*on\s*([\d]{1,2}-[\w]{2,3}-[\d]{2,4})\s*from\s*(?:VPA\s*)?([^(]+)(?:\s*\(UPI\s*(\d+)\))?/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'HDFC Bank',
          instrument: 'Account',
          account: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[4].trim(),
          rawDate: m[3],
          type: 'credit',
          status: 'Approved',
          paymentMode: 'UPI',
          refNo: m[5] || null,
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
      // SBI Card: "Rs.299.00 spent on your SBI Credit Card ending with 4937 at SelfKYCPrepaid on 18-08-26 via UPI (Ref No. 915221377196)."
      const re = /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s+spent on your SBI Credit Card ending\s+(?:with\s+)?(\w+)\s+at\s+(.+?)\s+on\s+([\d]{1,2}-[\w]{2,3}-[\d]{2,4})/i;
      const m = text.match(re);
      if (m) {
        const refMatch = text.match(/Ref(?:\s*No\.?)?\s*(\d{6,})/i);
        return {
          bank: 'SBI Card',
          instrument: 'Credit Card',
          last4: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[3].trim(),
          rawDate: m[4],
          refNo: refMatch ? refMatch[1] : null,
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
        return { ...result, sourceParser: parser.name, needsLLMFallback: false, rawText: text };
      }
      return { needsLLMFallback: true, sourceParser: parser.name, rawText: text };
    }
  }
  return null;
}

module.exports = { parseTransactionSms, SMS_PARSERS };
