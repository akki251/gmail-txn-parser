/**
 * Transaction Parser Regression Test Suite
 *
 * Runs four layers of testing:
 *   Layer 1 — nonTransactional gate
 *   Layer 2 — deterministic parser
 *   Layer 3 — mocked LLM fallback contract
 *   Layer 4 — full end-to-end pipeline (no real LLM, uses mock)
 *
 * Usage:
 *   node tests/parser.test.js          (Layer 1 + 2 + 4 with mock LLM)
 *   VERBOSE=1 node tests/parser.test.js (show all pass/fail details)
 */

'use strict';

const path = require('path');
const { isNonTransactional } = require('../src/parsers/nonTransactional');
const { parseTransactionSms } = require('../src/parsers/smsParsers');
const corpus = require('./fixtures/corpus.json');

// ─── ANSI colours ──────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

const VERBOSE = process.env.VERBOSE === '1';

// ─── Helpers ────────────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function pass(id) {
  totalPassed++;
  if (VERBOSE) console.log(`  ${GREEN}✓${RESET} ${id}`);
}

function fail(id, reason) {
  totalFailed++;
  failures.push({ id, reason });
  console.log(`  ${RED}✗${RESET} ${BOLD}${id}${RESET}`);
  console.log(`    ${RED}${reason}${RESET}`);
}

function section(name) {
  console.log(`\n${CYAN}${BOLD}${name}${RESET}`);
}

// ─── Mock LLM (deterministic, no network) ───────────────────────────────────
// Returns sensible structured responses for known ambiguous patterns.
// In CI, the real llama.rn / OpenRouter is NEVER called.
async function mockLlmFallback(text) {
  // Multiline HDFC "Sent" format
  if (/^Sent\s+Rs\.\d/m.test(text)) {
    const amtM = text.match(/Sent\s+Rs\.([\d,]+\.?\d*)/i);
    const toM   = text.match(/To\s+(.+)/i);
    return {
      amount: amtM ? parseFloat(amtM[1].replace(/,/g, '')) : 0,
      merchant: toM ? toM[1].trim() : null,
      type: 'debit',
      bank: 'HDFC Bank',
      currency: 'INR',
      notATransaction: false,
      needsReview: false,
      sourceParser: 'Mock LLM',
    };
  }

  // LazyPay purchase
  if (/lazypay.*purchase.*successful/i.test(text)) {
    const amtM = text.match(/Rs\.([\d,]+\.?\d*)/i);
    return {
      amount: amtM ? parseFloat(amtM[1].replace(/,/g, '')) : 0,
      merchant: 'LazyPay',
      type: 'debit',
      bank: null,
      currency: 'INR',
      notATransaction: false,
      needsReview: false,
      sourceParser: 'Mock LLM',
    };
  }

  // Anything with future/scheduled/offer language → non-transaction
  if (/\b(will be|scheduled|offer|eligible|approved|initiated|outstanding|due|pending)\b/i.test(text)) {
    return { notATransaction: true, sourceParser: 'Mock LLM' };
  }

  // Generic: if amount + completion verb present → transaction
  const amtM = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i);
  const verbM = /\b(debited|credited|spent|paid|withdrawn|transferred|disbursed|charged|refunded)\b/i.test(text);
  if (amtM && verbM) {
    return {
      amount: parseFloat(amtM[1].replace(/,/g, '')),
      merchant: null,
      type: /credited|refund|reversal|disbursed/i.test(text) ? 'credit' : 'debit',
      bank: null,
      currency: 'INR',
      notATransaction: false,
      needsReview: false,
      sourceParser: 'Mock LLM',
    };
  }

  return { notATransaction: true, sourceParser: 'Mock LLM' };
}

// ─── Full pipeline (mirrors smsReceiver.js logic, uses mock LLM) ─────────────
async function runPipeline(sms) {
  if (isNonTransactional(sms)) {
    return { classification: 'NON_TRANSACTION' };
  }

  let result = parseTransactionSms({ sender: 'TEST-SENDER', text: sms });

  if (!result) {
    result = { needsLLMFallback: true };
  }

  if (result.needsLLMFallback) {
    const aiResult = await mockLlmFallback(sms);
    result = { ...result, ...aiResult };
  }

  if (result.notATransaction) {
    return { classification: 'NON_TRANSACTION' };
  }

  if (!result.amount && result.amount !== 0) {
    return { classification: 'NON_TRANSACTION' };
  }

  return {
    classification: 'TRANSACTION',
    type: result.type || 'debit',
    amount: result.amount,
    merchant: result.merchant || null,
    bank: result.bank || null,
    sourceParser: result.sourceParser || 'Deterministic',
  };
}

