import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import type { Microcycle } from '../../core/types/index.ts';
import { DAYS } from '../../ui/util.ts';

export default function Weeks() {
  const micros = useLiveQuery(() => db.microcycles.filter(m => !m.archived).toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.filter(t => !t.archived).toArray(), []) ?? [];
  const [edit, setEdit] = useState<Microcycle | null>(null);
  const [err, setErr] = useState('');
  const tname = (id: string) => templates.find(t => t.id === id)?.name ?? '?';
  const setDay = (wd: number, templateId: string) => setEdit(m => m && ({ ...m, days: [...m.days.filter(d => d.weekday !== wd), ...(templateId ? [{ weekday: wd, templateId }] : [])] }));

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErr('Name the week.');
    if (edit.days.length === 0) return setErr('Pick at least one training day.');
    await db.microcycles.put({ ...edit, name: edit.name.trim() });
    setEdit(null); setErr('');
  };

  if (edit) return (
    <div className="card">
      <h2>{micros.some(m => m.id === edit.id) ? 'Edit week' : 'New week'}</h2>
      <label>Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Week A" /></label>
      <p className="muted">Choose a workout for each training day. Leave a day empty for rest.</p>
      {DAYS.map((d, wd) => (
        <div key={d} className="row"><strong style={{ width: 100 }}>{d}</strong>
          <select value={edit.days.find(x => x.weekday === wd)?.templateId ?? ''} onChange={e => setDay(wd, e.target.value)}>
            <option value="">Rest</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
      ))}
      {templates.length === 0 && <p className="err">Create workout templates first.</p>}
      {err && <p role="alert" className="err">{err}</p>}
      <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button></div>
    </div>
  );
  return (
    <div className="card">
      <h2>Weeks (microcycles)</h2>
      <button className="btn" onClick={() => setEdit({ id: newId(), name: '', days: [], archived: false, createdAt: Date.now() })}>+ New week</button>
      {micros.map(m => (
        <div key={m.id} className="item">
          <div><strong>{m.name}</strong><div className="muted">{[...m.days].sort((a, b) => a.weekday - b.weekday).map(d => `${DAYS[d.weekday].slice(0, 3)}: ${tname(d.templateId)}`).join(' · ')}</div></div>
          <div className="row">
            <button className="btn ghost" onClick={() => setEdit(m)}>Edit</button>
            <button className="btn ghost" onClick={() => setEdit({ ...m, id: newId(), name: `${m.name} (copy)`, days: m.days.map(d => ({ ...d })), createdAt: Date.now() })}>Clone</button>
            <button className="btn ghost" onClick={() => db.microcycles.update(m.id, { archived: true })}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  );
}
