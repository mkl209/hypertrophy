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

  const numField = (label: string, value: number, onChange: (v: string) => void, min: number, extra?: { max?: number; step?: number }) => (
    <label className="tx-f">{label}<input type="number" min={min} max={extra?.max} step={extra?.step} value={value} onChange={e => onChange(e.target.value)} /></label>
  );

  if (edit) return (
    <div className="card cmp tx">
      <div className="cmp-head">
        <h2>{templates.some(t => t.id === edit.id) ? 'Edit template' : 'New template'}</h2>
        <label className="grow">Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
      </div>
      {edit.exercises.map((r, i) => (
        <div key={r.id} className="tx-item">
          <strong className="tx-name" title={r.exerciseName}>{i + 1}. {r.exerciseName}</strong>
          <span className="tx-act">
            <button className="btn ghost xs" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button className="btn ghost xs" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button className="btn ghost xs" onClick={() => setEdit({ ...edit, exercises: edit.exercises.filter(x => x.id !== r.id) })} aria-label="Remove exercise">×</button>
          </span>
          <div className="tx-nums">
            {numField('Sets', r.sets, v => patchRow(r.id, { sets: num(v, 1) }), 1)}
            {numField('Min', r.repMin, v => patchRow(r.id, { repMin: num(v, 1) }), 1)}
            {numField('Max', r.repMax, v => patchRow(r.id, { repMax: num(v, 1) }), 1)}
            {numField('RIR', r.rir, v => patchRow(r.id, { rir: num(v, 0) }), 0, { max: 5 })}
            {numField('Rest s', r.restSec, v => patchRow(r.id, { restSec: num(v, 0) }), 0, { step: 15 })}
          </div>
          <details className="tx-note">
            <summary className="muted">{r.notes ? 'Note ✎' : '+ Note'}</summary>
            <input type="text" aria-label="Notes" value={r.notes ?? ''} onChange={e => patchRow(r.id, { notes: e.target.value })} />
          </details>
        </div>
      ))}
      <div className="row">
        <select aria-label="Add exercise" value="" onChange={e => add(e.target.value)}><option value="">+ Add exercise…</option>{exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <button className="btn sm" onClick={save}>Save</button>
        <button className="btn ghost sm" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button>
      </div>
      <p className="muted sm2 cmp-p">Saving updates this template for all scheduled sessions that use it. Completed workouts keep their own record.</p>
      {err && <p role="alert" className="err cmp-p">{err}</p>}
    </div>
  );

  const blank = (): WorkoutTemplate => ({ id: newId(), name: '', exercises: [], archived: false, createdAt: Date.now(), updatedAt: Date.now() });
  return (
    <div className="card cmp">
      <div className="cmp-head"><h2>Workout templates</h2><button className="btn sm" onClick={() => setEdit(blank())}>+ New</button></div>
      {templates.filter(t => !t.archived).map(t => (
        <div key={t.id} className="item">
          <div><strong>{t.name}</strong> <span className="muted sm2">{t.exercises.length} ex · {t.exercises.reduce((s, r) => s + r.sets, 0)} sets</span></div>
          <div className="row">
            <button className="btn ghost xs" onClick={() => setEdit(t)}>Edit</button>
            <button className="btn ghost xs" onClick={() => setEdit({ ...t, id: newId(), name: `${t.name} (copy)`, exercises: t.exercises.map(r => ({ ...r, id: newId() })), createdAt: Date.now() })}>Clone</button>
            <button className="btn ghost xs" onClick={() => db.templates.update(t.id, { archived: true })}>Archive</button>
          </div>
        </div>
      ))}
      {templates.every(t => t.archived) && <p className="muted cmp-p">No templates yet. Create one, for example “Full Body A”.</p>}
    </div>
  );
}
