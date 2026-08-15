const { parseTransactionSms } = require('../src/parsers/smsParsers');
const { localLlmFallbackExtract } = require('../src/engine/localLLM');

const corpus = [
  { "id": 1, "sms": "SBI: A/C X6299 debited by Rs.356.00 on 15Aug26 trf to SWIGGY Refno 260298461234." },
  { "id": 2, "sms": "Rs 1,249.00 debited from HDFC Bank A/c XX1234 on 15/08/26. Avl Bal: Rs 45,821.20." },
  { "id": 3, "sms": "Dear Customer, INR 2,500.00 debited from your Acct XX7788 for UPI txn to RAHUL@okaxis. UPI Ref 623456789012." },
  { "id": 4, "sms": "Rs.899.00 spent on Axis Bank Card XX4455 at AMAZON on 15-Aug-26. Avl Limit Rs.74,101." },
  { "id": 5, "sms": "Rs.500 spent on your Kotak Debit Card XX9821 at ZOMATO. Available balance Rs.18,200." },
  { "id": 6, "sms": "Dear Customer, A/c XX5512 debited with Rs 780.00 on 15-08-2026 through UPI. Ref No 612345678901." },
  { "id": 7, "sms": "Your A/c XX3488 is debited by Rs.1,200.00 towards UPI payment to BPCL. Ref: 526781234567." },
  { "id": 8, "sms": "A/c XX4321 debited for INR 350.00 on 15/08/2026. UPI Ref No 456789123456. Avl Bal INR 12,450.00." },
  { "id": 9, "sms": "Dear Customer, Rs.999.00 debited from A/c XX6611 through UPI to NETFLIX@paytm on 15-Aug-26." },
  { "id": 10, "sms": "INR 4,500 debited from A/c XX9012 via UPI. UPI Ref 823456789012. Merchant: RENTPAY@upi." },
  { "id": 11, "sms": "Your Federal Bank A/c XX7821 has been debited with Rs.275.50 for UPI transaction to DMART. Ref 712345678901." },
  { "id": 12, "sms": "INR 3,000.00 has been debited from A/c XX8899. UPI transaction. Ref No 912345678901." },
  { "id": 13, "sms": "RBL Bank: Rs.650.00 debited from A/c XX1122 towards UPI payment. Ref No 312345678901." },
  { "id": 14, "sms": "Your YES BANK A/c XX4567 has been debited by Rs.1,799.00 through UPI to UBER. UPI Ref 412345678901." },
  { "id": 15, "sms": "IDBI Bank: A/c XX3344 debited Rs 2,000.00 on 15Aug26 via IMPS. Ref No IMPS81234567." },
  { "id": 16, "sms": "Rs.25,000.00 credited to your SBI Bank A/c XX5678 via NEFT from COMPANY LTD. Avl Bal Rs.48,220." },
  { "id": 17, "sms": "HDFC Bank: Rs 8,500.00 credited to A/c XX1234. NEFT CR-SALARY-Acme Technologies." },
  { "id": 18, "sms": "ICICI: INR 1,499.00 credited to A/c XX7788. UPI REVERSAL/REFUND. Ref 623456789012." },
  { "id": 19, "sms": "Rs 750 credited to your account XX8899 from RAHUL G via UPI. UPI Ref 734567890123." },
  { "id": 20, "sms": "Axis Bank: Your A/c XX4455 credited with Rs.3,200.00 by NEFT. Ref NEFT123456789." },
  { "id": 21, "sms": "LazyPay: Your payment of Rs.1,249 is due on 20 Aug. Pay now to avoid late fees." },
  { "id": 22, "sms": "LazyPay: You have made a purchase of Rs.899 at SWIGGY. This amount will be added to your upcoming bill." },
  { "id": 23, "sms": "LazyPay: Rs.1,299 payment received successfully. Thank you for paying your LazyPay bill." },
  { "id": 24, "sms": "LazyPay: Your available limit is Rs.18,701 after a transaction of Rs.1,299." },
  { "id": 25, "sms": "Simpl: Payment of Rs 599 for your recent transaction at Zomato will be collected in your upcoming bill." },
  { "id": 26, "sms": "Simpl: Your outstanding amount of Rs.1,899 is due tomorrow." },
  { "id": 27, "sms": "Amazon Pay Later: Your EMI of Rs.2,450 is due on 18-Aug-26. Pay before the due date." },
  { "id": 28, "sms": "Amazon Pay: Rs.1,299 paid successfully for your Amazon Pay Later bill. Transaction ID 827361." },
  { "id": 29, "sms": "Paytm Postpaid: Rs.799 spent at Zomato. Your Postpaid bill has been updated." },
  { "id": 30, "sms": "Paytm Postpaid: Your bill of Rs.3,249 is generated. Due date 25-Aug-26." },
  { "id": 31, "sms": "HDFC: Rs.2,500 debited from A/c XX1234 for UPI transaction. Your available balance is Rs.2,500. UPI Ref 823456789012." },
  { "id": 32, "sms": "ICICI Bank: INR 10,000 credited to A/c XX7788. Available balance INR 15,432.50." },
  { "id": 33, "sms": "LazyPay: Your outstanding bill is Rs.4,599. Minimum amount due Rs.1,200. Due date 25-Aug-26." },
  { "id": 34, "sms": "PhonePe: RAHUL has requested you to pay ₹2,000. Tap to pay." },
  { "id": 35, "sms": "SBI: UPI transaction of Rs.1,500 to SWIGGY has FAILED. No amount has been debited from A/c XX6299." },
  { "id": 36, "sms": "Axis Bank: UPI transaction of Rs.750 to AMAZON has been reversed and Rs.750 credited to A/c XX4455. Ref 723456789012." },
  { "id": 37, "sms": "123456 is your OTP for a transaction of Rs.5,000 on your HDFC Bank Card XX1234. Do not share this OTP." },
  { "id": 38, "sms": "LazyPay: Get up to Rs.500 cashback on your next purchase. Shop now!" },
  { "id": 39, "sms": "Bajaj Finserv: EMI of Rs.3,249 for Loan XX1234 is scheduled for auto-debit on 20-Aug-26." },
  { "id": 40, "sms": "Swiggy: Your order of Rs.846.00 has been placed successfully. Payment method: LazyPay." },
  { "id": 41, "sms": "Kotak Mahindra Bank: Rs 1,750 debited from A/c XX7788 via UPI to CRED. UPI Ref 982345671234." },
  { "id": 42, "sms": "ICICI Bank: Your credit card XX1234 was used for Rs 4,999 at FLIPKART. Available credit limit Rs 72,001." },
  { "id": 43, "sms": "SBI: Rs 6,500 credited to A/c XX8812 through IMPS from XX3344. Ref IMPS123456789." },
  { "id": 44, "sms": "HDFC Bank: Your A/c XX9911 has been debited with INR 49.00 for UPI payment. UPI Ref 882345671234." },
  { "id": 45, "sms": "Axis Bank: Payment of Rs 2,199 towards your credit card bill has been received successfully." },
  { "id": 46, "sms": "Amazon Pay Later: Purchase of Rs.1,799 at AMAZON has been completed using your Pay Later account." },
  { "id": 47, "sms": "Amazon Pay Later: Your outstanding amount of Rs.1,799 remains unpaid. Due date is 25-Aug-26." },
  { "id": 48, "sms": "Paytm Postpaid: Your Postpaid account has been credited with Rs.1,000 payment. Current outstanding Rs.2,450." },
  { "id": 49, "sms": "LazyPay: Your transaction of Rs.2,499 at MYNTRA was successful. Your bill has been updated." },
  { "id": 50, "sms": "LazyPay: Rs.2,499 transaction attempt at MYNTRA could not be completed. Please try again." },
  { "id": 51, "sms": "Simpl: Your Simpl account has been updated with a transaction of Rs.899 at BLINKIT." },
  { "id": 52, "sms": "Simpl: Rs.899 payment to BLINKIT is pending confirmation." },
  { "id": 53, "sms": "PhonePe: Your UPI payment of ₹1,200 to SWIGGY is pending." },
  { "id": 54, "sms": "PhonePe: ₹1,200 UPI payment to SWIGGY failed. No money was deducted from your bank account." },
  { "id": 55, "sms": "Google Pay: You paid ₹2,750 to CRED@axisbank using HDFC Bank A/c XX4455. UPI Ref 782345671234." },
  { "id": 56, "sms": "Google Pay: ₹2,750 payment to CRED@axisbank was reversed. Amount has been credited back to your bank account." },
  { "id": 57, "sms": "Your SBI debit card ending 7788 was used for Rs 12,999 at CROMA." },
  { "id": 58, "sms": "Your SBI debit card ending 7788 transaction for Rs 12,999 at CROMA was declined." },
  { "id": 59, "sms": "Your ICICI Credit Card XX7788 payment of INR 8,000 is due on 20-Aug-26. Total amount due INR 12,500." },
  { "id": 60, "sms": "Your ICICI Credit Card XX7788 payment of INR 8,000 has been received successfully." }
];

