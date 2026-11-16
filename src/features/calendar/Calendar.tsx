import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, startOfWeekMonday, todayISO, weekdayMon0 } from '../../core/calendar/dates.ts';
import { mesoEnd } from '../../core/analytics/analytics.ts';
import { summarize } from '../../core/workout/stats.ts';
import { WorkoutCard } from '../programme/Schedule.tsx';
import { DAYS } from '../../ui/util.ts';

export default function Calendar() {
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const first = `${month}-01`;
  const gridStart = startOfWeekMonday(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const gridEnd = cells[41];
  const scheduled = useLiveQuery(() => db.scheduled.where('date').between(gridStart, gridEnd, true, true).toArray(), [gridStart]) ?? [];
  const runs = useLiveQuery(() => db.runs.where('date').between(gridStart, gridEnd, true, true).toArray(), [gridStart]) ?? [];
  const completed = useLiveQuery(() => db.completed.where('date').between(gridStart, gridEnd, true, true).toArray(), [gridStart]) ?? [];
  const mesos = useLiveQuery(() => db.mesocycles.filter(m => m.status !== 'archived').toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const shift = (n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const title = new Date(`${first}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const mesoAt = (d: string) => mesos.filter(m => d >= m.startDate && d <= mesoEnd(m));
  const selRuns = runs.filter(r => r.date === sel); const selSched = scheduled.filter(s => s.date === sel); const selDone = completed.filter(c => c.date === sel);
  const tpl = (id: string) => templates.find(t => t.id === id);

  return (
    <>
      <div className="row"><button className="btn ghost sm" onClick={() => shift(-1)} aria-label="Previous month">←</button><strong style={{ minWidth: 150, textAlign: 'center' }}>{title}</strong><button className="btn ghost sm" onClick={() => shift(1)} aria-label="Next month">→</button>
        <button className="btn ghost sm" onClick={() => { setMonth(today.slice(0, 7)); setSel(today); }}>Today</button></div>
      <div className="cal">
        {DAYS.map(d => <div key={d} className="calh">{d.slice(0, 3)}</div>)}
        {cells.map(d => {
          const s = scheduled.filter(x => x.date === d), c = completed.filter(x => x.date === d), rs = runs.filter(x => x.date === d), ms = mesoAt(d);
          const startM = mesos.find(m => m.startDate === d), endM = mesos.find(m => mesoEnd(m) === d);
          return (
            <button key={d} className={`cald ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''}`} onClick={() => setSel(d)} aria-label={d}>
              <span className="num">{Number(d.slice(8))}</span>
              {ms.length > 0 && <span className="meso" title={ms.map(m => m.name).join(', ')} />}
              {startM && <span className="sm2">▶ {startM.name}</span>}{endM && <span className="sm2">■ end</span>}
              {s.map(x => <span key={x.id} className={`dot s-${x.status === 'scheduled' && x.date < today ? 'overdue' : x.status}`}>{tpl(x.templateId)?.name ?? '?'}{x.date !== x.originalDate ? ' ↪' : ''}</span>)}
              {rs.map(x => <span key={x.id} className="dot s-completed">Run · {x.distanceKm} km</span>)}
              {c.filter(x => !x.scheduledId).map(x => <span key={x.id} className="dot s-completed">{x.templateName}</span>)}
              {s.length === 0 && c.length === 0 && rs.length === 0 && ms.length > 0 && weekdayMon0(d) >= 0 && <span className="muted sm2">rest</span>}
            </button>);
        })}
      </div>
      <p className="muted sm2">Runs are shown as completed activity entries. Green = completed, red = missed or overdue, grey = skipped, outlined = scheduled. ↪ marks a moved session. The coloured bar marks days inside a mesocycle.</p>
      <div className="card"><h2>{sel}{sel === today ? ' · today' : ''}</h2>
        {mesoAt(sel).map(m => <p key={m.id} className="muted">{m.name}: block runs {m.startDate} → {mesoEnd(m)}</p>)}
        {selSched.map(w => <WorkoutCard key={w.id} w={w} t={tpl(w.templateId)} today={today} actions />)}
        {selRuns.map(r => <div key={r.id} className="item"><div><strong>Run · {r.distanceKm} km</strong><span className="muted"> {r.durationMinutes} min · effort {r.effort}/5{r.notes ? ` · ${r.notes}` : ''}</span></div><button className="btn ghost sm" onClick={() => db.runs.delete(r.id)}>Delete</button></div>)}
        {selDone.map(c => { const s = summarize(c); return <div key={c.id} className="item col"><strong>Completed: {c.templateName}</strong><span className="muted">{s.sets} working sets · {Math.round(s.volume).toLocaleString()} {c.unit}</span></div>; })}
        {selSched.length === 0 && selDone.length === 0 && selRuns.length === 0 && <p className="muted">Nothing scheduled or completed. {mesoAt(sel).length ? 'Rest day.' : ''}</p>}
        <p className="muted sm2">Use Move on a scheduled session to reschedule it to another date.</p>
      </div>
    </>
  );
}