// ─── LAYER 1: Non-transaction gate ──────────────────────────────────────────
async function runLayer1() {
  section('Layer 1 — Non-Transaction Gate (isNonTransactional)');
  const nonTxnCases = corpus.filter(c => c.expected.classification === 'NON_TRANSACTION');

  for (const tc of nonTxnCases) {
    const result = isNonTransactional(tc.sms);
    // Gate can catch it OR pass it through to the parser (both are OK for gate-only test).
    // We just verify: if the gate says NON_TRANSACTION, it's correct.
    if (result === true) {
      pass(`${tc.id} [gate=NON_TRANSACTION ✓]`);
    } else {
      // Gate missed it — not a failure of the gate (some need LLM), just note.
      if (VERBOSE) console.log(`  ${YELLOW}~${RESET} ${tc.id} ${DIM}[gate passed through — needs deeper layer]${RESET}`);
    }
  }

  // Ensure gate does NOT block actual transactions
  const txnCases = corpus.filter(c => c.expected.classification === 'TRANSACTION');
  for (const tc of txnCases) {
    const result = isNonTransactional(tc.sms);
    if (result === true) {
      fail(tc.id, `Gate incorrectly blocked a TRANSACTION case`);
    } else {
      pass(`${tc.id} [gate=correctly-passed-through ✓]`);
    }
  }
}

// ─── LAYER 2: Deterministic parser ──────────────────────────────────────────
async function runLayer2() {
  section('Layer 2 — Deterministic Parser (parseTransactionSms)');
  // Only test cases the deterministic parser is expected to handle
  const knownDeterministic = [
    'icici-upi-debit',
    'card-payment-debit-from-bank',
    'sbi-credit-card-spend',
    'upi-incoming-p2p',
    'salary-credit',
    'lazypay-purchase',
    'actual-emi-debit',
    'loan-credit-disbursement',
    'refund-credited',
  ];

  for (const id of knownDeterministic) {
    const tc = corpus.find(c => c.id === id);
    if (!tc) continue;

    if (isNonTransactional(tc.sms)) {
      if (tc.expected.classification === 'NON_TRANSACTION') {
        pass(id);
      } else {
        fail(id, `Gate blocked a case expected as TRANSACTION`);
      }
      continue;
    }

    const result = parseTransactionSms({ sender: 'TEST-SENDER', text: tc.sms });

    if (tc.expected.classification === 'NON_TRANSACTION') {
      if (!result || result.needsLLMFallback || result.notATransaction) {
        pass(id);
      } else {
        fail(id, `Parser produced a transaction for a NON_TRANSACTION case. Got: ${JSON.stringify(result)}`);
      }
    } else {
      if (!result || result.needsLLMFallback) {
        // It will go to LLM — don't fail Layer 2 for this, just note
        if (VERBOSE) console.log(`  ${YELLOW}~${RESET} ${id} ${DIM}[needs LLM fallback]${RESET}`);
        continue;
      }
      let ok = true;
      let reason = '';
      if (tc.expected.type && result.type !== tc.expected.type) {
        ok = false; reason = `type: expected "${tc.expected.type}", got "${result.type}"`;
      }
      if (tc.expected.amount !== undefined && Math.abs(result.amount - tc.expected.amount) > 0.01) {
        ok = false; reason = `amount: expected ${tc.expected.amount}, got ${result.amount}`;
      }
      ok ? pass(id) : fail(id, reason);
    }
  }
}

