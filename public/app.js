const $ = (id) => document.getElementById(id);
let payment = null;

const DEMOS = {
  'demo-scam': { name: 'Mr. Daniels, attorney', email: 'daniels.law@example.com', amount: 2400 },
  'demo-safe': { name: 'Corner Pharmacy', email: 'pharmacy@example.com', amount: 42 },
};

async function api(method, path, body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 6000);
}
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (err) { toast(err.message); } };

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function show(id) {
  for (const s of ['start', 'talk', 'result']) $(s).hidden = s !== id;
}

function render() {
  if (payment.state === 'TALKING') {
    show('talk');
    $('step').textContent = `Question ${payment.step} of ${payment.totalSteps}`;
    $('question').textContent = payment.question;
    $('answer').value = '';
    $('question').focus();
    speak(payment.question);
    return;
  }
  renderResult();
}

function button(label, primary, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  if (primary) b.className = 'primary';
  b.addEventListener('click', guard(fn));
  return b;
}

function renderResult() {
  show('result');
  const p = payment;
  const money = `$${p.amount.toFixed(2)}`;
  const title = $('r-title');
  const body = $('r-body');
  const actions = $('r-actions');
  $('result').classList.toggle('held', p.state === 'HELD');
  $('r-reasons').replaceChildren();
  actions.replaceChildren();

  if (p.state === 'READY') {
    title.textContent = 'This looks fine';
    body.textContent = `Send ${money} to ${p.recipientName}?`;
    actions.append(
      button(`Send ${money}`, true, async () => { payment = await api('POST', `/api/payments/${p.id}/send`); render(); }),
      button('Not now', false, async () => { payment = await api('POST', `/api/payments/${p.id}/cancel`); render(); }),
    );
  } else if (p.state === 'HELD') {
    title.textContent = 'Let’s take a moment';
    body.textContent = `Your money is safe. It hasn't left. We've asked ${p.trustedContact} to take a look. Scammers often sound kind, urgent and official. If anyone is on the phone, you can hang up. A real emergency can wait a few minutes.`;
    $('r-reasons').replaceChildren(...p.reasons.map((r) => { const li = document.createElement('li'); li.textContent = r; return li; }));
    const link = document.createElement('a');
    link.className = 'link';
    link.href = p.familyLink;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Demo only: open the family view (a real product would send this by text)';
    actions.append(link);
    speak('Let’s take a moment. Your money is safe. It has not left.');
    watch(p.id);
  } else if (p.state === 'SENT') {
    title.textContent = 'Sent';
    body.textContent = `${money} is on its way to ${p.recipientName}.`;
  } else {
    title.textContent = 'Nothing was sent';
    body.textContent = 'Your money stayed where it is. Well done for checking.';
  }
  title.focus();
}

// Wait for the family decision without a page refresh.
function watch(id) {
  clearInterval(watch.timer);
  watch.timer = setInterval(guard(async () => {
    const latest = await api('GET', `/api/payments/${id}`);
    if (latest.state !== 'HELD') {
      clearInterval(watch.timer);
      payment = latest;
      render();
    }
  }), 2500);
}

$('form').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  payment = await api('POST', '/api/payments', { recipientName: $('name').value, recipientEmail: $('email').value, amount: $('amount').value });
  render();
}));

$('next').addEventListener('click', guard(async () => {
  const btn = $('next');
  btn.disabled = true;
  try {
    payment = await api('POST', `/api/payments/${payment.id}/answer`, { text: $('answer').value });
    render();
  } finally {
    btn.disabled = false;
  }
}));

for (const [id, d] of Object.entries(DEMOS)) {
  $(id).addEventListener('click', () => { $('name').value = d.name; $('email').value = d.email; $('amount').value = d.amount; });
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  $('mic').addEventListener('click', () => {
    const r = new Recognition();
    r.lang = 'en-US';
    $('mic').classList.add('listening');
    $('mic').textContent = 'Listening…';
    r.onresult = (e) => { $('answer').value = e.results[0][0].transcript; };
    r.onerror = () => toast('I could not hear that. Please type your answer.');
    r.onend = () => { $('mic').classList.remove('listening'); $('mic').textContent = 'Speak my answer'; };
    r.start();
  });
} else {
  $('mic').hidden = true;
}

guard(async () => {
  const s = await api('GET', '/api/status');
  const mk = (text, good) => { const b = document.createElement('span'); b.className = `badge${good ? ' good' : ''}`; b.textContent = text; return b; };
  $('badges').replaceChildren(
    s.paypal === 'sandbox' ? mk('PayPal Sandbox', true) : mk('Simulated PayPal'),
    s.ai === 'gemini' ? mk('Gemini', true) : mk('Rules only'),
  );
})();
