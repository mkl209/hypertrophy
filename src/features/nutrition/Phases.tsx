import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { addDays, isValidISODate, todayISO } from '../../core/calendar/dates.ts';
import { kcalFromMacros } from '../../core/nutrition/nutrition.ts';
import { DEFAULT_ADJUSTMENT, DEFAULT_TOLERANCE, phaseEnergy, signed } from '../../core/nutrition/calories.ts';
import type { NutritionGoal, NutritionPhase } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

const GOAL: Record<NutritionGoal, string> = { bulk: 'Bulking', maintain: 'Maintenance', cut: 'Cutting' };
const blank = (): NutritionPhase => ({ id: newId(), goal: 'bulk', name: '', startDate: todayISO(), maintenance: 2700, adjustment: DEFAULT_ADJUSTMENT.bulk, tolerance: DEFAULT_TOLERANCE, calories: 3000, protein: 180, carbs: 350, fat: 80, waterMl: 3000 });

export default function Phases({ unit }: { unit: string }) {
  const phases = useLiveQuery(() => db.phases.orderBy('startDate').reverse().toArray(), []) ?? [];
  const [edit, setEdit] = useState<NutritionPhase | null>(null);
  const [err, setErr] = useState('');
  const optNum = (v: string) => (v.trim() === '' ? undefined : num(v, 0));
  // Allows negatives (a cutting adjustment) and an empty box while typing.
  const optSigned = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const save = async () => {
    if (!edit) return;
    // The stored target (`calories`) is always maintenance + adjustment.
    const target = Math.round((edit.maintenance ?? 0) + (edit.adjustment ?? 0));
    if (!edit.name.trim()) return setErr('Name the phase.');
    if (!isValidISODate(edit.startDate) || (edit.endDate && (!isValidISODate(edit.endDate) || edit.endDate < edit.startDate))) return setErr('Check the dates (end must not be before start).');
    if (!Number.isFinite(edit.maintenance) || (edit.maintenance ?? 0) <= 0) return setErr('Enter your maintenance calories.');
    if (!Number.isFinite(edit.adjustment ?? 0)) return setErr('The surplus or deficit must be a number.');
    if (target <= 0) return setErr('Your target calories must be above zero.');
    if (edit.tolerance !== undefined && (!Number.isFinite(edit.tolerance) || edit.tolerance < 0)) return setErr('Tolerance must be zero or more.');
    if ([edit.protein, edit.carbs, edit.fat].some(x => !Number.isFinite(x) || x < 0)) return setErr('Targets must be positive numbers.');
    const isNew = !phases.some(p => p.id === edit.id);
    await db.transaction('rw', db.phases, async () => {
      // Starting a new phase ends the currently open-ended one the day before, so history is kept.
      if (isNew) for (const p of phases) if (!p.endDate && p.startDate < edit.startDate) await db.phases.update(p.id, { endDate: addDays(edit.startDate, -1) });
      await db.phases.put({ ...edit, name: edit.name.trim(), calories: target, tolerance: edit.tolerance ?? DEFAULT_TOLERANCE });
    });
    setEdit(null); setErr('');
  };

  if (edit) {
    const maint = edit.maintenance ?? 0;
    const adj = edit.adjustment ?? 0;
    const target = Math.round(maint + adj);
    const tol = edit.tolerance ?? DEFAULT_TOLERANCE;
    const mk = kcalFromMacros(edit.protein, edit.carbs, edit.fat);
    const f = (k: 'protein' | 'carbs' | 'fat', label: string) => <label>{label}<input type="number" min={0} value={edit[k]} onChange={e => setEdit({ ...edit, [k]: num(e.target.value, 0) })} /></label>;
    return (
      <div className="card"><h2>{phases.some(p => p.id === edit.id) ? 'Edit phase' : 'New phase'}</h2>
        <div className="row">
          <label>Name<input type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Winter bulk" /></label>
          <label>Goal<select value={edit.goal} onChange={e => { const goal = e.target.value as NutritionGoal; setEdit({ ...edit, goal, adjustment: DEFAULT_ADJUSTMENT[goal] }); }}>{Object.entries(GOAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Start<input type="date" value={edit.startDate} onChange={e => setEdit({ ...edit, startDate: e.target.value })} /></label>
          <label>End (optional)<input type="date" value={edit.endDate ?? ''} onChange={e => setEdit({ ...edit, endDate: e.target.value || undefined })} /></label>
        </div>
        <h3>Calories</h3>
        <div className="row">
          <label>Maintenance kcal<input type="number" min={0} value={edit.maintenance ?? ''} onChange={e => setEdit({ ...edit, maintenance: optNum(e.target.value) })} /></label>
          <label>Surplus / deficit kcal<input type="number" step={25} value={edit.adjustment ?? ''} onChange={e => setEdit({ ...edit, adjustment: optSigned(e.target.value) })} /></label>
          <label>Target kcal<input type="number" readOnly tabIndex={-1} aria-readonly="true" value={target} /></label>
          <label>Tolerance ± kcal<input type="number" min={0} step={25} placeholder={String(DEFAULT_TOLERANCE)} value={edit.tolerance ?? ''} onChange={e => setEdit({ ...edit, tolerance: optNum(e.target.value) })} /></label>
        </div>
        <p className="muted sm2">Target = maintenance {signed(adj)} = {target} kcal. Landing within ±{tol} kcal of the target counts as on target. The surplus or deficit starts at a suggested value for the goal; change it freely.</p>
        <h3>Macros and other targets</h3>
        <div className="row">{f('protein', 'Protein g')}{f('carbs', 'Carbs g')}{f('fat', 'Fat g')}
          <label>Fibre g (optional)<input type="number" min={0} value={edit.fibre ?? ''} onChange={e => setEdit({ ...edit, fibre: optNum(e.target.value) })} /></label>
          <label>Water ml<input type="number" min={0} step={250} value={edit.waterMl ?? ''} onChange={e => setEdit({ ...edit, waterMl: optNum(e.target.value) })} /></label>
          <label>Target change per week ({unit}, optional)<input type="number" step={0.05} value={edit.weeklyChange ?? ''} onChange={e => setEdit({ ...edit, weeklyChange: e.target.value.trim() === '' ? undefined : Number(e.target.value) })} /></label>
        </div>
        <p className="muted">Your macros add up to about {mk} kcal{target > 0 && Math.abs(mk - target) > target * 0.1 ? ', which differs from your calorie target by more than 10%. That is allowed; targets are yours to set.' : '.'}</p>
        {!phases.some(p => p.id === edit.id) && <p className="muted">Any open-ended phase that started earlier will end the day before this one starts. Its history is kept.</p>}
        {err && <p role="alert" className="err">{err}</p>}
        <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Cancel</button></div>
      </div>);
  }
  return (
    <div className="card"><h2>Nutrition phases</h2>
      <button className="btn" onClick={() => setEdit(blank())}>+ New phase</button>
      {phases.map(p => (
        <div key={p.id} className="item"><div><strong>{p.name}</strong> <span className="chip">{GOAL[p.goal]}</span><div className="muted">{p.startDate} → {p.endDate ?? 'ongoing'} · {p.calories} kcal target{p.maintenance !== undefined ? ` (maintenance ${p.maintenance} ${signed(p.adjustment ?? 0)})` : ''} · P{p.protein} C{p.carbs} F{p.fat}{p.weeklyChange !== undefined ? ` · ${p.weeklyChange > 0 ? '+' : ''}${p.weeklyChange} ${unit}/wk` : ''}</div></div>
          <div className="row"><button className="btn ghost sm" onClick={() => setEdit({ ...p, ...phaseEnergy(p) })}>Edit</button>
            {!p.endDate && <button className="btn ghost sm" onClick={() => db.phases.update(p.id, { endDate: todayISO() })}>End today</button>}
            <button className="btn ghost sm" onClick={() => { if (confirm('Delete this phase? Food logs are kept.')) db.phases.delete(p.id); }}>Delete</button></div></div>))}
      {phases.length === 0 && <p className="muted">No phases yet. Enter your maintenance calories, pick a goal and set your own surplus or deficit. The target is maintenance plus that adjustment.</p>}
    </div>
  );
}