// ─── LAYER 3: LLM fallback contract ─────────────────────────────────────────
async function runLayer3() {
  section('Layer 3 — LLM Fallback Contract (mocked)');

  const llmCases = [
    {
      id: 'llm-hdfc-sent-multiline',
      sms: 'Sent Rs.6000.00\nFrom HDFC Bank A/C *9760\nTo ABHIUE ANAND\nOn 29/07/26\nRef 622722434795',
      expected: { classification: 'TRANSACTION', type: 'debit', amount: 6000 },
    },
    {
      id: 'llm-lazypay-purchase',
      sms: 'LazyPay: Your purchase of Rs.1899 at ZOMATO was successful.',
      expected: { classification: 'TRANSACTION', type: 'debit', amount: 1899 },
    },
    {
      id: 'llm-future-scheduled-non-txn',
      sms: 'Your HDFC Bank account will be debited by Rs.24999 for EMI.',
      expected: { classification: 'NON_TRANSACTION' },
    },
    {
      id: 'llm-loan-offer-non-txn',
      sms: 'Avail your Axis Bank Personal Loans offer of Rs.500000 starting @15.25% p.a.',
      expected: { classification: 'NON_TRANSACTION' },
    },
  ];

  for (const tc of llmCases) {
    const aiResult = await mockLlmFallback(tc.sms);
    const classification = aiResult.notATransaction ? 'NON_TRANSACTION' : 'TRANSACTION';

    if (classification !== tc.expected.classification) {
      fail(tc.id, `classification: expected "${tc.expected.classification}", got "${classification}"`);
      continue;
    }

    if (tc.expected.classification === 'TRANSACTION') {
      if (tc.expected.amount !== undefined && Math.abs(aiResult.amount - tc.expected.amount) > 0.01) {
        fail(tc.id, `amount: expected ${tc.expected.amount}, got ${aiResult.amount}`);
        continue;
      }
      if (tc.expected.type && aiResult.type !== tc.expected.type) {
        fail(tc.id, `type: expected "${tc.expected.type}", got "${aiResult.type}"`);
        continue;
      }
    }
    pass(tc.id);
  }
}

// ─── LAYER 4: End-to-end pipeline ────────────────────────────────────────────
async function runLayer4() {
  section('Layer 4 — End-to-End Pipeline (full corpus)');

  for (const tc of corpus) {
    const result = await runPipeline(tc.sms);

    if (result.classification !== tc.expected.classification) {
      fail(
        tc.id,
        `classification: expected "${tc.expected.classification}", got "${result.classification}"\n    SMS: ${tc.sms.replace(/\n/g, '↵').substring(0, 80)}`,
      );
      continue;
    }

    if (tc.expected.classification === 'TRANSACTION') {
      let ok = true;
      let reason = '';

      if (tc.expected.type && result.type !== tc.expected.type) {
        ok = false;
        reason = `type: expected "${tc.expected.type}", got "${result.type}"`;
      }
      if (tc.expected.amount !== undefined && Math.abs(result.amount - tc.expected.amount) > 0.01) {
        ok = false;
        reason = `amount: expected ${tc.expected.amount}, got ${result.amount}`;
      }
      ok ? pass(tc.id) : fail(tc.id, reason);
    } else {
      pass(tc.id);
    }
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}Transaction Parser Regression Suite${RESET}`);
  console.log(`${DIM}Corpus: ${corpus.length} fixtures${RESET}`);

  await runLayer1();
  await runLayer2();
  await runLayer3();
  await runLayer4();

  // ─── Summary ──────────────────────────────────────────────────────────────
  const total = totalPassed + totalFailed;
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`${BOLD}Results: ${GREEN}${totalPassed} passed${RESET}, ${totalFailed > 0 ? RED : GREEN}${totalFailed} failed${RESET} (${total} assertions)`);

  if (failures.length > 0) {
    console.log(`\n${RED}${BOLD}FAILURES:${RESET}`);
    for (const f of failures) {
      console.log(`\n  ${RED}✗ FAILED: ${f.id}${RESET}`);
      console.log(`    ${f.reason}`);
      const tc = corpus.find(c => c.id === f.id);
      if (tc) {
        console.log(`    ${DIM}SMS: ${tc.sms.replace(/\n/g, '↵').substring(0, 100)}${RESET}`);
        console.log(`    ${DIM}Expected: ${JSON.stringify(tc.expected)}${RESET}`);
      }
    }
    console.log('');
    process.exit(1);
  }

  console.log(`\n${GREEN}${BOLD}All tests passed.${RESET}\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(`${RED}Test runner crashed:${RESET}`, err);
  process.exit(1);
});
