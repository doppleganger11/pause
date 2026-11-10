## Inspiration

"Grandma, it's me. I'm in jail and I need bail money. Please don't tell Mom." Calls like this work because they rush people past the moment they would stop and think. The FTC reports older Americans lost about $3 billion to fraud in 2025, and estimates the true figure is far higher.

Payment screens ask one question: how much? Nobody asks *why*.

## What it does

Before money leaves, Pause asks three short questions, read aloud in a calm voice. The person can answer by speaking or typing:

1. What is this money for?
2. Did they contact you first, or did you reach out to them?
3. Has anyone asked you to hurry, or to keep this private?

Rules and Google Gemini listen for scam patterns: secrecy, urgency, a relative in jail, someone claiming authority, tech support, gift cards, guaranteed returns, and more.

- **Nothing unusual:** the person confirms and PayPal Payouts sends the money.
- **Something sounds wrong:** the money stays put. A trusted family member gets a plain-language summary of what was said and why it was held, is told to call on a number they already know, and can stop or approve the payment.

## The key design choice

Scammers coach their victims on what to say. A chatbot that trusts the answers fails exactly when it matters. So in Pause, answers can only raise the risk, never lower it:

- Gemini can add a warning sign, but can't clear one. Unknown signals are ignored.
- A payment of $300 or more to someone new always needs a co-signer, whatever the person says.
- Text inside the answers is treated as data, never as instructions to the AI.
- A held payment can only be sent once, and only after the family member approves it.

## How we built it

- **PayPal Payouts API (sandbox):** sends the money only after the checks pass or a family member approves, with an idempotency key so it is never sent twice.
- **Google Gemini API:** reads the answers for scam patterns a word list would miss, and writes the summary for the family member. It falls back to a lighter Gemini model when busy, and to rules alone if unavailable.
- **Web Speech API** reads the questions aloud and takes spoken answers.
- **Node.js and Express** with plain JavaScript, large text and big buttons for older eyes and hands.
- 13 automated tests, plus a read-only `npm run check` that confirms the PayPal and Gemini connections.

## Challenges

Testing with real phrasing caught misses our first word list didn't: "He said not to tell my daughter" and "A lawyer called me" slipped through. Gemini catches wording like this, and we added each miss as a test. Real sandbox testing also showed that PayPal Payouts isn't available from every country's sandbox account.

## What we learned

Protecting someone isn't about a scarier warning. Research shows warnings lose their effect when people see them repeatedly. A real question, and a real person on the other side, is harder for a scammer to talk around.

## What's next

Sign-in and family enrolment, sending the family link by text message instead of showing it on screen, and testing with older adults and caregivers. Pause works best built into a payment product, because a separate app only protects payments made through it. Not affiliated with PayPal.

## Try it

- **Live demo:** https://pause-skqa.onrender.com (connected to the PayPal sandbox with fake money; the free server can take about a minute to wake up)
- **Code:** https://github.com/doppleganger11/pause
