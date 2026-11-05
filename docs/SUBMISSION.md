# Devpost submission draft

**Name:** Pause

**Tagline:** A payment that asks one question before it leaves.

## Inspiration

The FTC reports about $3 billion in fraud losses among older Americans in 2025, and estimates the real figure could be far higher. Scams work by rushing people past the moment they would stop and think. Payment screens ask how much. Nobody asks why.

## What it does

Before money leaves, Pause asks three short questions by voice or text. Rules and Gemini listen for scam patterns such as secrecy, urgency, jail stories and tech support. If nothing is wrong, PayPal Payouts sends the money. If something sounds wrong, the payment is held and a trusted family member can stop or approve it.

## How we built it

Node and Express with plain JavaScript, browser speech APIs, the PayPal Payouts API in the sandbox, and Google Gemini returning JSON results.

The key design choice: scammers coach victims, so answers can only raise risk. Gemini can add a warning sign but can't clear one, and a large payment to someone new always needs a co-signer.

## Challenges

Designing for someone who has been told what to say. A chatbot that trusts the answers would fail exactly when it matters.

## What's next

Sign-in and family enrolment, delivery by text message, and testing with older adults and caregivers. This would work best built into a payment product, because a separate app only protects payments made through it.

## Built with

PayPal Payouts API, PayPal Sandbox, Google Gemini API, Node.js, Express, Web Speech API

## AI tools disclosure

Google Gemini reads the answers and writes the family summary. Claude Code was used to help write this project.

## Before submitting

Remove any claim that isn't true of the recorded build. Confirm the public repo, MIT license, YouTube link and working demo URL.
