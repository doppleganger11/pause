import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, SIGNALS } from './signals.js';
import { QUESTIONS, plainSummary, readAnswers } from './guide.js';
import { createLivePayPal, createMockPayPal } from './paypal.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp({ env = process.env, paypal, reader = readAnswers } = {}) {
  const pp = paypal ?? (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET
    ? createLivePayPal({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET, baseUrl: env.PAYPAL_BASE_URL })
    : createMockPayPal());

  // Fictional demo profile. A real product would keep this per account.
  const profile = {
    senderName: 'Eleanor',
    trustedContact: 'your daughter Priya',
    knownRecipients: new Set(['pharmacy@example.com', 'priya@example.com']),
  };
  const payments = new Map();
  const byToken = new Map();

  // Caps paid AI use if a hosted demo gets busy.
  const readTimes = [];
  const readLimit = Number(env.READS_PER_HOUR) || 30;
  function checkReadLimit() {
    const hourAgo = Date.now() - 36e5;
    while (readTimes.length && readTimes[0] < hourAgo) readTimes.shift();
    if (readTimes.length >= readLimit) throw new Error('The demo has reached its limit for this hour. Please try again later.');
    readTimes.push(Date.now());
  }

  const view = (p) => ({
    id: p.id, state: p.state, amount: p.amount, recipientName: p.recipientName,
    question: p.state === 'TALKING' ? QUESTIONS[p.answers.length] : null,
    step: p.answers.length + 1, totalSteps: QUESTIONS.length,
    reasons: p.decision?.reasons ?? [],
    familyLink: p.state === 'HELD' ? `/family.html?token=${p.token}` : null,
    trustedContact: profile.trustedContact,
    batchId: p.batchId ?? null,
  });

  async function pay(p) {
    if (p.state === 'SENT') return;
    p.batchId = await pp.sendPayout(p);
    p.state = 'SENT';
  }

  const app = express();
  app.use(express.json({ limit: '50kb' }));
  app.use(express.static(path.join(here, '..', 'public')));

  const route = (fn) => async (req, res) => {
    try { res.json(await fn(req)); } catch (err) { res.status(400).json({ error: err.message }); }
  };
  const load = (id) => {
    const p = payments.get(id);
    if (!p) throw new Error('Payment not found');
    return p;
  };

  app.get('/api/status', route(async () => ({ paypal: pp.mode, ai: env.GEMINI_API_KEY ? 'gemini' : 'rules', trustedContact: profile.trustedContact })));

  app.post('/api/payments', route(async (req) => {
    const { recipientName, recipientEmail, amount } = req.body ?? {};
    const value = Number(amount);
    if (!String(recipientName ?? '').trim()) throw new Error('Please add who this is for');
    if (!EMAIL.test(String(recipientEmail ?? ''))) throw new Error('Please check the email address');
    if (!(value > 0 && value <= 10000)) throw new Error('Please enter an amount up to $10,000');
    const p = {
      id: crypto.randomUUID(), token: crypto.randomBytes(24).toString('hex'), state: 'TALKING',
      senderName: profile.senderName, recipientName: String(recipientName).trim().slice(0, 80),
      recipientEmail: String(recipientEmail).trim().toLowerCase(),
      amount: Math.round(value * 100) / 100, answers: [],
    };
    payments.set(p.id, p);
    byToken.set(p.token, p);
    return view(p);
  }));

  app.post('/api/payments/:id/answer', route(async (req) => {
    const p = load(req.params.id);
    if (p.state !== 'TALKING') throw new Error('This payment is no longer waiting for an answer');
    const text = String(req.body?.text ?? '').trim().slice(0, 1000);
    if (!text) throw new Error('Please say or type an answer');
    if (p.answers.length + 1 === QUESTIONS.length && env.GEMINI_API_KEY) checkReadLimit();
    p.answers.push(text);
    if (p.answers.length < QUESTIONS.length) return view(p);

    const read = await reader(p);
    p.decision = decide({
      amount: p.amount, knownRecipient: profile.knownRecipients.has(p.recipientEmail),
      answers: p.answers, aiSignals: read.signals,
    });
    p.familySummary = read.familySummary || plainSummary(p, p.decision);
    p.state = p.decision.hold ? 'HELD' : 'READY';
    return view(p);
  }));

  app.post('/api/payments/:id/send', route(async (req) => {
    const p = load(req.params.id);
    if (p.state !== 'READY') throw new Error('This payment cannot be sent right now');
    await pay(p);
    return view(p);
  }));

  app.post('/api/payments/:id/cancel', route(async (req) => {
    const p = load(req.params.id);
    if (p.state === 'SENT') throw new Error('This payment has already been sent');
    p.state = 'CANCELLED';
    return view(p);
  }));

  app.get('/api/payments/:id', route(async (req) => view(load(req.params.id))));

  const familyView = (p) => ({
    state: p.state, senderName: p.senderName, recipientName: p.recipientName, amount: p.amount,
    summary: p.familySummary, reasons: p.decision.reasons,
    answers: QUESTIONS.map((q, i) => ({ q, a: p.answers[i] })),
  });
  const held = (token) => {
    const p = byToken.get(String(token));
    if (!p || !p.decision) throw new Error('This link is not valid');
    return p;
  };

  app.get('/api/family/:token', route(async (req) => familyView(held(req.params.token))));
  app.post('/api/family/:token/decide', route(async (req) => {
    const p = held(req.params.token);
    if (p.state !== 'HELD') throw new Error('This payment has already been decided');
    if (req.body?.decision === 'APPROVE') await pay(p);
    else if (req.body?.decision === 'DECLINE') p.state = 'CANCELLED';
    else throw new Error('Please choose approve or decline');
    return familyView(p);
  }));

  app.get('/api/signals', route(async () => Object.fromEntries(Object.entries(SIGNALS).map(([k, v]) => [k, v.label]))));
  return app;
}
