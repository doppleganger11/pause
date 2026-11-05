import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, detect } from '../server/signals.js';
import { readAnswers } from '../server/guide.js';
import { createApp } from '../server/app.js';
import { createLivePayPal, payoutBody } from '../server/paypal.js';

const base = { amount: 50, knownRecipient: true };

test('grandparent scam is held', () => {
  const d = decide({ ...base, answers: ['My grandson is in jail and needs bail', 'A lawyer called me', 'He said do not tell anyone'] });
  assert.equal(d.hold, true);
  assert.ok(d.signals.includes('SECRECY'));
});

test('ordinary payment to a known recipient is not held', () => {
  assert.equal(decide({ ...base, answers: ['My monthly prescription', 'I reached out', 'No'] }).hold, false);
});

test('reassuring answers cannot clear a large payment to someone new', () => {
  const d = decide({ amount: 900, knownRecipient: false, answers: ['A gift for a friend', 'I reached out', 'No'] });
  assert.equal(d.hold, true);
});

test('AI can add a signal but cannot invent one', () => {
  const answers = ['Help for a friend', 'Me', 'No'];
  assert.equal(decide({ ...base, answers, aiSignals: ['SECRECY'] }).hold, true);
  assert.equal(decide({ ...base, answers, aiSignals: ['MADE_UP'] }).hold, false);
});

test('Gemini reading feeds signals in, and failures fall back to rules', async () => {
  const p = { amount: 40, recipientName: 'A', senderName: 'E', answers: ['x', 'y', 'z'] };
  const body = { signals: ['ROMANCE'], familySummary: 'Please check.' };
  const fetchImpl = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }));
  const read = await readAnswers(p, { apiKey: 'k', fetchImpl });
  assert.deepEqual(read.signals, ['ROMANCE']);
  const failed = await readAnswers(p, { apiKey: 'k', fetchImpl: async () => new Response('{}', { status: 403 }) });
  assert.equal(failed.source, 'rules');
});

test('common scam phrasings are detected', () => {
  assert.ok(detect('They told me to say it is for a car').includes('COVER_STORY'));
  assert.ok(detect('Microsoft said I have a virus').includes('TECH_SUPPORT'));
  assert.ok(detect('buy gift cards').includes('GIFT_CARDS'));
});

test('the phrasing from the browser run is detected', () => {
  assert.ok(detect('He said not to tell my daughter').includes('SECRECY'));
  assert.ok(detect('A lawyer called me this morning').includes('THEY_CALLED'));
  assert.equal(decide({ ...base, answers: ['Bail for my grandson', 'A lawyer called me', 'He said not to tell my daughter'] }).hold, true);
});

test('ordinary answers do not trip the wider patterns', () => {
  assert.deepEqual(detect('My monthly prescription from the pharmacy'), []);
  assert.deepEqual(detect('I called them myself'), []);
});

test('payout body matches the Payouts API shape', () => {
  const b = payoutBody({ id: 'a', senderName: 'E', amount: 12.5, recipientEmail: 'x@y.co' });
  assert.equal(b.items[0].amount.value, '12.50');
  assert.equal(b.sender_batch_header.sender_batch_id, 'a');
});

test('live client refuses non-sandbox hosts', () => {
  assert.throws(() => createLivePayPal({ clientId: 'a', clientSecret: 'b', baseUrl: 'https://api-m.paypal.com' }));
});

async function withServer(opts, fn) {
  const server = createApp({ env: {}, ...opts }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const api = async (method, p, body) => {
    const res = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try { await fn(api); } finally { server.close(); }
}

const talk = async (api, recipient, answers) => {
  let p = (await api('POST', '/api/payments', recipient)).data;
  for (const text of answers) p = (await api('POST', `/api/payments/${p.id}/answer`, { text })).data;
  return p;
};

test('held payment only leaves after family approval, and only once', async () => {
  let sends = 0;
  const paypal = { mode: 'simulated', sendPayout: async () => { sends += 1; return 'B1'; } };
  await withServer({ paypal }, async (api) => {
    const p = await talk(api, { recipientName: 'Lawyer', recipientEmail: 'l@example.com', amount: 2400 },
      ['Bail for my grandson', 'They called me', 'He said to keep it secret']);
    assert.equal(p.state, 'HELD');
    assert.equal((await api('POST', `/api/payments/${p.id}/send`)).status, 400);
    assert.equal(sends, 0);
    const token = p.familyLink.split('token=')[1];
    assert.equal((await api('POST', `/api/family/${token}/decide`, { decision: 'APPROVE' })).data.state, 'SENT');
    assert.equal((await api('POST', `/api/family/${token}/decide`, { decision: 'APPROVE' })).status, 400);
    assert.equal(sends, 1);
  });
});

test('family can decline and nothing is sent', async () => {
  let sends = 0;
  const paypal = { mode: 'simulated', sendPayout: async () => { sends += 1; return 'B1'; } };
  await withServer({ paypal }, async (api) => {
    const p = await talk(api, { recipientName: 'Support', recipientEmail: 's@example.com', amount: 500 },
      ['Microsoft said I have a virus', 'They called me', 'Yes hurry']);
    const token = p.familyLink.split('token=')[1];
    assert.equal((await api('POST', `/api/family/${token}/decide`, { decision: 'DECLINE' })).data.state, 'CANCELLED');
    assert.equal(sends, 0);
  });
});

test('safe payment goes through', async () => {
  await withServer({}, async (api) => {
    const p = await talk(api, { recipientName: 'Pharmacy', recipientEmail: 'pharmacy@example.com', amount: 42 },
      ['My prescription', 'I reached out', 'No']);
    assert.equal(p.state, 'READY');
    assert.equal((await api('POST', `/api/payments/${p.id}/send`)).data.state, 'SENT');
  });
});
