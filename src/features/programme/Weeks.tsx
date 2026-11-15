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
    <div className="card cmp">
      <div className="cmp-head">
        <h2>{micros.some(m => m.id === edit.id) ? 'Edit week' : 'New week'}</h2>
        <label className="grow">Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Week A" /></label>
      </div>
      <div className="cgrid wk-days">
        {DAYS.map((d, wd) => (
          <label key={d}>{d.slice(0, 3)}
            <select value={edit.days.find(x => x.weekday === wd)?.templateId ?? ''} onChange={e => setDay(wd, e.target.value)}>
              <option value="">Rest</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      {templates.length === 0 && <p className="err cmp-p">Create workout templates first.</p>}
      {err && <p role="alert" className="err cmp-p">{err}</p>}
      <div className="row"><button className="btn sm" onClick={save}>Save</button><button className="btn ghost sm" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button><span className="muted sm2">Leave a day on Rest for no training.</span></div>
    </div>
  );
  return (
    <div className="card cmp">
      <div className="cmp-head"><h2>Weeks (microcycles)</h2><button className="btn sm" onClick={() => setEdit({ id: newId(), name: '', days: [], archived: false, createdAt: Date.now() })}>+ New</button></div>
      {micros.map(m => (
        <div key={m.id} className="item">
          <div><strong>{m.name}</strong><div className="muted sm2">{[...m.days].sort((a, b) => a.weekday - b.weekday).map(d => `${DAYS[d.weekday].slice(0, 3)}: ${tname(d.templateId)}`).join(' · ')}</div></div>
          <div className="row">
            <button className="btn ghost xs" onClick={() => setEdit(m)}>Edit</button>
            <button className="btn ghost xs" onClick={() => setEdit({ ...m, id: newId(), name: `${m.name} (copy)`, days: m.days.map(d => ({ ...d })), createdAt: Date.now() })}>Clone</button>
            <button className="btn ghost xs" onClick={() => db.microcycles.update(m.id, { archived: true })}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  );
}
