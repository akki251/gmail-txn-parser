/**
 * Deterministic merchant -> category matcher. Same spirit as
 * bankParsers.js's regex-first approach — no LLM, just keyword matching
 * against real merchant strings seen in the inbox.
 */

const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Subscriptions',
  'Bills & Utilities',
  'Entertainment',
  'Investments',
  'Transfers',
  'Travel',
  'Other',
];

const RULES = [
  { category: 'Groceries', pattern: /GROCE|INSTAMART|BIGBASKET|BLINKIT|ZEPTO|^METRO\b|D-?MART/i },
  { category: 'Food & Dining', pattern: /SWIGGY|ZOMATO|FOOD|RESTAURANT|CAFE|EATS|CHAAT|BAZAA|BURGER|PIZZA|\bKFC\b|MCDONALD|DOMINO|STARBUCKS|BAKERY|DHABA|BIRYANI/i },
  { category: 'Subscriptions', pattern: /APPLE MEDIA|NETFLIX|SPOTIFY|PRIME VIDEO|HOTSTAR|YOUTUBE PREMIUM|GOOGLE (PLAY|ONE)/i },
  { category: 'Bills & Utilities', pattern: /JIO|AIRTEL|VODAFONE|VI RECHARGE|ELECTRICITY|BROADBAND|WIFI|DTH|GAS BILL/i },
  { category: 'Investments', pattern: /MUTUAL FUND|ETMONEY|ZERODHA|GROWW|COIN|NPS|SIP/i },
  { category: 'Entertainment', pattern: /BIGTREE|BOOKMYSHOW|EPIC GAMES|STEAM|PVR|INOX|GAMESTORE|GAMES STORE/i },
  { category: 'Travel', pattern: /UBER|OLA|IRCTC|INDIGO|MAKEMYTRIP|REDBUS|AIRLINE|YATRA/i },
  { category: 'Shopping', pattern: /AMAZON|FLIPKART|MYNTRA|AJIO|NYKAA/i },
];

// UPI person-to-person transfers show up as plain human names (two+ words,
// no store-style punctuation like * or ALLCAPS-brand markers).
function looksLikePersonName(merchant) {
  return /^[A-Za-z]+(\s[A-Za-z]+){1,3}$/.test(merchant.trim()) && !/[*]/.test(merchant);
}

// A record's own `bank` field can itself identify the category regardless
// of what the specific merchant/restaurant name looks like — e.g. a
// Swiggy/Zomato order for "Kannu Ki Chai" (three Title Case words, no
// punctuation) would otherwise false-match looksLikePersonName below and
// get miscategorized as a Transfer.
const BANK_RULES = [{ category: 'Food & Dining', pattern: /^(Swiggy|Zomato)/i }];

function categorize(merchant, bank) {
  if (bank) {
    for (const rule of BANK_RULES) {
      if (rule.pattern.test(bank)) return rule.category;
    }
  }

  if (!merchant) return 'Other';
  const trimmed = merchant.trim();

  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) return rule.category;
  }

  if (looksLikePersonName(trimmed)) return 'Transfers';

  return 'Other';
}

module.exports = { categorize, CATEGORIES };
