import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import type { Supplement } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

const UNITS = ['g', 'mg', 'mcg', 'IU', 'ml', 'scoop', 'capsule'];
const FREQ = ['Daily', 'Training days', 'Weekly', 'As needed'];

export default function Supplements({ date }: { date: string }) {
  const supps = useLiveQuery(() => db.supplements.filter(s => !s.archived).toArray(), []) ?? [];
  const logs = useLiveQuery(() => db.suppLogs.where('date').equals(date).toArray(), [date]) ?? [];
  const [edit, setEdit] = useState<Supplement | null>(null);
  const [err, setErr] = useState('');
  const taken = (id: string) => logs.find(l => l.supplementId === id)?.taken ?? false;
  const toggle = (id: string) => db.suppLogs.put({ id: `${id}_${date}`, supplementId: id, date, taken: !taken(id) });
  const save = async () => { if (!edit) return; if (!edit.name.trim()) return setErr('Name the supplement.'); await db.supplements.put({ ...edit, name: edit.name.trim() }); setEdit(null); setErr(''); };

  if (edit) return (
    <div className="card"><h2>{supps.some(s => s.id === edit.id) ? 'Edit supplement' : 'New supplement'}</h2>
      <div className="row">
        <label>Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Creatine monohydrate" /></label>
        <label>Dose<input type="number" min={0} step="any" value={edit.dose ?? ''} onChange={e => setEdit({ ...edit, dose: e.target.value === '' ? undefined : num(e.target.value, 0) })} /></label>
        <label>Unit<select value={edit.unit} onChange={e => setEdit({ ...edit, unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
        <label>Frequency<select value={edit.frequency} onChange={e => setEdit({ ...edit, frequency: e.target.value })}>{FREQ.map(u => <option key={u}>{u}</option>)}</select></label>
        <label>Timing<input type="text" value={edit.timing} onChange={e => setEdit({ ...edit, timing: e.target.value })} placeholder="With breakfast" /></label>
      </div>
      <label>Notes<input type="text" value={edit.notes ?? ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
      {err && <p role="alert" className="err">{err}</p>}
      <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
    </div>);
  return (
    <>
      <div className="card"><h2>Taken on {date}</h2>
        {supps.map(s => <label key={s.id} className="chk" style={{ minHeight: 44 }}><input type="checkbox" checked={taken(s.id)} onChange={() => toggle(s.id)} />{s.name}{s.dose !== undefined ? ` · ${s.dose} ${s.unit}` : ''} <span className="muted">{s.timing}</span></label>)}
        {supps.length === 0 && <p className="muted">No supplements yet.</p>}
      </div>
      <div className="card"><h2>Your supplements</h2>
        <p className="muted sm2">This is a tracker only, not medical advice.</p>
        <button className="btn" onClick={() => setEdit({ id: newId(), name: '', unit: 'g', frequency: 'Daily', timing: '', archived: false })}>+ New supplement</button>
        {supps.map(s => <div key={s.id} className="item"><div><strong>{s.name}</strong><div className="muted">{s.dose !== undefined ? `${s.dose} ${s.unit} · ` : ''}{s.frequency}{s.timing ? ` · ${s.timing}` : ''}</div></div>
          <div className="row"><button className="btn ghost sm" onClick={() => setEdit(s)}>Edit</button><button className="btn ghost sm" onClick={() => db.supplements.update(s.id, { archived: true })}>Archive</button></div></div>)}
      </div>
    </>
  );
}
