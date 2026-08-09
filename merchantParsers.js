/**
 * Merchant order-confirmation email parser (Swiggy, Zomato). Same
 * sender-allowlist + regex-per-template shape as bankParsers.js, but for
 * capturing spend that may never generate a matching bank alert (paid via
 * wallet balance, or a bank template we haven't built yet). Records from
 * here carry sourceType: 'merchant' so db.js's cross-source dedupe can
 * recognize when a bank-side alert for the same order also exists.
 */

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00A0/g, ' ') // real NBSP character, not just the &nbsp; entity text
    .replace(/&amp;/gi, '&')
    .replace(/&#8377;/g, '₹')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const MERCHANT_PARSERS = [
  {
    name: 'Swiggy',
    matchSender: (sender) => /swiggy\.in$/i.test(sender),
    parse: (text) => {
      // Cancelled orders aren't a charge — never a transaction, checked
      // before any amount-parsing attempt. Distinct from an unmatched
      // template (null): this is a deliberate "not a transaction", not
      // "couldn't figure it out" — must not fall through to needsReview.
      if (/cancelled/i.test(text)) return { notATransaction: true };

      // Case 1: Dineout — different structure from a regular food order.
      // Real HTML-stripped emails put label and value on separate lines
      // (e.g. "Total Paid \n ₹269"), so every boundary here uses \s+
      // rather than a literal space — a single space only matched the
      // hand-simplified test fixture, not the real message.
      let re = /at\s+(.+?)\s+is\s+successful[\s\S]*?Order ID:\s*(\d+)[\s\S]*?Total Paid\s+₹([\d,]+\.?\d*)/is;
      let m = text.match(re);
      if (m) {
        return {
          bank: 'Swiggy',
          sourceType: 'merchant',
          orderId: m[2],
          amount: parseFloat(m[3].replace(/,/g, '')),
          currency: 'INR',
          merchant: m[1].trim(),
          type: 'debit',
          status: 'Approved',
        };
      }

      // Case 2: regular food order.
      re = /Order ID:\s*(\d+)[\s\S]*?Paid Via\s+([\w\s/]+?)\s+₹([\d,]+\.?\d*)/is;
      m = text.match(re);
      if (m) {
        const merchantMatch = text.match(/ORDER JOURNEY\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
        return {
          bank: 'Swiggy',
          sourceType: 'merchant',
          orderId: m[1],
          amount: parseFloat(m[3].replace(/,/g, '')),
          currency: 'INR',
          merchant: merchantMatch ? merchantMatch[1].trim() : 'Swiggy order',
          paymentMode: m[2].trim(),
          type: 'debit',
          status: 'Approved',
        };
      }

      return null;
    },
  },
  {
    name: 'Zomato',
    matchSender: (sender) => /zomato\.com$/i.test(sender),
    parse: (text) => {
      // Same defensive guard as Swiggy — no real cancelled-order sample
      // seen yet, but skipping is the safe default over guessing.
      if (/cancel/i.test(text)) return { notATransaction: true };

      // Two real templates seen in the wild for a successful order —
      // "Thank you for ordering from X" and "Your order from X was
      // delivered..." — same ORDER ID/Total paid structure otherwise.
      let re = /ordering from\s+(.+?)\s+ORDER ID:\s*(\d+)[\s\S]*?Total paid\s*-\s*₹([\d,]+\.?\d*)/is;
      let m = text.match(re);
      if (!m) {
        re = /Your order from\s+(.+?)\s+was delivered[\s\S]*?ORDER ID:\s*(\d+)[\s\S]*?Total paid\s*-\s*₹([\d,]+\.?\d*)/is;
        m = text.match(re);
      }
      if (!m) return null;
      return {
        bank: 'Zomato',
        sourceType: 'merchant',
        orderId: m[2],
        amount: parseFloat(m[3].replace(/,/g, '')),
        currency: 'INR',
        merchant: m[1].trim(),
        type: 'debit',
        status: 'Approved',
      };
    },
  },
];

function parseMerchantEmail({ sender, htmlBody, plaintextBody }) {
  let text = plaintextBody || (htmlBody ? stripHtml(htmlBody) : '');
  // NBSP normalization only ran inside stripHtml (the htmlBody path) —
  // a raw NBSP in plaintextBody itself would otherwise bypass it entirely.
  text = text.replace(/ /g, ' ');
  if (!text) return null;

  for (const parser of MERCHANT_PARSERS) {
    if (parser.matchSender(sender)) {
      const result = parser.parse(text);
      if (result && result.notATransaction) {
        return null; // deliberately not a transaction (e.g. cancelled) — not a parse failure
      }
      if (result) {
        return { ...result, sourceParser: parser.name, needsLLMFallback: false };
      }
      // Known merchant sender, but template genuinely didn't match — flag
      // it rather than drop it, same as every other parser in this repo.
      return { needsLLMFallback: true, sourceParser: parser.name, rawText: text };
    }
  }
  return null;
}

module.exports = { parseMerchantEmail, MERCHANT_PARSERS };
