const { parseMerchantEmail } = require('./merchantParsers');

// Real excerpts pulled from the inbox, preserving the actual newlines and
// non-breaking spaces ( ) that show up after HTML-stripping — earlier
// hand-flattened versions of these fixtures passed while the real regexes
// still failed on live mail, since real Gmail HTML puts labels/values on
// separate lines and sometimes uses a literal NBSP character instead of a
// normal space. These fixtures are shaped to actually catch that class of
// regression.
const fixtures = [
  {
    label: 'Swiggy — food order',
    sender: 'noreply@swiggy.in',
    plaintextBody:
      'Delivery in 21 mins! ORDER JOURNEY Aamhi Pohekar AAMHI POHEKAR near shitole petrol bunk , sai chowk, navi sangavi, pune , 411027 Aug 7, 10:29 AM Akshansh B wing flat no 18, 3rd floor, Shambhu Vihar Society, Aundh, Pune, Maharashtra, India. (243/22), Pune Aug 7, 10:51 AM Order ID: 245048394104709 BILL DETAILS Nagpuri Tarri Pohe x1 ₹40 Indori Pohe x1 ₹35 Platform fee with GST ₹17.58 Delivery Fee | 3.5 kms ₹33 Taxes ₹9.69 Paid Via Credit/Debit card ₹135 Disclaimer : Attached is the invoice for the restaurant services provided by the outlet.',
  },
  {
    label: 'Swiggy — Dineout payment (real newline between "Total Paid" and the amount)',
    sender: 'noreply@swiggy.in',
    plaintextBody:
      'Greetings from Swiggy! \n Your Dineout payment of INR 269 at MH 12 Pav Bhaji is successful. Hope it was a smooth experience for you. \n Your payment summary \n Order ID: 245071508109005 \n Order Time and Date: 2026-08-07 16:55:30 \n Paid to: MH 12 Pav Bhaji, Aundh, Pune \n Here are the details of the payment: \n Bill Details \n Amount \n Total Bill \n ₹304 \n 15% Restaurant Discount \n -₹45 \n Total Paid \n ₹269 \n ₹0 \n Interest(charged by bank) \n ₹',
  },
  {
    label: 'Zomato — "Thank you for ordering from X" template (real NBSP between "ordering" and "from")',
    sender: 'noreply@zomato.com',
    plaintextBody:
      'Hi Akshansh Shrivastava, \n Thank you for ordering from Kannu Ki Chai \n ORDER ID: 8419507103                                           \n Delivered \n Kannu Ki Chai \n Survey 137/1 And 138/1A/2/2a, Plot O, Shop 2, Ground Floor, Rahul Park Cooperative, Gaikwad Nagar, Aundh, Pune \n 1 X Adrak Chai \n 1 X Puneri Poha \n Total paid - ₹251.58',
  },
  {
    label: 'Zomato — "Your order from X was delivered" template (second real template, different wording entirely)',
    sender: 'noreply@zomato.com',
    plaintextBody:
      'Zoooooooooooop! That was quick. \n Hi Akshansh Shrivastava, Your order from Kota Kachori & Namkeens was delivered in just 24 minutes . \n ORDER ID: 8457077423 \n Delivered \n Kota Kachori & Namkeens \n Opposite Florencia Society, Kaspate Vasti Road, Wakad, Pune \n 1 X Kadhi Kachori [2 Pieces] \n 1 X Milk Cake \n Total paid - ₹188.33',
  },
  {
    label: 'Swiggy — cancelled order — should be IGNORED (not a transaction)',
    sender: 'noreply@swiggy.in',
    plaintextBody:
      'Hi Akshansh , Thanks for using Swiggy! Your Swiggy order #244869395148908 is cancelled as the ordered item(s) are now out of stock at the restaurant. This happens rarely and we apologise for the inconvenience. Order No: #244869395148908 Restaurant: Tea Post Cancelation Time: 2026-08-05 09:39 Total Refund Rs.229.0',
  },
  {
    label: 'Unrelated sender — should be IGNORED (not a merchant we track)',
    sender: 'noreply@amazon.in',
    plaintextBody: 'Your Amazon order has shipped.',
  },
];

let pass = 0;
for (const fx of fixtures) {
  const result = parseMerchantEmail(fx);
  console.log('\n--- ' + fx.label + ' ---');
  console.log(JSON.stringify(result, null, 2));
  if (fx.label.includes('IGNORED')) {
    if (result === null) pass++;
    else console.log('  ✗ expected null (ignored), got a result');
  } else {
    if (result && result.needsLLMFallback === false && result.sourceType === 'merchant') pass++;
    else console.log('  ✗ expected a clean merchant-sourced parse');
  }
}
console.log(`\n${pass}/${fixtures.length} fixtures behaved as expected`);
