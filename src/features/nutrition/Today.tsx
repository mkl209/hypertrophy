import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { kcalFromMacros, phaseForDate, sumFoods } from '../../core/nutrition/nutrition.ts';
import { allocateMealTargets, mealTime, scheduleOf } from '../../core/nutrition/meals.ts';
import { signed, toleranceOf } from '../../core/nutrition/calories.ts';
import FoodSearch, { type SelectedFood } from './FoodSearch.tsx';

const Bar = ({ label, v, target, unit, tol }: { label: string; v: number; target?: number; unit: string; tol?: number }) => {
  const pct = target ? Math.min(100, (v / target) * 100) : 0;
  const rem = target !== undefined ? Math.round(target - v) : undefined;
  const banded = target !== undefined && tol !== undefined;
  const on = banded && Math.abs(target - v) <= tol;
  const over = banded ? v > target + tol : target !== undefined && v > target * 1.05;
  const note = rem === undefined ? null : on ? 'on target' : rem >= 0 ? `${rem} left` : `${-rem} over`;
  return <div style={{ margin: '8px 0' }}><div className="row" style={{ justifyContent: 'space-between', margin: 0 }}><strong>{label}</strong><span>{Math.round(v)}{target !== undefined ? ` / ${target}` : ''} {unit}{banded && tol > 0 && <span className="muted"> ±{tol}</span>}{note && <span className="muted"> · {note}</span>}</span></div>{target !== undefined && <div className="bar"><div style={{ width: `${pct}%`, background: over ? 'var(--accent)' : on ? 'var(--ok)' : 'var(--secondary)' }} /></div>}</div>;
};

