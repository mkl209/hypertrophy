import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, diffDays, startOfWeekMonday, todayISO } from '../../core/calendar/dates.ts';
import { phaseForDate, sumFoods } from '../../core/nutrition/nutrition.ts';
import { WorkoutCard } from '../programme/Schedule.tsx';
import CheckIn from '../workout/CheckIn.tsx';
import { latestFor } from '../../core/progression/readiness.ts';
import { useState } from 'react';

const Stat = ({ label, value, sub, progress }: { label: string; value: string; sub: string; progress?: number }) => (
  <div className="stat"><div className="stat-l">{label}</div><div className="stat-v">{value}</div><div className="stat-s">{sub}</div>
    {progress !== undefined && <div className="bar"><div style={{ width: `${Math.min(100, progress * 100)}%`, background: progress > 1.05 ? 'var(--accent)' : 'var(--secondary)' }} /></div>}</div>
);

export default function Dashboard() {
  const today = todayISO();
  const [editingCheckIn, setEditingCheckIn] = useState(false);
  const wkStart = startOfWeekMonday(today);
  const mesos = useLiveQuery(() => db.mesocycles.where('status').equals('active').toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const micros = useLiveQuery(() => db.microcycles.toArray(), []) ?? [];
  const todays = useLiveQuery(() => db.scheduled.where('date').equals(today).toArray(), [today]) ?? [];
  const upcoming = useLiveQuery(() => db.scheduled.where('date').between(addDays(today, 1), addDays(today, 8), true, true).toArray(), [today]) ?? [];
  const weekSched = useLiveQuery(() => db.scheduled.where('date').between(wkStart, addDays(wkStart, 6), true, true).toArray(), [wkStart]) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.where('date').equals(today).toArray(), [today]) ?? [];
  const checkinRows = useLiveQuery(() => db.checkins.where('date').equals(today).toArray(), [today]) ?? [];
  const todayCheckIn = latestFor(checkinRows, today);
  const meso = mesos.find(m => { const w = Math.floor(diffDays(today, startOfWeekMonday(m.startDate)) / 7); return w >= 0 && w < m.weeks; });
  const week = meso ? Math.floor(diffDays(today, startOfWeekMonday(meso.startDate)) / 7) : -1;
  const phase = phaseForDate(phases, today); const nt = sumFoods(foods);
  const tpl = (id: string) => templates.find(t => t.id === id);
  const done = weekSched.filter(s => s.status === 'completed').length;

  return (
    <>
      <div className="stats">
        <Stat label="Training block" value={meso ? `Week ${week + 1}/${meso.weeks}` : 'None'} sub={meso ? `${meso.name} · ${micros.find(m => m.id === meso.sequence[week])?.name ?? 'Paused'}` : 'Create one in Programme'} />
        <Stat label="This week" value={`${done}/${weekSched.length}`} sub="sessions completed" progress={weekSched.length ? done / weekSched.length : undefined} />
        <Stat label="Calories" value={String(Math.round(nt.calories))} sub={phase ? `of ${phase.calories} kcal · ${phase.name}` : 'No nutrition phase set'} progress={phase ? nt.calories / phase.calories : undefined} />
        <Stat label="Protein" value={`${Math.round(nt.protein)} g`} sub={phase ? `of ${phase.protein} g` : 'No nutrition phase set'} progress={phase ? nt.protein / phase.protein : undefined} />
      </div>
      {todayCheckIn && !editingCheckIn ? (
        <div className="card"><div className="row" style={{ justifyContent: 'space-between', margin: 0 }}><div><h2>Today's check-in</h2><p className="muted sm2">Saved · readiness {todayCheckIn.readiness}/5 · fatigue {todayCheckIn.fatigue}/5 · soreness {todayCheckIn.soreness}/5</p></div><button className="btn ghost sm" onClick={() => setEditingCheckIn(true)}>Edit check-in</button></div></div>
      ) : (
        <CheckIn date={today} initial={todayCheckIn} title="Today's pre-workout check-in" submitLabel="Save check-in" showSkip={false} onDone={() => setEditingCheckIn(false)} />
      )}
      <div className="grid2">
        <div className="card"><h2>Today</h2>
          {todays.filter(w => !meso || w.mesocycleId === meso.id).map(w => <WorkoutCard key={w.id} w={w} t={tpl(w.templateId)} today={today} />)}
          {todays.length === 0 && <p className="muted">{meso ? 'Rest day.' : 'No active mesocycle covers today. Create one in Programme.'}</p>}
          {todays.length > 0 && <button className="btn" onClick={() => { location.hash = '/workout'; }}>Go to workout</button>}
        </div>
        <div className="card"><h2>Next 7 days</h2>
          {[...upcoming].sort((a, b) => a.date.localeCompare(b.date)).map(w => <div key={w.id}><div className="muted sm2" style={{ margin: '6px 0 4px' }}>{w.date}</div><WorkoutCard w={w} t={tpl(w.templateId)} today={today} /></div>)}
          {upcoming.length === 0 && <p className="muted">Nothing scheduled.</p>}
        </div>
      </div>
    </>
  );
}
