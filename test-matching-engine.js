const { matchSource } = require('./matchingEngine');

function txn(overrides) {
  return {
    id: 'existing-1',
    bank: 'ICICI Bank',
    type: 'debit',
    amount: 500,
    currency: 'INR',
    merchant: 'Swiggy',
    date: '2026-08-14T10:30:00Z',
    refNo: null,
    last4: '1234',
    sourceTypes: ['sms'], // by default, existing candidate arrived via SMS — source() defaults to 'email', so cross-channel by default
    ...overrides,
  };
}

function source(overrides) {
  return {
    bank: 'ICICI Bank',
    type: 'debit',
    amount: 500,
    currency: 'INR',
    merchant: 'Swiggy',
    sourceType: 'email',
    date: '2026-08-14T10:31:00Z',
    refNo: null,
    last4: '1234',
    ...overrides,
  };
}

const alwaysMatchAI = async () => ({ isMatch: true, confidence: 0.8 });
const alwaysNoMatchAI = async () => ({ isMatch: false, confidence: 0.2 });
const failingAI = async () => { throw new Error('AI provider down'); };

const cases = [
  {
    label: 'same refNo -> reference match, confidence 1.0',
    source: source({ refNo: 'UPI999', merchant: null, amount: 999 }), // even wildly different amount/merchant shouldn't matter once refNo matches
    candidates: [txn({ refNo: 'UPI999' })],
    aiMatchFn: null,
    expect: { matched: true, method: 'reference', confidence: 1.0 },
  },
  {
    label: 'different refNo (both present) -> never merge even with same amount/merchant/time',
    source: source({ refNo: 'UPI111' }),
    candidates: [txn({ refNo: 'UPI222' })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: false }, // a confirmed differing refNo is a hard exclusion, not just a skipped Level 1
  },
  {
    label: 'exact merchant, close timestamp, no refNo -> deterministic match',
    source: source({ date: '2026-08-14T10:33:00Z' }),
    candidates: [txn()],
    aiMatchFn: null,
    expect: { matched: true, method: 'deterministic', confidence: 0.95 },
  },
  {
    label: 'same amount+merchant but 8 hours apart -> NOT merged (classic false-positive case)',
    source: source({ date: '2026-08-14T18:30:00Z' }),
    candidates: [txn({ date: '2026-08-14T10:30:00Z' })],
    aiMatchFn: alwaysMatchAI, // even if AI would say yes, it should never be reached — window excludes it entirely
    expect: { matched: false },
  },
  {
    label: 'different amount -> never merge regardless of everything else matching',
    source: source({ amount: 500.01 }),
    candidates: [txn({ amount: 500 })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: false },
  },
  {
    label: 'different bank -> never merge',
    source: source({ bank: 'HDFC Bank' }),
    candidates: [txn({ bank: 'ICICI Bank' })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: false },
  },
  {
    label: 'debit vs credit -> never merge',
    source: source({ type: 'debit' }),
    candidates: [txn({ type: 'credit' })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: false },
  },
  {
    label: 'missing merchant on both sides, same last4, close time -> score-based match',
    source: source({ merchant: null, date: '2026-08-14T10:35:00Z' }),
    candidates: [txn({ merchant: null })],
    aiMatchFn: null,
    expect: { matched: true, method: 'score' },
  },
  {
    label: 'missing merchant and missing last4, only time proximity -> ambiguous, AI resolves it',
    source: source({ merchant: null, last4: null, date: '2026-08-14T10:40:00Z' }),
    candidates: [txn({ merchant: null, last4: null })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: true, method: 'ai' },
  },
  {
    label: 'ambiguous band but AI says no -> not merged',
    source: source({ merchant: null, last4: null, date: '2026-08-14T10:40:00Z' }),
    candidates: [txn({ merchant: null, last4: null })],
    aiMatchFn: alwaysNoMatchAI,
    expect: { matched: false },
  },
  {
    label: 'ambiguous band but no AI function configured (e.g. no API key) -> fails safe to no match, not a crash',
    source: source({ merchant: null, last4: null, date: '2026-08-14T10:40:00Z' }),
    candidates: [txn({ merchant: null, last4: null })],
    aiMatchFn: null,
    expect: { matched: false },
  },
  {
    label: 'different merchant, same amount/bank/time -> low score, no AI call needed (not ambiguous, just no)',
    source: source({ merchant: 'Zomato', date: '2026-08-14T10:31:00Z' }),
    candidates: [txn({ merchant: 'Uber' })],
    aiMatchFn: alwaysMatchAI,
    expect: { matched: false },
  },
  {
    label: 'REAL DATA CASE: same-channel same-bank/amount/merchant a few minutes apart -> NOT merged (e.g. a declined card swipe retried shortly after)',
    source: source({ sourceType: 'email', date: '2026-08-14T10:34:00Z' }), // 4 min after candidate
    candidates: [txn({ sourceTypes: ['email'] })], // candidate ALSO arrived via email — same channel
    aiMatchFn: alwaysMatchAI, // even if AI would say yes, same-channel exclusion should block it before AI is ever reached
    expect: { matched: false },
  },
  {
    label: 'cross-channel (SMS then email), same bank/amount/merchant, close time -> deterministic match (the actual intended case)',
    source: source({ sourceType: 'email', date: '2026-08-14T10:33:00Z' }),
    candidates: [txn({ sourceTypes: ['sms'] })],
    aiMatchFn: null,
    expect: { matched: true, method: 'deterministic' },
  },
  {
    label: 'refNo match still wins even for same-channel sources (a redelivered duplicate email with an identical refNo really is the same message)',
    source: source({ sourceType: 'email', refNo: 'UPI555' }),
    candidates: [txn({ sourceTypes: ['email'], refNo: 'UPI555' })],
    aiMatchFn: null,
    expect: { matched: true, method: 'reference' },
  },
  {
    label: 'no candidates at all -> no match, no crash',
    source: source(),
    candidates: [],
    aiMatchFn: null,
    expect: { matched: false },
  },
  {
    label: 'AI throwing an error does not crash matching — treated as no match',
    source: source({ merchant: null, last4: null, date: '2026-08-14T10:40:00Z' }),
    candidates: [txn({ merchant: null, last4: null })],
    aiMatchFn: failingAI,
    expect: { matched: false, throws: false },
  },
];

(async () => {
  let pass = 0;
  for (const c of cases) {
    let result;
    let threw = false;
    try {
      result = await matchSource(c.source, c.candidates, c.aiMatchFn);
    } catch (err) {
      threw = true;
    }

    const matched = !threw && result != null;
    let ok = matched === c.expect.matched;
    if (ok && c.expect.method) ok = result.method === c.expect.method;
    if (ok && c.expect.confidence !== undefined) ok = result.confidence === c.expect.confidence;
    if (c.expect.throws === false) ok = ok && !threw;

    console.log(`${ok ? '✓' : '✗'} ${c.label}${result ? `  [${result.method}, conf=${result.confidence}]` : ''}`);
    if (ok) pass++;
    else console.log(`   got: ${JSON.stringify(result)}${threw ? ' (threw)' : ''}`);
  }
  console.log(`\n${pass}/${cases.length} cases passed`);
  process.exit(pass === cases.length ? 0 : 1);
})();
