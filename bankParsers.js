/**
 * Bank transaction-email parser.
 *
 * Design: sender-domain ALLOWLIST, not a keyword blocklist.
 * Only mail from a sender pattern below is even looked at — so Swiggy
 * "payment failed" mails, income-tax refund notices, promo mail etc.
 * are ignored by construction, no extra filtering logic needed.
 */
const { isNonTransactional } = require('./nonTransactional');

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/ /g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8377;/g, '\u20B9')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function senderMatches(sender, text, keywordPattern) {
  const s = sender || '';
  if (keywordPattern.test(s)) return true;
  // If sender header has no bank domain (e.g. generic SMS relay or manual ingest), fallback to body text search
  if ((!s || !/\.[a-z]{2,}$/i.test(s)) && keywordPattern.test(text || '')) return true;
  return false;
}

const BANK_PARSERS = [
  {
    name: 'IndusInd Credit Card',
    matchSender: (sender, text) => senderMatches(sender, text, /indusind/i),
    parse: (text) => {
      const re =
        /IndusInd Bank Credit Card ending (\d+)\s+for\s+INR\s+([\d,]+\.\d{2})\s+on\s+([\d-]{10}\s+[\d:]{5,8}\s*(?:am|pm))\s+at\s+(.+?)\s+is\s+(Approved|Declined)/i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'IndusInd Bank',
        instrument: 'Credit Card',
        last4: m[1],
        amount: parseFloat(m[2].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[4].trim(),
        status: m[5],
        type: 'debit',
        rawDate: m[3],
      };
    },
  },
  {
    name: 'SBI Card',
    matchSender: (sender, text) => senderMatches(sender, text, /sbicard|sbi/i),
    parse: (text) => {
      const re =
        /Rs\.?\s?([\d,]+\.\d{2})\s+spent on your SBI Credit Card ending with (\d+)\s+at\s+(.+?)\s+on\s+([\d-]{8})\s+via\s+(\w+)(?:\s+\(Ref No\.?\s*([\d]+)\))?/i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'SBI Card',
        instrument: 'Credit Card',
        last4: m[2],
        amount: parseFloat(m[1].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[3].trim(),
        rawDate: m[4],
        paymentMode: m[5],
        refNo: m[6] || null,
        type: 'debit',
        status: 'Approved',
      };
    },
  },
  {
    name: 'HDFC Bank',
    matchSender: (sender, text) => senderMatches(sender, text, /hdfc/i),
    parse: (text) => {
      // Case 1: credit card purchase
      let re =
        /Rs\.?\s?([\d,]+\.\d{2})\s+has been debited from your HDFC Bank Credit Card ending\s+(\d+)\s+towards\s+(.+?)\s+on\s+(\d{1,2}\s+\w{3},\s+\d{4}\s+at\s+[\d:]{5,8})/i;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'HDFC Bank',
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
      // Case 2: UPI debit from bank account
      re =
        /Rs\.?\s?([\d,]+\.\d{2})\s+is debited from your account ending\s+(\d+)\s+towards\s+VPA\s+\S+\s*\(([^)]+)\)\s+on\s+([\d-]{8})\.\s*UPI transaction reference no\.:\s*(\d+)/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'HDFC Bank',
          instrument: 'Account',
          account: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[3].trim(),
          rawDate: m[4],
          paymentMode: 'UPI',
          refNo: m[5],
          type: 'debit',
          status: 'Approved',
        };
      }
      // Case 3: UPI credit into bank account
      re =
        /Rs\.?\s?([\d,]+\.\d{2})\s+has been successfully credited to your HDFC Bank account ending in\s+(\d+)\.\s*Transaction Details:\s*a\.\s*Date:\s*([\d-]{8})\s*b\.\s*Sender:\s*(.+?)\s*\(VPA:/i;
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
          paymentMode: 'UPI',
          type: 'credit',
          status: 'Approved',
        };
      }
      return null;
    },
  },
  {
    name: 'ICICI Bank',
    matchSender: (sender, text) => senderMatches(sender, text, /icici/i),
    parse: (text) => {
      // Case 1: debit card purchase
      let re =
        /A purchase of Rs\.?\s?([\d,]+\.\d{2})\s+has been made using your Debit Card linked to ICICI Bank Account (\w+)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})\.\s*Info:\s*([^.]+)\./i;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Debit Card',
          account: m[2],
          amount: parseFloat(m[1].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[4].trim(),
          rawDate: m[3],
          type: 'debit',
          status: 'Approved',
        };
      }
      // Case 2: account credited (salary, refund, interest, etc.)
      re =
        /Your ICICI Bank Account (\w+)\s+has been credited with INR\s+([\d,]+(?:\.\d+)?)\s+on\s+([\d]{1,2}-\w{3}-\d{2,4})/i;
      m = text.match(re);
      if (m) {
        return {
          bank: 'ICICI Bank',
          instrument: 'Account',
          account: m[1],
          amount: parseFloat(m[2].replace(/,/g, '')),
          currency: 'INR',
          merchant: null,
          rawDate: m[3],
          type: 'credit',
          status: 'Approved',
        };
      }
      return null;
    },
  },
  {
    name: 'Axis Bank',
    matchSender: (sender, text) => senderMatches(sender, text, /axis/i),
    parse: (text) => {
      const re =
        /Transaction Amount:\s*INR\s*([\d,]+\.?\d*)\s*Merchant Name:\s*(.+?)\s*Axis Bank Credit Card No\.\s*(\w+)\s*Date\s*&\s*Time:\s*([\d-]{10},\s*[\d:]{5,8}\s*\w*)/i;
      const m = text.match(re);
      if (!m) return null;
      return {
        bank: 'Axis Bank',
        instrument: 'Credit Card',
        last4: m[3],
        amount: parseFloat(m[1].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[2].trim(),
        rawDate: m[4],
        type: 'debit',
        status: 'Approved',
      };
    },
  },
];

function parseTransactionEmail({ sender, htmlBody, plaintextBody }) {
  const text = plaintextBody || (htmlBody ? stripHtml(htmlBody) : '');
  if (!text) return null;

  for (const parser of BANK_PARSERS) {
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

module.exports = { parseTransactionEmail, stripHtml, BANK_PARSERS };
