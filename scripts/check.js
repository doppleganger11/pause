// Morning setup check: npm run check
// Signs in to the PayPal sandbox and runs one scam reading with Gemini.
// Sends no money. Never prints a secret.
import { decide } from '../server/signals.js';
import { readAnswers } from '../server/guide.js';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, GEMINI_API_KEY } = process.env;
let failed = false;
const ok = (m) => console.log(`OK    ${m}`);
const todo = (m) => { failed = true; console.log(`TO DO ${m}`); };

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  todo('Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.');
} else {
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    todo(`PayPal sign-in failed (${res.status}).`);
  } else {
    const { scope = '' } = await res.json();
    ok('PayPal sandbox sign-in works.');
    if (/payments\/payouts/.test(scope)) ok('This app has Payouts access.');
    else todo('Turn on Payouts for this sandbox app in the Developer Dashboard.');
  }
}

if (!GEMINI_API_KEY) {
  todo('Add GEMINI_API_KEY to .env (free key from aistudio.google.com/apikey).');
} else {
  const p = {
    amount: 40, recipientName: 'A friend', senderName: 'Eleanor',
    answers: ['My friend online needs help with customs fees for my parcel from him', 'He wrote to me', 'He says my family would not understand'],
  };
  const read = await readAnswers(p);
  if (read.source === 'ai') {
    const d = decide({ amount: p.amount, knownRecipient: false, answers: p.answers, aiSignals: read.signals });
    ok(`Gemini reading works. Signals: ${read.signals.join(', ') || 'none'}. Held: ${d.hold}.`);
  } else {
    todo(`Gemini: ${read.aiError ?? 'fell back to rules'}`);
  }
}

console.log(failed ? '\nFix the TO DO lines, then run this again.' : '\nEverything is ready.');
process.exitCode = failed ? 1 : 0;
