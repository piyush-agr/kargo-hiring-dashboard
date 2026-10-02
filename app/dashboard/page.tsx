'use client';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'PM' | 'SPM'>('PM');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => { const r = await fetch('/api/candidates'); setData(await r.json()); };
  useEffect(() => { load(); }, []);

  async function send(id: string) {
    setBusy(id);
    const r = await fetch('/api/send', { method: 'POST', body: JSON.stringify({ id }) });
    const j = await r.json();
    setMsg(r.ok ? `Sent to ${j.to || 'candidate'}` : 'Send failed: ' + j.error);
    setBusy(''); load();
  }
  async function finish() {
    setBusy('fin');
    for (let k = 0; k < 80; k++) {
      const r = await fetch('/api/finalize', { method: 'POST' }); const j = await r.json();
      if (!r.ok) { setMsg('Error: ' + j.error); break; }
      setMsg(`Drafting... ${j.remaining} left`); if (!j.remaining) break;
    }
    setBusy(''); setMsg('Drafts up to date.'); load();
  }

  if (!data) return <p>Loading...</p>;
  if (data.error) return <p className="err">{data.error}</p>;
  const list = data.candidates.filter((c: any) => c.role_applied === tab && c.scores)
    .sort((a: any, b: any) => b.scores[tab].total - a.scores[tab].total);
  const topN = data.topN;

  return (<>
    <div className="row sp">
      <h2>Ranked shortlist</h2>
      <div className="row">
        {data.pending > 0 && <button className="ghost" disabled={!!busy} onClick={finish}>Finish drafting ({data.pending})</button>}
        <button className="ghost" onClick={load}>Refresh</button>
      </div>
    </div>
    <p className="muted">The system recommends. You decide. Nothing is sent until you press Confirm. Top {topN} per role get an interview invite; everyone below the line gets a draft rejection that you also confirm one by one.</p>
    {msg && <p><b>{msg}</b></p>}
    <div className="tabs">
      {(['PM', 'SPM'] as const).map((r) => (
        <button key={r} className={tab === r ? '' : 'ghost'} onClick={() => setTab(r)}>
          {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'} ({data.candidates.filter((c: any) => c.role_applied === r).length})
        </button>))}
    </div>
    <br />
    {list.map((c: any, i: number) => (<div key={c.id}>
      {i === topN && <div className="line">▲ above the line: interview · below the line: rejection ▼</div>}
      <div className="card">
        <div className="row sp">
          <div>
            <b>#{i + 1} {c.name}</b> <span className="muted">· {c.email}</span>{' '}
            {c.email_type && <span className={`pill ${c.status === 'sent' ? 'sent' : c.email_type}`}>{c.status === 'sent' ? 'SENT' : c.email_type}</span>}
            <div className="muted" style={{ fontSize: 12 }}>Other-role score: {tab === 'PM' ? 'SPM' : 'PM'} {c.scores[tab === 'PM' ? 'SPM' : 'PM'].total}</div>
          </div>
          <div className="score">{c.scores[tab].total}<span className="muted" style={{ fontSize: 13 }}>/100</span></div>
        </div>
        {c.brief && <pre><b>Interview brief:</b> {c.brief}</pre>}
        <details>
          <summary>Score breakdown</summary>
          <table><tbody>
            {c.scores[tab].criteria.map((x: any) => (
              <tr key={x.name}><td><b>{x.name}</b> <span className="muted">({x.weight}%)</span></td><td>{x.score}/10</td><td>{x.reason}</td></tr>))}
          </tbody></table>
        </details>
        {c.email_body ? (
          <details open={i < topN && c.status !== 'sent'}>
            <summary>Draft email: {c.email_subject}</summary>
            <pre>{c.email_body}</pre>
          </details>) : <p className="muted">Draft not ready yet.</p>}
        {c.error && <p className="err">⚠ {c.error}</p>}
        <button className="green" disabled={!c.email_body || c.status === 'sent' || busy === c.id} onClick={() => send(c.id)}>
          {c.status === 'sent' ? 'Sent ✓' : busy === c.id ? 'Sending...' : `Confirm & send ${c.email_type || ''}`}
        </button>
      </div>
    </div>))}
    {!list.length && <p>No scored candidates for this role yet. <a href="/">Upload CVs</a></p>}
  </>);
}
