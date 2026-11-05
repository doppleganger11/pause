// PayPal Payouts client. Sandbox only, by design. A simulated twin keeps the
// demo runnable and is always labelled in the UI.
const SANDBOX_HOST = 'api-m.sandbox.paypal.com';

export function createLivePayPal({ clientId, clientSecret, baseUrl, fetchImpl = fetch }) {
  const url = new URL(baseUrl || `https://${SANDBOX_HOST}`);
  if (url.hostname !== SANDBOX_HOST) throw new Error('Pause only talks to the PayPal sandbox');
  async function auth() {
    const res = await fetchImpl(`${url.origin}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status})`);
    return (await res.json()).access_token;
  }
  return {
    mode: 'sandbox',
    async sendPayout(p) {
      const res = await fetchImpl(`${url.origin}/v1/payments/payouts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await auth()}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': p.id },
        body: JSON.stringify(payoutBody(p)),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`PayPal payout failed (${res.status}): ${text.slice(0, 300)}`);
      return JSON.parse(text).batch_header?.payout_batch_id ?? null;
    },
  };
}

export function payoutBody(p) {
  return {
    sender_batch_header: { sender_batch_id: p.id, email_subject: `${p.senderName} sent you money`, recipient_type: 'EMAIL' },
    items: [{
      recipient_type: 'EMAIL',
      amount: { value: p.amount.toFixed(2), currency: 'USD' },
      receiver: p.recipientEmail,
      sender_item_id: p.id,
      note: 'Sent with Pause',
    }],
  };
}

export function createMockPayPal() {
  return { mode: 'simulated', sendPayout: async (p) => `SIMULATED-${p.id.slice(0, 8)}` };
}