export default function Today({ date }: { date: string }) {
  const foods = useLiveQuery(() => db.foods.where('date').equals(date).toArray(), [date]) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const water = useLiveQuery(() => db.water.get(date), [date]);
  const recent = useLiveQuery(() => db.foods.orderBy('date').reverse().limit(80).toArray(), []) ?? [];
  const [f, setF] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fibre: '', mealId: '' });
  const [err, setErr] = useState('');
  const phase = phaseForDate(phases, date);
  const t = sumFoods(foods);
  const ml = water?.ml ?? 0;
  const waterTarget = phase?.waterMl ?? 3000;
  const schedule = scheduleOf(settings?.nutritionSchedule);
  const mealTargets = useMemo(() => phase ? allocateMealTargets(phase, schedule.meals, foods) : [], [phase, settings?.nutritionSchedule, foods]);
  const assigned = useMemo(() => Object.fromEntries(schedule.meals.map(m => [m.id, sumFoods(foods.filter(f => f.mealId === m.id))])), [foods, schedule.meals]);
  const uniq = [...new Map(recent.filter(r => r.name).map(r => [r.name, r])).values()].slice(0, 8);

  const add = async () => {
    const [p, c, fa, fi] = [f.protein, f.carbs, f.fat, f.fibre].map(x => (x.trim() === '' ? 0 : Number(x)));
    const raw = f.calories.trim() === '' ? NaN : Number(f.calories);
    if ([p, c, fa, fi].some(x => !Number.isFinite(x) || x < 0) || (f.calories.trim() !== '' && (!Number.isFinite(raw) || raw < 0))) return setErr('Use positive numbers only.');
    const kcal = f.calories.trim() === '' ? kcalFromMacros(p, c, fa) : raw;
    if (kcal === 0 && p + c + fa === 0) return setErr('Enter calories or at least one macro.');
    await db.foods.put({ id: newId(), date, name: f.name.trim() || 'Quick add', calories: kcal, protein: p, carbs: c, fat: fa, fibre: fi, createdAt: Date.now(), mealId: f.mealId || undefined, source: 'manual' });
    setF({ name: '', calories: '', protein: '', carbs: '', fat: '', fibre: '', mealId: '' }); setErr('');
  };
  const addDatabaseFood = async ({ food, grams, mealId }: SelectedFood) => {
    const scale = grams / 100;
    await db.foods.put({ id: newId(), date, name: `${food.name}${food.brand ? ` · ${food.brand}` : ''} (${grams} g)`, calories: Math.round(food.calories * scale), protein: Number((food.protein * scale).toFixed(1)), carbs: Number((food.carbs * scale).toFixed(1)), fat: Number((food.fat * scale).toFixed(1)), fibre: Number((food.fibre * scale).toFixed(1)), createdAt: Date.now(), mealId, source: 'open-food-facts', foodCode: food.code, servingGrams: grams });
  };
  const addWater = (d: number) => db.water.put({ date, ml: Math.max(0, ml + d) });
  const field = (k: keyof typeof f, label: string, mode: 'decimal' | 'text' = 'decimal') => <label>{label}<input inputMode={mode} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>;

  return <>
    <div className="card">
      <h2>{phase ? `${phase.name} · ${{ bulk: 'Bulking', maintain: 'Maintenance', cut: 'Cutting' }[phase.goal]}` : 'No nutrition phase for this date'}</h2>
      {!phase && <p className="muted">Create a phase in the Phases tab to see targets. You can still log food.</p>}
      {phase?.maintenance !== undefined && <p className="muted sm2">Maintenance {phase.maintenance} kcal {signed(phase.adjustment ?? 0)} = target {phase.calories} kcal. Within ±{toleranceOf(phase)} kcal is on target.</p>}
      <Bar label="Calories" v={t.calories} target={phase?.calories} unit="kcal" tol={phase ? toleranceOf(phase) : undefined} />
      <Bar label="Protein" v={t.protein} target={phase?.protein} unit="g" /><Bar label="Carbs" v={t.carbs} target={phase?.carbs} unit="g" /><Bar label="Fat" v={t.fat} target={phase?.fat} unit="g" /><Bar label="Fibre" v={t.fibre} target={phase?.fibre} unit="g" />
      <Bar label="Water" v={ml} target={waterTarget} unit="ml" />
      <div className="row"><button className="btn ghost" onClick={() => addWater(250)}>+250 ml</button><button className="btn ghost" onClick={() => addWater(500)}>+500 ml</button><button className="btn ghost" onClick={() => addWater(-250)}>−250 ml</button></div>
    </div>
    {phase && <div className="card"><h2>Meal targets</h2><p className="muted sm2">An RP-inspired starting allocation: protein is spread across meals, carbohydrates are weighted toward training, and pre-workout fat/fibre are lower for easier digestion. These are practical heuristics, not RP's proprietary algorithm. Meal calories are calculated from your P/C/F targets (4/4/9); reconcile those with your daily calorie target in Phases if they differ. Change your schedule in the Meals tab.</p>
      {mealTargets.length === 0 && <p className="muted">Enable at least one meal in the Meals tab to calculate allocations.</p>}
      {[...mealTargets].sort((a, b) => mealTime(a.meal, schedule).localeCompare(mealTime(b.meal, schedule))).map(({ meal, calories, protein, carbs, fat, fibre, redistributed }) => { const eaten = assigned[meal.id] ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }; return <div className="item" key={meal.id} style={{ display: 'block' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><strong>{meal.name}</strong><span className="muted">{mealTime(meal, schedule)} · {Math.round(calories)} kcal target</span></div>
        <div className="muted sm2">{redistributed ? 'Rebalanced remaining target: ' : 'Target: '}Protein {protein} g · Carbs {carbs} g · Fat {fat} g · Fibre {fibre} g</div>
        <div className="muted sm2">Logged: {Math.round(eaten.calories)} kcal · P{Math.round(eaten.protein)} C{Math.round(eaten.carbs)} F{Math.round(eaten.fat)} · {Math.round(eaten.fibre)} g fibre</div>
        <button className="btn ghost sm" onClick={() => setF({ ...f, mealId: meal.id })}>Log food to this meal</button>
      </div>; })}
    </div>}
    <FoodSearch onAdd={addDatabaseFood} mealId={f.mealId} onMealChange={id => setF(current => ({ ...current, mealId: id }))} meals={schedule.meals} />
    <div className="card"><h2>Quick add food</h2>
      <div className="row">{field('name', 'Food (optional)', 'text')}{field('calories', 'Calories')}{field('protein', 'Protein g')}{field('carbs', 'Carbs g')}{field('fat', 'Fat g')}{field('fibre', 'Fibre g')}</div>
      <label>Meal<select value={f.mealId} onChange={e => setF({ ...f, mealId: e.target.value })}><option value="">Unassigned</option>{schedule.meals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <p className="muted sm2">Leave calories blank to calculate them from the macros (4/4/9). Food can be logged without assigning it to a meal.</p>
      {err && <p role="alert" className="err">{err}</p>}<button className="btn" onClick={add}>Add</button>
      {uniq.length > 0 && <><h3>Recent foods</h3><div className="row">{uniq.map(r => <button key={r.name} className="btn ghost sm" onClick={() => setF({ name: r.name, calories: String(r.calories), protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat), fibre: String(r.fibre), mealId: r.mealId ?? '' })}>{r.name}</button>)}</div></>}
    </div>
    <div className="card"><h2>Logged today</h2>
      {foods.map(x => <div key={x.id} className="item"><div><strong>{x.name}</strong><div className="muted">{Math.round(x.calories)} kcal · P{x.protein} C{x.carbs} F{x.fat}{x.fibre ? ` · fibre ${x.fibre}` : ''}{x.mealId ? ` · ${schedule.meals.find(m => m.id === x.mealId)?.name ?? 'Meal'}` : ''}{x.source === 'open-food-facts' ? ' · Open Food Facts' : ''}</div></div><button className="btn ghost sm" onClick={() => db.foods.delete(x.id)}>Delete</button></div>)}
      {foods.length === 0 && <p className="muted">Nothing logged for this date.</p>}
    </div>
  </>;
}
