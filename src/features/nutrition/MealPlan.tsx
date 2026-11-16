import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { DEFAULT_NUTRITION_SCHEDULE, mealTime, scheduleOf } from '../../core/nutrition/meals.ts';
import type { MealRole, MealSlot, NutritionSchedule } from '../../core/types/index.ts';

const ROLES: MealRole[] = ['breakfast', 'lunch', 'pre-workout', 'post-workout', 'dinner', 'bedtime', 'snack'];
export default function MealPlan() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const schedule = scheduleOf(settings?.nutritionSchedule);
  const save = (next: NutritionSchedule) => db.settings.update('settings', { nutritionSchedule: next });
  const update = (id: string, patch: Partial<MealSlot>) => save({ ...schedule, meals: schedule.meals.map(m => m.id === id ? { ...m, ...patch } : m) });
  const add = () => { const id = `meal-${crypto.randomUUID()}`; save({ ...schedule, meals: [...schedule.meals, { id, name: 'Snack', role: 'snack', time: '15:00', enabled: true }] }); };
  const reset = () => { if (confirm('Reset meal times and categories to the default schedule?')) void save(structuredClone(DEFAULT_NUTRITION_SCHEDULE)); };
  return <div className="card">
    <h2>Meal schedule</h2>
    <p className="muted sm2">Set your training time and meal times. Pre- and post-workout meals can move automatically with your workout. Targets are recalculated from the active nutrition phase.</p>
    <label>Workout start time<input type="time" value={schedule.workoutTime} onChange={e => save({ ...schedule, workoutTime: e.target.value })} /></label>
    <h3>Your meals</h3>
    {[...schedule.meals].sort((a, b) => mealTime(a, schedule).localeCompare(mealTime(b, schedule))).map(m => <div className="item" key={m.id} style={{ alignItems: 'center', gap: 10 }}>
      <input aria-label={`${m.name} enabled`} type="checkbox" checked={m.enabled} onChange={e => update(m.id, { enabled: e.target.checked })} />
      <div style={{ flex: 1, minWidth: 130 }}><input aria-label="Meal name" value={m.name} onChange={e => update(m.id, { name: e.target.value })} /></div>
      <select aria-label="Meal type" value={m.role} onChange={e => { const role = e.target.value as MealRole; const relative = role === 'pre-workout' || role === 'post-workout'; update(m.id, { role, relativeToWorkout: relative, ...(relative ? { offsetMinutes: role === 'pre-workout' ? -90 : 60 } : {}) }); }}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
      {m.relativeToWorkout ? <label style={{ minWidth: 115 }}>Offset (minutes)<input type="number" step="15" value={m.offsetMinutes ?? 0} onChange={e => update(m.id, { offsetMinutes: Number(e.target.value) })} /></label> : <label style={{ minWidth: 110 }}>Time<input type="time" value={m.time} onChange={e => update(m.id, { time: e.target.value })} /></label>}
      <div className="muted sm2" style={{ minWidth: 65 }}>{mealTime(m, schedule)}</div>
      <button className="btn ghost sm" aria-label={`Delete ${m.name}`} onClick={() => { if (confirm(`Delete ${m.name}? Existing food logs will remain, but will become unassigned.`)) void save({ ...schedule, meals: schedule.meals.filter(x => x.id !== m.id) }); }}>Delete</button>
    </div>)}
    <div className="row"><button className="btn" onClick={add}>+ Add meal</button><button className="btn ghost" onClick={reset}>Reset defaults</button></div>
    <p className="muted sm2">Pre/post-workout times are relative to your workout start. For example, with a 20:00 workout, a −90 minute pre-workout meal is at 18:30 and a +60 minute post-workout meal is at 21:00. Disable meals you do not use; enabled meals share your daily macro targets.</p>
  </div>;
}
