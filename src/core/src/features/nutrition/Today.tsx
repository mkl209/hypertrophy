import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { kcalFromMacros, phaseForDate, sumFoods } from '../../core/nutrition/nutrition.ts';
import { signed, toleranceOf } from '../../core/nutrition/calories.ts';
import { num } from '../../ui/util.ts';

/** `tol` makes the target a band: within ±tol counts as on target (used for calories). */
const Bar = ({ label, v, target, unit, tol }: { label: string; v: number; target?: number; unit: string; tol?: number }) => {
  const pct = target ? Math.min(100, (v / target) * 100) : 0;
  const rem = target !== undefined ? Math.round(target - v) : undefined;
  const banded = target !== undefined && tol !== undefined;
  const on = banded && Math.abs(target - v) <= tol;
  const over = banded ? v > target + tol : target !== undefined && v > target * 1.05;
  const note = rem === undefined ? null : on ? 'on target' : rem >= 0 ? `${rem} left` : `${-rem} over`;
  return (<div style={{ margin: '8px 0' }}>
    <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}><strong>{label}</strong><span>{Math.round(v)}{target !== undefined ? ` / ${target}` : ''} {unit}{banded && tol > 0 && <span className="muted"> ±{tol}</span>}{note && <span className="muted"> · {note}</span>}</span></div>
    {target !== undefined && <div className="bar"><div style={{ width: `${pct}%`, background: over ? 'var(--accent)' : on ? 'var(--ok)' : 'var(--secondary)' }} /></div>}
  </div>);
};

export default function Today({ date }: { date: string }) {
  const foods = useLiveQuery(() => db.foods.where('date').equals(date).toArray(), [date]) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const water = useLiveQuery(() => db.water.get(date), [date]);
  const recent = useLiveQuery(() => db.foods.orderBy('date').reverse().limit(80).toArray(), []) ?? [];
  const [f, setF] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fibre: '' });
  const [err, setErr] = useState('');
  const phase = phaseForDate(phases, date);
  const t = sumFoods(foods);
  const ml = water?.ml ?? 0;
  const waterTarget = phase?.waterMl ?? 3000;
  const uniq = [...new Map(recent.filter(r => r.name).map(r => [r.name, r])).values()].slice(0, 8);

  const add = async () => {
    const [p, c, fa, fi] = [f.protein, f.carbs, f.fat, f.fibre].map(x => (x.trim() === '' ? 0 : Number(x)));
    const raw = f.calories.trim() === '' ? NaN : Number(f.calories);
    if ([p, c, fa, fi].some(x => !Number.isFinite(x) || x < 0) || (f.calories.trim() !== '' && (!Number.isFinite(raw) || raw < 0))) return setErr('Use positive numbers only.');
    const kcal = f.calories.trim() === '' ? kcalFromMacros(p, c, fa) : raw;
    if (kcal === 0 && p + c + fa === 0) return setErr('Enter calories or at least one macro.');
    await db.foods.put({ id: newId(), date, name: f.name.trim() || 'Quick add', calories: kcal, protein: p, carbs: c, fat: fa, fibre: fi, createdAt: Date.now() });
    setF({ name: '', calories: '', protein: '', carbs: '', fat: '', fibre: '' }); setErr('');
  };
  const addWater = (d: number) => db.water.put({ date, ml: Math.max(0, ml + d) });
  const field = (k: keyof typeof f, label: string, mode: 'decimal' | 'text' = 'decimal') => <label>{label}<input inputMode={mode} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>;

  return (
    <>
      <div className="card">
        <h2>{phase ? `${phase.name} · ${{ bulk: 'Bulking', maintain: 'Maintenance', cut: 'Cutting' }[phase.goal]}` : 'No nutrition phase for this date'}</h2>
        {!phase && <p className="muted">Create a phase in the Phases tab to see targets. You can still log food.</p>}
        {phase?.maintenance !== undefined && <p className="muted sm2">Maintenance {phase.maintenance} kcal {signed(phase.adjustment ?? 0)} = target {phase.calories} kcal. Within ±{toleranceOf(phase)} kcal is on target.</p>}
        <Bar label="Calories" v={t.calories} target={phase?.calories} unit="kcal" tol={phase ? toleranceOf(phase) : undefined} />
        <Bar label="Protein" v={t.protein} target={phase?.protein} unit="g" />
        <Bar label="Carbs" v={t.carbs} target={phase?.carbs} unit="g" />
        <Bar label="Fat" v={t.fat} target={phase?.fat} unit="g" />
        <Bar label="Fibre" v={t.fibre} target={phase?.fibre} unit="g" />
        <Bar label="Water" v={ml} target={waterTarget} unit="ml" />
        <div className="row"><button className="btn ghost" onClick={() => addWater(250)}>+250 ml</button><button className="btn ghost" onClick={() => addWater(500)}>+500 ml</button><button className="btn ghost" onClick={() => addWater(-250)}>−250 ml</button></div>
      </div>
      <div className="card"><h2>Add food</h2>
        <div className="row">{field('name', 'Food (optional)', 'text')}{field('calories', 'Calories')}{field('protein', 'Protein g')}{field('carbs', 'Carbs g')}{field('fat', 'Fat g')}{field('fibre', 'Fibre g')}</div>
        <p className="muted sm2">Leave calories blank to calculate them from the macros (4/4/9). Leave the name blank for a quick add.</p>
        {err && <p role="alert" className="err">{err}</p>}
        <button className="btn" onClick={add}>Add</button>
        {uniq.length > 0 && <><h3>Recent foods</h3><div className="row">{uniq.map(r => <button key={r.name} className="btn ghost sm" onClick={() => setF({ name: r.name, calories: String(r.calories), protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat), fibre: String(r.fibre) })}>{r.name}</button>)}</div></>}
      </div>
      <div className="card"><h2>Logged today</h2>
        {foods.map(x => <div key={x.id} className="item"><div><strong>{x.name}</strong><div className="muted">{Math.round(x.calories)} kcal · P{x.protein} C{x.carbs} F{x.fat}{x.fibre ? ` · fibre ${x.fibre}` : ''}</div></div><button className="btn ghost sm" onClick={() => db.foods.delete(x.id)}>Delete</button></div>)}
        {foods.length === 0 && <p className="muted">Nothing logged for this date.</p>}
      </div>
    </>
  );
}
