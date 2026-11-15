import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import type { WorkoutTemplate } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

export default function Templates() {
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.filter(e => !e.archived).sortBy('name'), []) ?? [];
  const [edit, setEdit] = useState<WorkoutTemplate | null>(null);
  const [err, setErr] = useState('');

  const patchRow = (id: string, p: Partial<WorkoutTemplate['exercises'][number]>) => setEdit(t => t && ({ ...t, exercises: t.exercises.map(r => r.id === id ? { ...r, ...p } : r) }));
  const move = (i: number, d: number) => setEdit(t => { if (!t) return t; const a = [...t.exercises]; const j = i + d; if (j < 0 || j >= a.length) return t; [a[i], a[j]] = [a[j], a[i]]; return { ...t, exercises: a }; });
  const add = (exId: string) => {
    const ex = exercises.find(e => e.id === exId); if (!ex || !edit) return;
    const d = ex.defaults;
    setEdit({ ...edit, exercises: [...edit.exercises, { id: newId(), exerciseId: ex.id, exerciseName: ex.name, sets: d.sets ?? 3, repMin: d.repMin ?? 8, repMax: d.repMax ?? 12, rir: d.rir ?? 2, restSec: d.restSec ?? 120, notes: d.notes }] });
  };
  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErr('Name the template.');
    if (edit.exercises.length === 0) return setErr('Add at least one exercise.');
    if (edit.exercises.some(r => r.sets < 1 || r.repMin < 1 || r.repMin > r.repMax)) return setErr('Check sets and rep ranges (min reps cannot exceed max).');
    await db.templates.put({ ...edit, name: edit.name.trim(), updatedAt: Date.now() });
    setEdit(null); setErr('');
  };

  if (edit) return (
    <div className="card">
      <h2>{templates.some(t => t.id === edit.id) ? 'Edit template' : 'New template'}</h2>
      <label>Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
      {edit.exercises.map((r, i) => (
        <div key={r.id} className="item col">
          <strong>{i + 1}. {r.exerciseName}</strong>
          <div className="row">
            <label>Sets<input type="number" min={1} value={r.sets} onChange={e => patchRow(r.id, { sets: num(e.target.value, 1) })} /></label>
            <label>Min reps<input type="number" min={1} value={r.repMin} onChange={e => patchRow(r.id, { repMin: num(e.target.value, 1) })} /></label>
            <label>Max reps<input type="number" min={1} value={r.repMax} onChange={e => patchRow(r.id, { repMax: num(e.target.value, 1) })} /></label>
            <label>RIR<input type="number" min={0} max={5} value={r.rir} onChange={e => patchRow(r.id, { rir: num(e.target.value, 0) })} /></label>
            <label>Rest (s)<input type="number" min={0} step={15} value={r.restSec} onChange={e => patchRow(r.id, { restSec: num(e.target.value, 0) })} /></label>
          </div>
          <label>Notes<input type="text" value={r.notes ?? ''} onChange={e => patchRow(r.id, { notes: e.target.value })} /></label>
          <div className="row">
            <button className="btn ghost" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button className="btn ghost" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button className="btn ghost" onClick={() => setEdit({ ...edit, exercises: edit.exercises.filter(x => x.id !== r.id) })}>Remove</button>
          </div>
        </div>
      ))}
      <label>Add exercise
        <select value="" onChange={e => add(e.target.value)}><option value="">Choose…</option>{exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      </label>
      <p className="muted">Saving changes updates this template for all scheduled sessions that use it. Completed workouts keep their own record.</p>
      {err && <p role="alert" className="err">{err}</p>}
      <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button></div>
    </div>
  );

  const blank = (): WorkoutTemplate => ({ id: newId(), name: '', exercises: [], archived: false, createdAt: Date.now(), updatedAt: Date.now() });
  return (
    <div className="card">
      <h2>Workout templates</h2>
      <button className="btn" onClick={() => setEdit(blank())}>+ New template</button>
      {templates.filter(t => !t.archived).map(t => (
        <div key={t.id} className="item">
          <div><strong>{t.name}</strong><div className="muted">{t.exercises.length} exercises · {t.exercises.reduce((s, r) => s + r.sets, 0)} sets</div></div>
          <div className="row">
            <button className="btn ghost" onClick={() => setEdit(t)}>Edit</button>
            <button className="btn ghost" onClick={() => setEdit({ ...t, id: newId(), name: `${t.name} (copy)`, exercises: t.exercises.map(r => ({ ...r, id: newId() })), createdAt: Date.now() })}>Clone</button>
            <button className="btn ghost" onClick={() => db.templates.update(t.id, { archived: true })}>Archive</button>
          </div>
        </div>
      ))}
      {templates.every(t => t.archived) && <p className="muted">No templates yet. Create one, for example “Full Body A”.</p>}
    </div>
  );
}
