const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get('token') ?? '';

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
}

function render(d) {
  $('title').textContent = `${d.senderName} wants to send $${d.amount.toFixed(2)} to ${d.recipientName}`;
  $('summary').textContent = d.summary;
  $('reasons').replaceChildren(...d.reasons.map((r) => { const li = document.createElement('li'); li.textContent = r; return li; }));
  $('answers').replaceChildren(...d.answers.flatMap(({ q, a }) => {
    const dt = document.createElement('dt');
    dt.textContent = q;
    const dd = document.createElement('dd');
    dd.textContent = a ?? '';
    return [dt, dd];
  }));
  const actions = $('actions');
  actions.replaceChildren();
  if (d.state !== 'HELD') {
    const done = document.createElement('p');
    done.textContent = d.state === 'SENT' ? 'Approved. The money was sent.' : 'Stopped. Nothing was sent.';
    actions.append(done);
    return;
  }
  const mk = (label, decision, primary) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { render(await api('POST', `/api/family/${encodeURIComponent(token)}/decide`, { decision })); }
      catch (err) { toast(err.message); b.disabled = false; }
    });
    return b;
  };
  actions.append(mk('Stop this payment', 'DECLINE', true), mk('It’s fine, send it', 'APPROVE', false));
}

api('GET', `/api/family/${encodeURIComponent(token)}`).then(render).catch((err) => {
  $('title').textContent = 'This link is not valid';
  toast(err.message);
});
