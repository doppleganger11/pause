// Deterministic scam signals. Scammers coach victims on what to say, so answers
// can only raise risk. Nothing the person or the AI says can lower it.

export const SIGNALS = {
  URGENCY: { label: 'Being rushed', weight: 1, test: /\b(right now|immediately|urgent|hurry|today only|within the hour|before it'?s too late|asap|last chance)\b/i },
  SECRECY: { label: 'Told to keep it secret', weight: 3, test: /\b(secret|private|don'?t tell|do not tell|not (to )?tell|keep (this|it) (quiet|between|private)|nobody can know|no one can know|shouldn'?t tell)\b/i },
  COVER_STORY: { label: 'Told what to say', weight: 3, test: /\b(told me to say|said to say|tell (them|the bank|paypal) it'?s|say it'?s for|say it is for|coached)\b/i },
  FAMILY_EMERGENCY: { label: 'Relative in trouble', weight: 2, test: /\b(grandson|granddaughter|grandchild|nephew|niece)\b.*\b(jail|bail|arrest|accident|hospital|lawyer|trouble)\b|\b(bail|jail|arrested|lawyer)\b/i },
  AUTHORITY: { label: 'Someone claiming authority', weight: 2, test: /\b(police|officer|irs|tax office|sheriff|fbi|government|court|microsoft|apple support|bank security|fraud department)\b/i },
  TECH_SUPPORT: { label: 'Tech support or computer access', weight: 3, test: /\b(tech support|virus|hacked|remote access|anydesk|teamviewer|on my computer|screen share)\b/i },
  INVESTMENT: { label: 'Guaranteed returns', weight: 3, test: /\b(guaranteed|double your|crypto|bitcoin|trading platform|investment opportunity|high returns)\b/i },
  ROMANCE: { label: 'Someone met only online', weight: 2, test: /\b(met (him|her|them)? ?online|never met|fianc[eé]|my (boyfriend|girlfriend) (overseas|abroad)|dating (site|app))\b/i },
  PRIZE: { label: 'Pay to claim a prize', weight: 3, test: /\b(prize|lottery|won a|sweepstakes|claim (my|the) (winnings|money))\b/i },
  OVERPAYMENT: { label: 'Refund or overpayment story', weight: 2, test: /\b(overpaid|over-?payment|refund (back|the difference)|sent (me )?too much)\b/i },
  GIFT_CARDS: { label: 'Gift cards mentioned', weight: 3, test: /\b(gift cards?|itunes|steam cards?|apple cards?|google play cards?)\b/i },
  THEY_CALLED: { label: 'They contacted you first', weight: 1, test: /\b(they (called|phoned|texted|emailed|messaged)( me)?|(he|she) (called|phoned|texted)|got a (call|text|message|pop-?up)|(a|an|the|some|someone)( \w+)? (called|phoned|texted|emailed|messaged)( me)?|someone (called|phoned))\b/i },
};

export const ALL_SIGNALS = Object.keys(SIGNALS);
export const NEW_RECIPIENT_LIMIT = 300;
const HOLD_SCORE = 3;

export function detect(text) {
  return ALL_SIGNALS.filter((id) => SIGNALS[id].test.test(text));
}

// aiSignals may add to the list. Unknown ids are dropped, so the model can't invent one.
export function decide({ amount, knownRecipient, answers, aiSignals = [] }) {
  const found = new Set(answers.flatMap(detect));
  for (const id of aiSignals) if (SIGNALS[id]) found.add(id);
  const signals = [...found];
  const score = signals.reduce((sum, id) => sum + SIGNALS[id].weight, 0);
  const reasons = signals.map((id) => SIGNALS[id].label);
  const newAndLarge = !knownRecipient && amount >= NEW_RECIPIENT_LIMIT;
  if (newAndLarge) reasons.push(`$${NEW_RECIPIENT_LIMIT} or more to someone new`);
  return { hold: score >= HOLD_SCORE || newAndLarge, score, signals, reasons };
}
