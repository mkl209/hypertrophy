import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, todayISO, diffDays, startOfWeekMonday } from '../../core/calendar/dates.ts';
import { phaseForDate, sumFoods } from '../../core/nutrition/nutrition.ts';
import { WorkoutCard } from '../programme/Schedule.tsx';

export default function Dashboard() {
  const today = todayISO();
  const mesos = useLiveQuery(() => db.mesocycles.where('status').equals('active').toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const micros = useLiveQuery(() => db.microcycles.toArray(), []) ?? [];
  const todays = useLiveQuery(() => db.scheduled.where('date').equals(today).toArray(), [today]) ?? [];
  const upcoming = useLiveQuery(() => db.scheduled.where('date').between(addDays(today, 1), addDays(today, 8), true, true).toArray(), [today]) ?? [];
  const meso = mesos.find(m => { const w = Math.floor(diffDays(today, startOfWeekMonday(m.startDate)) / 7); return w >= 0 && w < m.weeks; });
  const week = meso ? Math.floor(diffDays(today, startOfWeekMonday(meso.startDate)) / 7) : -1;
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.where('date').equals(today).toArray(), [today]) ?? [];
  const phase = phaseForDate(phases, today); const nt = sumFoods(foods);
  const tpl = (id: string) => templates.find(t => t.id === id);
  return (
    <>
      <div className="card"><h2>Today · {today}</h2>
        {meso ? <p>{meso.name}, week {week + 1} of {meso.weeks} ({micros.find(m => m.id === meso.sequence[week])?.name}).</p> : <p className="muted">No active mesocycle covers today. Create one in Programme.</p>}
        {todays.filter(w => !meso || w.mesocycleId === meso.id).map(w => <WorkoutCard key={w.id} w={w} t={tpl(w.templateId)} today={today} />)}
        {todays.length > 0 && <button className="btn" onClick={() => { location.hash = '/workout'; }}>Go to workout</button>}
        {meso && todays.length === 0 && <p className="muted">Rest day.</p>}
      </div>
      <div className="card"><h2>Next 7 days</h2>
        {upcoming.sort((a, b) => a.date.localeCompare(b.date)).map(w => <div key={w.id}><div className="muted">{w.date}</div><WorkoutCard w={w} t={tpl(w.templateId)} today={today} /></div>)}
        {upcoming.length === 0 && <p className="muted">Nothing scheduled.</p>}
      </div>
      <div className="card"><h2>Nutrition</h2>
        {phase ? <p>{phase.name}: {Math.round(nt.calories)} / {phase.calories} kcal · protein {Math.round(nt.protein)} / {phase.protein} g</p> : <p className="muted">No nutrition phase set. Add one in Nutrition.</p>}
      </div>
    </>
  );
}
