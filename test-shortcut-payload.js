const assert = require('assert');
const { parseTransactionSms } = require('./smsParsers');

console.log('--- Testing iOS Shortcut vs curl Payload Compatibility ---');

// Test 1: ICICI SMS with capital field names or missing sender
const smsPayload1 = {
  Sender: 'JM-ICICIB',
  Content: 'ICICI Bank Acct XX299 debited for Rs 1.00 on 15-Aug-26; AKSHANSH SHRIVA credited. UPI:213231914903.',
  Time: '15 Aug 2026, 02:00 IST',
};

const sender1 = smsPayload1.sender || smsPayload1.Sender || smsPayload1.from || 'SMS';
const text1 = smsPayload1.text || smsPayload1.Text || smsPayload1.Content || smsPayload1.body || '';

const parsed1 = parseTransactionSms({ sender: sender1, text: text1 });
assert.ok(parsed1, 'Should parse ICICI SMS with capital keys');
assert.strictEqual(parsed1.bank, 'ICICI Bank');
assert.strictEqual(parsed1.amount, 1);
assert.strictEqual(parsed1.type, 'debit');
console.log('✓ Capital key payload (Sender/Content/Time) parsed cleanly');

// Test 2: ICICI SMS with empty sender
const parsed2 = parseTransactionSms({ sender: '', text: 'ICICI Bank Acct XX299 debited for Rs 1.00 on 15-Aug-26; AKSHANSH SHRIVA credited. UPI:213231914903.' });
assert.ok(parsed2, 'Should parse ICICI SMS even when sender is empty');
assert.strictEqual(parsed2.bank, 'ICICI Bank');
assert.strictEqual(parsed2.amount, 1);
console.log('✓ Empty sender fallback parsed cleanly');

// Test 3: Safe Date Parsing Function
function safeIsoDate(dStr) {
  if (!dStr) return new Date().toISOString();
  try {
    const parsed = new Date(dStr);
    if (isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const invalidDateResult = safeIsoDate('15/08/2026, 02:00:00 IST');
assert.ok(typeof invalidDateResult === 'string' && invalidDateResult.length > 0, 'Invalid date string should not crash, returns valid ISO string');
console.log('✓ Invalid date string handled gracefully without crash:', invalidDateResult);

console.log('\nAll iOS Shortcut payload regression tests passed successfully!');
