import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { EQUIPMENT, type Exercise } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';
import MultiSelect from '../../ui/MultiSelect.tsx';

const blank = (): Exercise => ({ id: newId(), name: '', mechanic: 'compound', laterality: 'bilateral', equipment: [], primaryMuscles: [], secondaryMuscles: [],
  defaults: { repMin: 8, repMax: 12, rir: 2, restSec: 120, sets: 3, increment: 2.5 }, archived: false, builtIn: false, createdAt: Date.now(), updatedAt: Date.now() });

export default function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const muscles = useLiveQuery(() => db.muscles.toArray(), []) ?? [];
  const [edit, setEdit] = useState<Exercise | null>(null);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [patternFilter, setPatternFilter] = useState('');
  const [err, setErr] = useState('');
  const mname = (id: string) => muscles.find(m => m.id === id)?.name ?? id;

  const save = async () => {
    if (!edit) return;
    const d = edit.defaults;
    if (!edit.name.trim()) return setErr('Give the exercise a name.');
    if (edit.primaryMuscles.length === 0) return setErr('Choose at least one primary muscle.');
    if ((d.repMin ?? 1) > (d.repMax ?? 1)) return setErr('Minimum reps cannot exceed maximum reps.');
    await db.exercises.put({ ...edit, name: edit.name.trim(), updatedAt: Date.now() });
    setEdit(null); setErr('');
  };
  const list = exercises.filter(e => (showArchived || !e.archived)
    && e.name.toLowerCase().includes(q.toLowerCase())
    && (!muscleFilter || e.primaryMuscles.includes(muscleFilter) || e.secondaryMuscles.includes(muscleFilter))
    && (!equipmentFilter || e.equipment.includes(equipmentFilter as typeof EQUIPMENT[number]))
    && (!typeFilter || e.mechanic === typeFilter)
    && (!patternFilter || e.movementPattern === patternFilter)).sort((a, b) => a.name.localeCompare(b.name));
  const setDef = (k: keyof Exercise['defaults'], v: number) => setEdit(e => e && ({ ...e, defaults: { ...e.defaults, [k]: v } }));

  if (edit) return (
    <div className="card xform">
      <h2>{exercises.some(e => e.id === edit.id) ? 'Edit exercise' : 'New exercise'}</h2>

      <div className="ci-sec">Details</div>
      <div className="xf-details">
        <label className="xf-name">Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
        <label>Type<select value={edit.mechanic} onChange={e => setEdit({ ...edit, mechanic: e.target.value as Exercise['mechanic'] })}><option value="compound">Compound</option><option value="isolation">Isolation</option></select></label>
        <label>Sides<select value={edit.laterality} onChange={e => setEdit({ ...edit, laterality: e.target.value as Exercise['laterality'] })}><option value="bilateral">Bilateral</option><option value="unilateral">Unilateral</option></select></label>
      </div>

      <div className="ci-sec">Muscles &amp; equipment</div>
      <div className="ci-grid">
        <MultiSelect
          label="Primary muscles"
          placeholder="Choose primary muscles"
          options={muscles.map(m => ({ value: m.id, label: m.name }))}
          selected={edit.primaryMuscles}
          onChange={next => setEdit({ ...edit, primaryMuscles: next, secondaryMuscles: edit.secondaryMuscles.filter(x => !next.includes(x)) })}
        />
        <MultiSelect
          label="Secondary muscles"
          placeholder="Choose secondary muscles"
          options={muscles.filter(m => !edit.primaryMuscles.includes(m.id)).map(m => ({ value: m.id, label: m.name }))}
          selected={edit.secondaryMuscles}
          onChange={next => setEdit({ ...edit, secondaryMuscles: next })}
        />
        <MultiSelect
          label="Equipment"
          placeholder="Choose equipment"
          options={EQUIPMENT.map(x => ({ value: x, label: x }))}
          selected={edit.equipment}
          onChange={next => setEdit({ ...edit, equipment: next as Exercise['equipment'] })}
        />
      </div>

      <div className="ci-sec">Defaults <span className="muted xf-hint">templates can override these</span></div>
      <div className="xf-defaults">
        <label>Sets<input type="number" min={1} value={edit.defaults.sets ?? 3} onChange={e => setDef('sets', num(e.target.value, 3))} /></label>
        <label>Min reps<input type="number" min={1} value={edit.defaults.repMin ?? 8} onChange={e => setDef('repMin', num(e.target.value, 8))} /></label>
        <label>Max reps<input type="number" min={1} value={edit.defaults.repMax ?? 12} onChange={e => setDef('repMax', num(e.target.value, 12))} /></label>
        <label>Target RIR<input type="number" min={0} max={5} value={edit.defaults.rir ?? 2} onChange={e => setDef('rir', num(e.target.value, 2))} /></label>
        <label>Rest (s)<input type="number" min={0} step={15} value={edit.defaults.restSec ?? 120} onChange={e => setDef('restSec', num(e.target.value, 120))} /></label>
        <label>Load step<input type="number" min={0} step={0.25} value={edit.defaults.increment ?? 2.5} onChange={e => setDef('increment', num(e.target.value, 2.5))} /></label>
      </div>
      <label className="xf-notes">Notes / technique<input type="text" value={edit.defaults.notes ?? ''} onChange={e => setEdit({ ...edit, defaults: { ...edit.defaults, notes: e.target.value } })} /></label>

      {err && <p role="alert" className="err">{err}</p>}
      <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button></div>
    </div>
  );

  return (
    <div className="card">
      <h2>Exercise library</h2>
      <div className="row">
        <label>Search<input type="text" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label>Muscle group<select value={muscleFilter} onChange={e => setMuscleFilter(e.target.value)}><option value="">All muscle groups</option>{muscles.filter(m => !m.archived).sort((a,b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Equipment<select value={equipmentFilter} onChange={e => setEquipmentFilter(e.target.value)}><option value="">All equipment</option>{EQUIPMENT.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Exercise type<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">All types</option><option value="compound">Compound</option><option value="isolation">Isolation</option></select></label>
        <label>Movement pattern<select value={patternFilter} onChange={e => setPatternFilter(e.target.value)}><option value="">All patterns</option>{[...new Set(exercises.map(e => e.movementPattern).filter((x): x is string => !!x))].sort().map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label className="chk"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Show archived</label>
        <button className="btn" onClick={() => setEdit(blank())}>+ New exercise</button>
      </div>
      {list.map(e => (
        <div key={e.id} className="item">
          <div><strong>{e.name}</strong> {e.archived && <span className="badge">archived</span>}<div className="muted">{e.primaryMuscles.map(mname).join(', ')}{e.secondaryMuscles.length ? ` · also ${e.secondaryMuscles.map(mname).join(', ')}` : ''} · {e.equipment.join(', ') || 'no equipment set'}</div></div>
          <div className="row">
            <button className="btn ghost" onClick={() => setEdit(e)}>Edit</button>
            <button className="btn ghost" onClick={() => setEdit({ ...e, id: newId(), name: `${e.name} (copy)`, builtIn: false, createdAt: Date.now() })}>Clone</button>
            <button className="btn ghost" onClick={() => db.exercises.update(e.id, { archived: !e.archived })}>{e.archived ? 'Restore' : 'Archive'}</button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="muted">No exercises match.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------
   Add to your stylesheet. It reuses the existing .ci-sec and .ci-grid
   classes from the check-in form for the section headings.

.xform .ci-sec:first-of-type { margin-top:4px }
.xf-hint { text-transform:none; letter-spacing:0; font-weight:500; font-size:.72rem }
.xf-details { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr); gap:10px }
.xf-defaults { display:grid; grid-template-columns:repeat(auto-fit,minmax(84px,1fr)); gap:10px }
.xf-defaults input { width:100%; text-align:center }
.xf-details input, .xf-details select, .xf-notes input { width:100% }
.xf-notes { margin-top:10px }
.xform .ms { min-width:0 }
@media (max-width:760px) {
  .xf-details { grid-template-columns:1fr 1fr }
  .xf-name { grid-column:1 / -1 }
  .xf-defaults { grid-template-columns:repeat(3,1fr) }
}
------------------------------------------------------------------- */