async function runEvaluation() {
  const results = [];
  let deterministicCount = 0;
  let llmFallbackCount = 0;
  let reviewQueueCount = 0;
  let nonTxnCount = 0;

  for (const item of corpus) {
    let parsed = parseTransactionSms({ text: item.sms });
    let category = 'Deterministic Regex';

    if (parsed && parsed.notATransaction) {
      nonTxnCount++;
      category = 'Non-Transactional (Filtered)';
    } else if (!parsed || parsed.needsLLMFallback) {
      const aiResult = await localLlmFallbackExtract(item.sms);
      parsed = { ...parsed, ...aiResult };
      if (parsed.needsReview) {
        reviewQueueCount++;
        category = 'Needs Manual Review';
      } else {
        llmFallbackCount++;
        category = 'Local AI Fallback';
      }
    } else {
      deterministicCount++;
    }

    results.push({
      id: item.id,
      sms: item.sms,
      category,
      amount: parsed ? parsed.amount : null,
      merchant: parsed ? parsed.merchant : null,
      type: parsed ? parsed.type : null,
      bank: parsed ? parsed.bank : null,
    });
  }

  console.log(JSON.stringify({
    stats: {
      total: corpus.length,
      deterministic: deterministicCount,
      localAiFallback: llmFallbackCount,
      needsReviewQueue: reviewQueueCount,
      nonTransactional: nonTxnCount,
    },
    results
  }, null, 2));
}

runEvaluation();
