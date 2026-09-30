// obligationDetector.js — Predictable & Recurring Financial Obligations Intelligence Engine
// Identifies, tracks, predicts, and unifies upcoming financial obligations across:
// 1. Subscriptions & Recurring Payments (OTT, software, utilities, fixed vs variable)
// 2. SIP & Investment Commitments (monthly, semi-monthly, distinguishing from one-time)
// 3. Insurance Premiums & Periodic Payments (term/health insurance, email prioritization, annual intervals)

const KNOWN_ENTITIES = {
  // --- Subscriptions & Recurring Software / Lifestyle ---
  subscriptions: [
    {
      id: 'netflix',
      name: 'Netflix',
      category: 'Subscription',
      aliases: ['netflix', 'netflix.com', 'netflix entertainment'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [149, 199, 499, 649],
    },
    {
      id: 'spotify',
      name: 'Spotify India',
      category: 'Subscription',
      aliases: ['spotify', 'spotify india', 'spotify ab'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [119, 179, 719, 999],
    },
    {
      id: 'apple_services',
      name: 'Apple Services (iCloud / Music)',
      category: 'Subscription',
      aliases: ['apple media', 'apple.com/bill', 'apple services', 'itunes'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [75, 219, 399],
    },
    {
      id: 'google_one',
      name: 'Google One / Workspace',
      category: 'Subscription',
      aliases: ['google play', 'google one', 'google storage', 'google workspace'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [130, 210, 650, 1300],
    },
    {
      id: 'amazon_prime',
      name: 'Amazon Prime',
      category: 'Subscription',
      aliases: ['amazon prime', 'prime video', 'prime membership'],
      defaultFrequency: 'Annual',
      isFixed: true,
      typicalAmounts: [1499, 799],
    },
    {
      id: 'youtube_premium',
      name: 'YouTube Premium',
      category: 'Subscription',
      aliases: ['youtube premium', 'youtube music', 'google youtube'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [129, 149, 189, 299],
    },
    {
      id: 'disney_hotstar',
      name: 'JioHotstar / Disney+ Hotstar',
      category: 'Subscription',
      aliases: ['hotstar', 'disney hotstar', 'jiohotstar', 'novi digital'],
      defaultFrequency: 'Annual',
      isFixed: true,
      typicalAmounts: [899, 1499, 499],
    },
    {
      id: 'openai_chatgpt',
      name: 'OpenAI ChatGPT Plus',
      category: 'Subscription',
      aliases: ['openai', 'chatgpt', 'openai *chatgpt'],
      defaultFrequency: 'Monthly',
      isFixed: false, // Variable due to USD-INR forex fluctuations (~₹1,999 - ₹2,150)
      typicalAmounts: [1999, 2050, 2100],
    },
    {
      id: 'github',
      name: 'GitHub Copilot / Pro',
      category: 'Subscription',
      aliases: ['github', 'github copilot', 'github inc'],
      defaultFrequency: 'Monthly',
      isFixed: false, // USD forex conversion
      typicalAmounts: [850, 1000],
    },
    {
      id: 'cult_fit',
      name: 'Cult.fit Gym & Fitness',
      category: 'Subscription',
      aliases: ['cult.fit', 'curefit', 'cult fit', 'cure fit healthcare'],
      defaultFrequency: 'Monthly',
      isFixed: true,
      typicalAmounts: [1250, 1500, 2200],
    },
  ],

  // --- Utilities & Broadband (Variable amounts) ---
  utilities: [
    {
      id: 'airtel_fiber',
      name: 'Airtel Xstream Fiber / Postpaid',
      category: 'Utility',
      aliases: ['airtel', 'bharti airtel', 'airtel broadband', 'airtel fiber', 'airtel limited'],
      defaultFrequency: 'Monthly',
      isFixed: false,
      typicalAmounts: [1179, 943, 1415, 599],
    },
    {
      id: 'jio_fiber',
      name: 'Jio Fiber / Postpaid',
      category: 'Utility',
      aliases: ['jio', 'reliance jio', 'jio fiber', 'jiorecharge'],
      defaultFrequency: 'Monthly',
      isFixed: false,
      typicalAmounts: [824, 1179, 470],
    },
    {
      id: 'electricity_bill',
      name: 'Electricity / Power Utility',
      category: 'Utility',
      aliases: ['bescom', 'tata power', 'adani electricity', 'mseb', 'mahadiscom', 'cesc', 'uppcl', 'electricity bill'],
      defaultFrequency: 'Monthly',
      isFixed: false,
      typicalAmounts: [1500, 2500, 3500],
    },
    {
      id: 'piped_gas',
      name: 'Piped Natural Gas (MGL / IGL)',
      category: 'Utility',
      aliases: ['mahanagar gas', 'igl', 'mgl', 'indraprastha gas', 'gas bill'],
      defaultFrequency: 'Bi-Monthly',
      isFixed: false,
      typicalAmounts: [800, 1200],
    },
  ],

  // --- SIP & Investment Commitments ---
  investments: [
    {
      id: 'nippon_mf',
      name: 'Nippon India Mutual Fund',
      category: 'SIP',
      aliases: ['nippon india mutual fund', 'nippon.bdpg.mf', 'nippon mf', 'nippon mutual fund'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'parag_parikh_mf',
      name: 'Parag Parikh Flexi Cap Fund (PPFAS)',
      category: 'SIP',
      aliases: ['parag parikh', 'ppfas mutual fund', 'ppfas', 'ppfas mf'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'hdfc_mf',
      name: 'HDFC Mutual Fund',
      category: 'SIP',
      aliases: ['hdfc mutual fund', 'hdfc amc', 'hdfc mf', 'hdfcamc'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'sbi_mf',
      name: 'SBI Mutual Fund',
      category: 'SIP',
      aliases: ['sbi mutual fund', 'sbimf', 'sbi funds management'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'mirae_asset_mf',
      name: 'Mirae Asset Mutual Fund',
      category: 'SIP',
      aliases: ['mirae asset', 'mirae asset mutual fund', 'mirae mf'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'zerodha_coin_mf',
      name: 'Zerodha Coin / AMC SIP',
      category: 'SIP',
      aliases: ['zerodha broking', 'zerodha coin', 'coin sip', 'bse star mf', 'zerodha'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'groww_invest',
      name: 'Groww Investments SIP',
      category: 'SIP',
      aliases: ['groww', 'growwpay', 'nextbillion technology', 'billdesk groww'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'uti_mf',
      name: 'UTI Mutual Fund',
      category: 'SIP',
      aliases: ['uti mutual fund', 'uti amc', 'uti mf'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'quant_mf',
      name: 'Quant Mutual Fund',
      category: 'SIP',
      aliases: ['quant mutual fund', 'quant money managers', 'quant mf'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
    {
      id: 'icici_pru_mf',
      name: 'ICICI Prudential Mutual Fund',
      category: 'SIP',
      aliases: ['icici prudential mutual fund', 'icici pru mf', 'icici amc'],
      defaultFrequency: 'Monthly',
      isFixed: true,
    },
  ],

  // --- Insurance Premiums & Periodic Policies ---
  insurance: [
    {
      id: 'hdfc_life_term',
      name: 'HDFC Life Term Insurance',
      category: 'Insurance',
      subType: 'Term Insurance',
      aliases: ['hdfc life', 'hdfc standard life', 'hdfc life insurance', 'hdfclife'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'icici_pru_life',
      name: 'ICICI Prudential Life Insurance',
      category: 'Insurance',
      subType: 'Term Insurance',
      aliases: ['icici prudential life', 'icici pru life', 'icici prudential life insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'max_life',
      name: 'Max Life Insurance',
      category: 'Insurance',
      subType: 'Term Insurance',
      aliases: ['max life insurance', 'max life', 'maxlife'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'lic_india',
      name: 'LIC of India',
      category: 'Insurance',
      subType: 'Life Insurance',
      aliases: ['lic of india', 'lic', 'life insurance corporation'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'tata_aia',
      name: 'Tata AIA Life Insurance',
      category: 'Insurance',
      subType: 'Term Insurance',
      aliases: ['tata aia', 'tata aia life', 'tata aia life insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'star_health',
      name: 'Star Health Insurance',
      category: 'Insurance',
      subType: 'Health Insurance',
      aliases: ['star health', 'star health and allied insurance', 'star health insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'hdfc_ergo',
      name: 'HDFC ERGO General Insurance',
      category: 'Insurance',
      subType: 'Health Insurance',
      aliases: ['hdfc ergo', 'hdfc ergo health', 'hdfc ergo general insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'care_health',
      name: 'Care Health Insurance (Religare)',
      category: 'Insurance',
      subType: 'Health Insurance',
      aliases: ['care health insurance', 'care health', 'religare health insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'niva_bupa',
      name: 'Niva Bupa Health Insurance',
      category: 'Insurance',
      subType: 'Health Insurance',
      aliases: ['niva bupa', 'max bupa', 'niva bupa health insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
    {
      id: 'icici_lombard',
      name: 'ICICI Lombard Health & Motor',
      category: 'Insurance',
      subType: 'General Insurance',
      aliases: ['icici lombard', 'icici lombard general insurance'],
      defaultFrequency: 'Annual',
      isFixed: true,
    },
  ],
};

// Merchants that are frequently repeated but NOT predictable subscriptions
// (e.g. food delivery, cab rides, daily grocery pickups, retail shopping, e-commerce)
const NON_RECURRING_MERCHANT_PATTERNS = [
  /SWIGGY/i,
  /ZOMATO/i,
  /BLINKIT/i,
  /INSTAMART/i,
  /ZEPTO/i,
  /BIGBASKET(?!.*BBDAILY)/i,
  /UBER/i,
  /OLA/i,
  /RAPIDO/i,
  /AMAZON(?!\s+PRIME)/i,
  /FLIPKART/i,
  /MYNTRA/i,
  /BOOKMYSHOW/i,
  /BIGTREE/i,
  /PVR/i,
  /INOX/i,
  /KFC/i,
  /MCDONALD/i,
  /BURGER KING/i,
  /STARBUCKS/i,
  /CHAI/i,
  /DHABA/i,
  /ATM/i,
  /IRCTC/i,
  /INDIGO/i,
  /MAKEMYTRIP/i,
];

/**
 * Normalizes input date to local calendar day (year, month 0-indexed, day 1-indexed)
 */
function parseDateParts(inputDate) {
  const d = inputDate ? new Date(inputDate) : new Date();
  if (isNaN(d.getTime())) return parseDateParts(new Date());
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    dateObj: d,
  };
}

/**
 * Normalizes merchant name for clean grouping
 */
function normalizeObligationMerchant(rawMerchant) {
  if (!rawMerchant) return '';
  let str = String(rawMerchant).trim().toLowerCase();
  // Strip common UPI / payment gateway prefixes and suffixes
  str = str.replace(/^(vpa\s+|upi\/|neft-|rtgs-|inb\/|pos\/|e-mandate\/)/i, '');
  str = str.replace(/@(validicici|okaxis|okhdfcbank|oksbi|paytm|ybl|ptyes)$/i, '');
  str = str.replace(/\s+(ltd|limited|pvt|private|inc|corp|services|india|technologies)\.?$/i, '');
  return str.trim();
}

/**
 * Matches a merchant name against known entities
 */
function matchKnownEntity(merchantName) {
  if (!merchantName) return null;
  const norm = normalizeObligationMerchant(merchantName);

  for (const [group, entities] of Object.entries(KNOWN_ENTITIES)) {
    for (const ent of entities) {
      if (ent.aliases.some(alias => norm.includes(alias.toLowerCase()) || alias.toLowerCase().includes(norm))) {
        return { ...ent, groupKey: group };
      }
    }
  }
  return null;
}

/**
 * Tests if merchant is an ad-hoc repeated retail purchase (Swiggy, Uber, etc.)
 */
function isAdhocRetailMerchant(merchantName) {
  if (!merchantName) return false;
  return NON_RECURRING_MERCHANT_PATTERNS.some(re => re.test(merchantName));
}

/**
 * Computes difference in days between two Date objects
 */
function daysBetween(date1, date2) {
  const ONE_DAY = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs((date2.getTime() - date1.getTime()) / ONE_DAY));
}

/**
 * Analyzes inter-transaction day intervals to identify cadence
 */
function analyzeCadence(sortedTxns) {
  if (sortedTxns.length < 2) {
    return { frequency: 'Unknown', isPeriodic: false, avgIntervalDays: 0, intervalStdDev: 0 };
  }

  const intervals = [];
  for (let i = 1; i < sortedTxns.length; i++) {
    const dPrev = new Date(sortedTxns[i - 1].date);
    const dCurr = new Date(sortedTxns[i].date);
    const diff = daysBetween(dPrev, dCurr);
    if (diff > 0) intervals.push(diff);
  }

  if (intervals.length === 0) {
    return { frequency: 'Unknown', isPeriodic: false, avgIntervalDays: 0, intervalStdDev: 0 };
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Check for Semi-Monthly (13 - 17 days)
  if (avgInterval >= 12 && avgInterval <= 18 && (intervals.length >= 2 || stdDev < 4)) {
    return { frequency: 'Semi-Monthly', isPeriodic: true, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
  }

  // Check for Monthly (25 - 35 days)
  if (avgInterval >= 25 && avgInterval <= 35 && (intervals.length >= 1 || stdDev < 6)) {
    return { frequency: 'Monthly', isPeriodic: true, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
  }

  // Check for Quarterly (80 - 100 days)
  if (avgInterval >= 75 && avgInterval <= 105) {
    return { frequency: 'Quarterly', isPeriodic: true, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
  }

  // Check for Semi-Annual (170 - 195 days)
  if (avgInterval >= 165 && avgInterval <= 200) {
    return { frequency: 'Semi-Annual', isPeriodic: true, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
  }

  // Check for Annual (345 - 385 days)
  if (avgInterval >= 340 && avgInterval <= 390) {
    return { frequency: 'Annual', isPeriodic: true, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
  }

  return { frequency: 'Irregular', isPeriodic: false, avgIntervalDays: avgInterval, intervalStdDev: stdDev };
}

/**
 * Analyzes transaction amounts to detect fixed vs variable and amount changes
 */
function analyzeAmounts(sortedTxns) {
  const amounts = sortedTxns.map(t => Number(t.amount)).filter(a => !isNaN(a) && a > 0);
  if (amounts.length === 0) {
    return { amount: 0, isFixed: true, amountChanged: false, previousAmount: null, amountDiff: 0 };
  }

  const latestAmount = amounts[amounts.length - 1];
  const firstAmount = amounts[0];
  const minAmt = Math.min(...amounts);
  const maxAmt = Math.max(...amounts);
  const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  const isFixed = (maxAmt - minAmt) <= Math.max(10, avgAmt * 0.05);

  let amountChanged = false;
  let previousAmount = null;
  let amountDiff = 0;

  if (amounts.length >= 2) {
    const prevAmt = amounts[amounts.length - 2];
    if (Math.abs(latestAmount - prevAmt) >= 1) {
      amountChanged = true;
      previousAmount = prevAmt;
      amountDiff = latestAmount - prevAmt;
    }
  }

  return {
    amount: latestAmount,
    averageAmount: Math.round(avgAmt * 100) / 100,
    isFixed,
    amountChanged,
    previousAmount,
    amountDiff,
  };
}

/**
 * Predicts the next expected due date based on cadence and last payment date
 */
function predictNextDate(lastDate, frequency, asOfDate = new Date()) {
  const d = new Date(lastDate);
  const asOf = new Date(asOfDate);
  if (isNaN(d.getTime())) return new Date(asOf);

  let candidate = new Date(d);

  const advanceCandidate = (dt) => {
    const res = new Date(dt);
    if (frequency === 'Semi-Monthly') {
      res.setDate(res.getDate() + 15);
    } else if (frequency === 'Monthly') {
      res.setMonth(res.getMonth() + 1);
    } else if (frequency === 'Quarterly') {
      res.setMonth(res.getMonth() + 3);
    } else if (frequency === 'Semi-Annual') {
      res.setMonth(res.getMonth() + 6);
    } else if (frequency === 'Annual') {
      res.setFullYear(res.getFullYear() + 1);
    } else {
      res.setMonth(res.getMonth() + 1);
    }
    return res;
  };

  candidate = advanceCandidate(candidate);

  // If the candidate date is in the past compared to asOfDate (e.g. last recorded txn was 3 months ago),
  // roll it forward until it reaches the next upcoming cycle relative to asOfDate.
  let safetyCounter = 0;
  while (candidate < asOf && safetyCounter < 48) {
    candidate = advanceCandidate(candidate);
    safetyCounter++;
  }

  return candidate;
}

/**
 * Parses upcoming obligations from Email notices / alerts (Insurance renewals, SIP mandate notices, Utility bills)
 */
function parseObligationEmail(emailData) {
  const { subject = '', body = '', from = '', date } = emailData;
  const combined = `${subject}\n${body}`;

  // Check for Insurance Renewal / Premium Due notices
  const isInsuranceEmail = /insurance|premium\s+due|policy\s+renewal|renewal\s+premium|policy\s+number/i.test(combined);
  const isSipEmail = /sip|mutual\s+fund|mandate|systematic\s+investment|installment/i.test(combined);
  const isUtilityEmail = /electricity\s+bill|broadband\s+bill|bill\s+generated|bill\s+due\s+date|pay\s+before|water\s+bill/i.test(combined);
  const isSubscriptionEmail = /subscription\s+renewed|membership\s+renewal|auto-renew|next\s+billing\s+date/i.test(combined);

  if (!isInsuranceEmail && !isSipEmail && !isUtilityEmail && !isSubscriptionEmail) {
    return null;
  }

  // Extract Due Amount
  let amount = null;
  const amtMatch = combined.match(/(?:premium\s+amount|bill\s+amount|due\s+amount|amount\s+payable|total\s+due|amount|rs\.?|inr|₹)\s*:?\s*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)/i);
  if (amtMatch) {
    const rawVal = amtMatch[1].replace(/,/g, '');
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  }

  // Extract Due Date
  let dueDate = null;
  const dateMatch = combined.match(/(?:due\s+date|due\s+on|due\s+by|pay\s+by|pay\s+before|renewal\s+date|billing\s+date|deduction\s+date)\s*:?\s*(?:on\s+)?(\d{1,2}(?:st|nd|rd|th)?[\s/-]+[A-Za-z]+[\s/-]+\d{2,4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (dateMatch) {
    const rawDate = dateMatch[1].replace(/(st|nd|rd|th)/gi, '');
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) dueDate = parsed;
  }

  // Extract Policy / Account Ref
  let refNumber = null;
  const refMatch = combined.match(/(?:policy\s+no\.?|policy\s+number|account\s+no\.?|mandate\s+id)\s*:?\s*([A-Za-z0-9-]+)/i);
  if (refMatch) {
    refNumber = refMatch[1].trim();
  }

  // Identify Provider
  let merchant = 'Unknown Obligation';
  let category = 'Subscription';
  let frequency = 'Monthly';

  if (isInsuranceEmail) {
    category = 'Insurance';
    frequency = 'Annual';
    if (/hdfc\s+life/i.test(combined)) merchant = 'HDFC Life Term Insurance';
    else if (/icici\s+prudential|icici\s+pru/i.test(combined)) merchant = 'ICICI Prudential Life Insurance';
    else if (/max\s+life/i.test(combined)) merchant = 'Max Life Insurance';
    else if (/star\s+health/i.test(combined)) merchant = 'Star Health Insurance';
    else if (/care\s+health|religare/i.test(combined)) merchant = 'Care Health Insurance';
    else if (/hdfc\s+ergo/i.test(combined)) merchant = 'HDFC ERGO General Insurance';
    else if (/niva\s+bupa|max\s+bupa/i.test(combined)) merchant = 'Niva Bupa Health Insurance';
    else if (/lic/i.test(combined)) merchant = 'LIC of India';
    else merchant = 'Life / Health Insurance';
  } else if (isSipEmail) {
    category = 'SIP';
    frequency = 'Monthly';
    if (/nippon/i.test(combined)) merchant = 'Nippon India Mutual Fund';
    else if (/parag\s+parikh|ppfas/i.test(combined)) merchant = 'Parag Parikh Flexi Cap Fund (PPFAS)';
    else if (/hdfc/i.test(combined)) merchant = 'HDFC Mutual Fund';
    else if (/zerodha|coin/i.test(combined)) merchant = 'Zerodha Coin SIP';
    else if (/groww/i.test(combined)) merchant = 'Groww Investments SIP';
    else merchant = 'Mutual Fund SIP';
  } else if (isUtilityEmail) {
    category = 'Utility';
    frequency = 'Monthly';
    if (/airtel/i.test(combined)) merchant = 'Airtel Xstream Fiber';
    else if (/jio/i.test(combined)) merchant = 'Jio Fiber';
    else if (/bescom|electricity|power/i.test(combined)) merchant = 'Electricity Bill';
    else merchant = 'Utility Bill';
  } else if (isSubscriptionEmail) {
    category = 'Subscription';
    frequency = 'Monthly';
    if (/netflix/i.test(combined)) merchant = 'Netflix';
    else if (/spotify/i.test(combined)) merchant = 'Spotify India';
    else if (/google/i.test(combined)) merchant = 'Google One';
    else if (/apple/i.test(combined)) merchant = 'Apple Services';
  }

  return {
    merchant,
    category,
    amount,
    dueDate: dueDate ? dueDate.toISOString() : null,
    frequency,
    refNumber,
    isConfirmed: true,
    source: 'Email',
    confidence: 'High',
    rawSubject: subject,
    receivedAt: date || new Date().toISOString(),
  };
}

/**
 * Core detector: Analyzes historical transactions and extracts recurring obligations
 */
function detectObligationsFromTransactions(transactions = [], asOfDate = new Date()) {
  const asOf = parseDateParts(asOfDate).dateObj;

  // Filter only debits with valid amounts
  const debits = transactions.filter(t => t.type === 'debit' && Number(t.amount) > 0 && !t.notATransaction);

  // Group by entity key: known entity ID or normalized merchant name
  const groups = {};

  for (const txn of debits) {
    const rawMerchant = txn.merchant || txn.rawMerchant || '';
    if (!rawMerchant) continue;

    // Reject ad-hoc retail merchants that happen repeatedly (Swiggy, Uber, etc.)
    if (isAdhocRetailMerchant(rawMerchant)) {
      continue;
    }

    const known = matchKnownEntity(rawMerchant);
    const groupKey = known ? known.id : normalizeObligationMerchant(rawMerchant);

    if (!groupKey || groupKey.length < 2) continue;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        rawMerchant,
        displayName: known ? known.name : rawMerchant,
        category: known ? known.category : (txn.category === 'Investments' ? 'SIP' : 'Subscription'),
        subType: known ? known.subType : null,
        knownConfig: known,
        account: txn.account || txn.last4 || null,
        transactions: [],
      };
    }

    groups[groupKey].transactions.push(txn);
  }

  const detectedObligations = [];

  for (const group of Object.values(groups)) {
    // Sort chronologically
    group.transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const count = group.transactions.length;

    // Minimum occurrences required:
    // If it's a known subscription/SIP/Insurance entity, even 1 transaction gives a strong seed for prediction.
    // If unknown payee, require at least 2 occurrences with regular intervals to prevent false positives.
    if (!group.knownConfig && count < 2) {
      continue;
    }

    const cadence = analyzeCadence(group.transactions);

    // If unknown and cadence is irregular, skip it (ensures we don't treat random repeated spends as obligations)
    if (!group.knownConfig && !cadence.isPeriodic) {
      continue;
    }

    const frequency = cadence.isPeriodic ? cadence.frequency : (group.knownConfig ? group.knownConfig.defaultFrequency : 'Monthly');
    const amountStats = analyzeAmounts(group.transactions);

    const isFixed = group.knownConfig ? group.knownConfig.isFixed : amountStats.isFixed;
    const lastTxn = group.transactions[group.transactions.length - 1];
    const lastPaymentDate = new Date(lastTxn.date);

    const nextExpectedDate = predictNextDate(lastPaymentDate, frequency, asOf);
    const daysRemaining = daysBetween(asOf, nextExpectedDate);

    // Compute confidence
    let confidence = 'Medium';
    if (group.knownConfig && count >= 2) confidence = 'High';
    else if (count >= 3 && cadence.isPeriodic) confidence = 'High';
    else if (group.knownConfig) confidence = 'High';

    let source = 'Transactions';
    if (group.category === 'SIP') {
      source = 'Bank/Investment data';
    }

    // Determine account/payment method
    const accountInfo = lastTxn.bank
      ? `${lastTxn.bank}${lastTxn.account || lastTxn.last4 ? ` (${lastTxn.account || lastTxn.last4})` : ''}`
      : (lastTxn.instrument || 'Bank Account');

    detectedObligations.push({
      id: `ob_${group.key}`,
      key: group.key,
      merchant: group.displayName,
      rawMerchant: group.rawMerchant,
      category: group.category,
      subType: group.subType,
      amount: amountStats.amount,
      averageAmount: amountStats.averageAmount,
      isFixed,
      amountChanged: amountStats.amountChanged,
      previousAmount: amountStats.previousAmount,
      amountDiff: amountStats.amountDiff,
      frequency,
      lastPaymentDate: lastPaymentDate.toISOString(),
      expectedDate: nextExpectedDate.toISOString(),
      daysRemaining,
      source,
      status: 'predicted',
      confidence,
      historyCount: count,
      accountInfo,
      isPaidThisCycle: false,
    });
  }

  return detectedObligations;
}

/**
 * Merges Email Notices with Transaction-Derived Obligations
 * Satisfies requirements:
 * 1. Prioritizes explicit due dates from insurer emails over predictions based only on historical transactions.
 * 2. Clearly distinguishes confirmed upcoming payments from predicted payments.
 * 3. Avoids double-counting the same obligation when it appears in both email and transaction data.
 */
function fuseObligations(transactionObligations = [], emailNotices = [], asOfDate = new Date()) {
  const asOf = parseDateParts(asOfDate).dateObj;
  const mergedMap = new Map();

  // Index transaction obligations
  for (const ob of transactionObligations) {
    mergedMap.set(ob.key, { ...ob });
  }

  // Merge in explicit email notices
  for (const notice of emailNotices) {
    const known = matchKnownEntity(notice.merchant);
    const noticeKey = known ? known.id : normalizeObligationMerchant(notice.merchant);

    const existing = mergedMap.get(noticeKey);

    if (existing) {
      // Obligation exists in both email and transactions — FUSE them!
      // Requirement: Prioritize explicit email due date & amount
      const explicitDueDate = notice.dueDate ? new Date(notice.dueDate) : new Date(existing.expectedDate);
      const daysRemaining = daysBetween(asOf, explicitDueDate);

      // Check if amount changed compared to historical transaction
      let amountChanged = existing.amountChanged;
      let previousAmount = existing.previousAmount;
      let amountDiff = existing.amountDiff;

      if (notice.amount && notice.amount !== existing.amount) {
        amountChanged = true;
        previousAmount = existing.amount;
        amountDiff = notice.amount - existing.amount;
      }

      mergedMap.set(noticeKey, {
        ...existing,
        merchant: notice.merchant || existing.merchant,
        amount: notice.amount || existing.amount,
        expectedDate: explicitDueDate.toISOString(),
        daysRemaining,
        frequency: notice.frequency || existing.frequency,
        source: 'Email + history', // Unified source
        status: 'confirmed',       // Confirmed by explicit email
        confidence: 'High',
        policyOrRef: notice.refNumber || existing.policyOrRef || null,
        emailNoticeSnippet: notice.rawSubject || null,
        amountChanged,
        previousAmount,
        amountDiff,
      });
    } else {
      // Email notice exists without prior transaction history in db (e.g. brand new policy or unparsed bank)
      const explicitDueDate = notice.dueDate ? new Date(notice.dueDate) : predictNextDate(asOf, notice.frequency || 'Monthly', asOf);
      const daysRemaining = daysBetween(asOf, explicitDueDate);

      mergedMap.set(noticeKey, {
        id: `ob_${noticeKey}`,
        key: noticeKey,
        merchant: notice.merchant,
        category: notice.category || 'Insurance',
        subType: notice.category === 'Insurance' ? 'Policy Premium' : null,
        amount: notice.amount || 0,
        averageAmount: notice.amount || 0,
        isFixed: true,
        amountChanged: false,
        previousAmount: null,
        amountDiff: 0,
        frequency: notice.frequency || 'Annual',
        lastPaymentDate: null,
        expectedDate: explicitDueDate.toISOString(),
        daysRemaining,
        source: 'Email',
        status: 'confirmed',
        confidence: 'High',
        historyCount: 0,
        accountInfo: 'Email Statement Notice',
        policyOrRef: notice.refNumber || null,
        emailNoticeSnippet: notice.rawSubject || null,
        isPaidThisCycle: false,
      });
    }
  }

  // Convert map to sorted array (soonest due first)
  const results = Array.from(mergedMap.values());
  results.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

  return results;
}

/**
 * Builds the complete Financial Obligations Overview, Timeline, and Calendar Runway
 */
function getObligationsOverview(transactions = [], emailNotices = [], overrides = {}, asOfDate = new Date()) {
  const asOfParts = parseDateParts(asOfDate);
  const asOf = asOfParts.dateObj;

  // 1. Detect from transactions
  const txObligations = detectObligationsFromTransactions(transactions, asOf);

  // 2. Fuse with email notices
  let allObligations = fuseObligations(txObligations, emailNotices, asOf);

  // 3. Apply manual overrides (e.g. user marked as paid, changed date, or adjusted amount)
  allObligations = allObligations.map(ob => {
    const ov = overrides[ob.id] || overrides[ob.key];
    if (ov) {
      const merged = { ...ob, ...ov };
      if (ov.expectedDate) {
        merged.daysRemaining = daysBetween(asOf, new Date(ov.expectedDate));
      }
      return merged;
    }
    return ob;
  });

  // Re-sort chronologically
  allObligations.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

  // 4. Time horizons
  const next7Days = [];
  const next30Days = [];
  const thisMonthList = [];
  const nextMonthList = [];
  const laterList = [];

  const curMonth = asOfParts.month;
  const curYear = asOfParts.year;

  let total7Days = 0;
  let total30Days = 0;
  let monthlyCommittedRunrate = 0;
  let fixedCount = 0;
  let variableCount = 0;

  for (const ob of allObligations) {
    const obDate = new Date(ob.expectedDate);
    const obMonth = obDate.getMonth();
    const obYear = obDate.getFullYear();

    const diffDays = Math.ceil((obDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
      next7Days.push(ob);
      total7Days += Number(ob.amount || 0);
    }

    if (diffDays >= 0 && diffDays <= 30) {
      next30Days.push(ob);
      total30Days += Number(ob.amount || 0);
    }

    // Monthly commitments
    if (ob.frequency === 'Monthly') {
      monthlyCommittedRunrate += Number(ob.amount || 0);
    } else if (ob.frequency === 'Semi-Monthly') {
      monthlyCommittedRunrate += Number(ob.amount || 0) * 2;
    } else if (ob.frequency === 'Annual') {
      monthlyCommittedRunrate += Number(ob.amount || 0) / 12;
    } else if (ob.frequency === 'Quarterly') {
      monthlyCommittedRunrate += Number(ob.amount || 0) / 3;
    }

    if (ob.isFixed) fixedCount++;
    else variableCount++;

    if (obMonth === curMonth && obYear === curYear) {
      thisMonthList.push(ob);
    } else if ((obYear === curYear && obMonth === curMonth + 1) || (curMonth === 11 && obMonth === 0 && obYear === curYear + 1)) {
      nextMonthList.push(ob);
    } else {
      laterList.push(ob);
    }
  }

  // Category breakdown
  const categoryStats = {
    Subscription: { count: 0, total: 0 },
    SIP: { count: 0, total: 0 },
    Insurance: { count: 0, total: 0 },
    Utility: { count: 0, total: 0 },
  };

  allObligations.forEach(ob => {
    const cat = categoryStats[ob.category] ? ob.category : 'Subscription';
    categoryStats[cat].count++;
    categoryStats[cat].total += Number(ob.amount || 0);
  });

  // Calendar Day Map for the active month (1..31)
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const calendarDays = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(curYear, curMonth, d);
    const dayObligations = allObligations.filter(ob => {
      const dt = new Date(ob.expectedDate);
      return dt.getDate() === d && dt.getMonth() === curMonth && dt.getFullYear() === curYear;
    });

    const dayTotal = dayObligations.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    calendarDays.push({
      day: d,
      date: dayDate.toISOString().split('T')[0],
      dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
      obligations: dayObligations,
      totalAmount: dayTotal,
      hasObligation: dayObligations.length > 0,
      isPast: d < asOfParts.day,
      isToday: d === asOfParts.day,
    });
  }

  return {
    asOfDate: asOf.toISOString(),
    asOfDay: asOfParts.day,
    monthName: asOf.toLocaleString('en-US', { month: 'long' }),
    year: curYear,
    summary: {
      next7DaysCount: next7Days.length,
      next7DaysTotal: total7Days,
      next30DaysCount: next30Days.length,
      next30DaysTotal: total30Days,
      monthlyCommittedRunrate: Math.round(monthlyCommittedRunrate),
      totalActiveObligations: allObligations.length,
      confirmedCount: allObligations.filter(o => o.status === 'confirmed').length,
      predictedCount: allObligations.filter(o => o.status === 'predicted').length,
      fixedCount,
      variableCount,
      categoryStats,
    },
    upcoming: {
      next7Days,
      next30Days,
      thisMonth: thisMonthList,
      nextMonth: nextMonthList,
      later: laterList,
    },
    allObligations,
    calendar: calendarDays,
  };
}

module.exports = {
  KNOWN_ENTITIES,
  parseDateParts,
  normalizeObligationMerchant,
  matchKnownEntity,
  analyzeCadence,
  analyzeAmounts,
  predictNextDate,
  parseObligationEmail,
  detectObligationsFromTransactions,
  fuseObligations,
  getObligationsOverview,
};
