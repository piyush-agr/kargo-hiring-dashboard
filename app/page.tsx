'use client';
import { useState } from 'react';

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [role, setRole] = useState('AUTO');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const add = (m: string) => setLog((l) => [...l, m]);

  async function run() {
    setBusy(true); setLog([]);
    let i = 0;
    for (const f of files) {
      i++; setPhase(`Reading + scoring ${i}/${files.length}: ${f.name}`);
      const fd = new FormData(); fd.append('file', f); fd.append('role', role);
      try {
        const r = await fetch('/api/process', { method: 'POST', body: fd });
        const j = await r.json();
        add(r.ok ? `OK  ${f.name} -> ${j.role}${j.warning ? ' (' + j.warning + ')' : ''}` : `FAIL ${f.name}: ${j.error}`);
      } catch (e: any) { add(`FAIL ${f.name}: ${e.message}`); }
    }
    setPhase('Ranking and drafting briefs + emails...');
    for (let k = 0; k < 80; k++) {
      const r = await fetch('/api/finalize', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { add('Finalize error: ' + j.error); break; }
      setPhase(`Drafting briefs + emails... ${j.remaining} left`);
      if (j.remaining === 0) break;
    }
    setPhase('Done.'); setBusy(false);
  }

  return (<>
    <h2>Upload CVs</h2>
    <div className="card">
      <p className="muted">Personal details (name, email, phone) are separated in code and stored privately. Only the anonymised CV text is sent to the AI.</p>
      <div className="row">
        <label>Role applied for:{' '}
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="AUTO">Auto (from file name / CV)</option>
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </label>
        <input type="file" multiple accept=".pdf,.docx,.txt" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        <button disabled={busy || !files.length} onClick={run}>{busy ? 'Working...' : `Upload ${files.length || ''} CV(s)`}</button>
        <a href="/dashboard">Open dashboard →</a>
      </div>
      {phase && <p><b>{phase}</b></p>}
      <pre style={{ maxHeight: 320, overflow: 'auto' }}>{log.join('\n') || 'Nothing uploaded yet.'}</pre>
    </div>
  </>);
}
