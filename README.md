# Pause

A payment that asks one question before it leaves.

Older Americans reported about $3 billion in fraud losses in 2025, according to the FTC. Pause adds a calm conversation before money moves. If the answers sound like a scam, the money waits for a trusted family member.

## How it works

1. The person enters who they're paying, then answers three short questions by voice or typing.
2. Rules and Gemini look for scam patterns: secrecy, urgency, jail or bail stories, tech support, gift cards and more.
3. Nothing unusual: the person confirms and PayPal Payouts sends the money.
4. Something unusual: the payment is held and a family member sees a summary, then stops or approves it.

## The safety rule

Scammers coach their victims, so answers can only raise risk. A payment of $300 or more to someone new always needs a co-signer, whatever the person says. Gemini can add a signal but can't clear one, and unknown signals are ignored.

## How PayPal and AI are used

| Part | Used for |
|---|---|
| PayPal Payouts API (sandbox) | Sends the money, only after the checks pass or a family member approves |
| Google Gemini API (free tier) | Finds scam patterns that a word list misses and writes the family summary |
| Browser speech APIs | Reads questions aloud and takes spoken answers where supported |

## Run it

Needs Node 22.9 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Open http://localhost:3001. With an empty `.env` it runs in **Simulated PayPal** and **Rules only** mode, shown in the header. Add a free `GEMINI_API_KEY` and sandbox `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` for the real thing. Never commit `.env`.

## Check your setup

```bash
npm run check
```

This signs in to the sandbox and runs one reading with Gemini. It sends no money and prints what is left to do.

## Tests

```bash
npm test
```

## Known limits

- It only protects payments made through this app. It's a concept for a layer PayPal could build in, and can't intercept other payments.
- The demo shows the family link on the sender's screen. A real product must send it only to the family member, or a coached victim could approve their own payment.
- Sign-in, family enrolment and text delivery aren't built. Data is held in memory.
- Research shows warnings lose effect with repeated exposure. Whether a conversation does better is untested.
- Word patterns miss things, and can flag innocent wording. A family check is the safeguard, not proof of a scam.

This is not affiliated with PayPal.

## License

MIT
