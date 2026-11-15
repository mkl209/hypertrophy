import { Fragment, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, diffDays, startOfWeekMonday, todayISO, weekdayMon0, isValidISODate } from '../../core/calendar/dates.ts';
import type { ScheduledWorkout, WorkoutTemplate } from '../../core/types/index.ts';
import { DAYS } from '../../ui/util.ts';
import PauseControl from './PauseControl.tsx';
import { describeProgression } from '../../core/progression/strategies.ts';

export function WorkoutCard({ w, t, today, actions }: { w: ScheduledWorkout; t?: WorkoutTemplate; today: string; actions?: boolean }) {
  const [moving, setMoving] = useState(false);
  const status = w.status === 'scheduled' && w.date < today ? 'overdue' : w.status;
  return (
    <div className={`wk ${w.date === today ? 'today' : ''}`}>
      <div className="wk-h"><strong>{t?.name ?? 'Missing template'}</strong><span className={`badge s-${status}`}>{status}{w.date !== w.originalDate ? ' · moved' : ''}</span></div>
      {t?.exercises.map(r => (
        <div key={r.id} className="exl" title={r.exerciseName}>
          <span className="exl-n">{r.exerciseName}</span>
          <span className="muted">{r.sets}×{r.repMin}–{r.repMax} · RIR {r.rir}</span>
        </div>
      ))}
      {actions && (
        <div className="wk-a">
          {w.status === 'scheduled' ? <>
            <button className="btn ghost xs" onClick={() => db.scheduled.update(w.id, { status: 'skipped' })}>Skip</button>
            <button className="btn ghost xs" onClick={() => db.scheduled.update(w.id, { status: 'missed' })}>Missed</button>
            <button className="btn ghost xs" onClick={() => setMoving(m => !m)}>Move</button></>
            : <button className="btn ghost xs" onClick={() => db.scheduled.update(w.id, { status: 'scheduled' })}>Undo</button>}
          {moving && <input type="date" defaultValue={w.date} onChange={e => { if (isValidISODate(e.target.value)) { db.scheduled.update(w.id, { date: e.target.value, status: 'scheduled' }); setMoving(false); } }} />}
        </div>)}
    </div>
  );
}

export default function Schedule({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const today = todayISO();
  const mesos = useLiveQuery(() => db.mesocycles.filter(m => m.status !== 'archived').toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const micros = useLiveQuery(() => db.microcycles.toArray(), []) ?? [];
  const meso = mesos.find(m => m.id === selected) ?? mesos[0];
  const work = useLiveQuery(() => meso ? db.scheduled.where('mesocycleId').equals(meso.id).toArray() : [], [meso?.id]) ?? [];
  if (!meso) return <div className="card cmp"><h2>Schedule</h2><p className="muted cmp-p">No mesocycle yet. Create templates, then a week, then a block.</p></div>;

  const first = startOfWeekMonday(meso.startDate);
  const curWeek = Math.floor(diffDays(today, first) / 7);
  const tpl = (id: string) => templates.find(t => t.id === id);
  const weekOf = (d: string) => Math.floor(diffDays(d, first) / 7);
  const inBlock = work.filter(w => weekOf(w.date) >= 0 && weekOf(w.date) < meso.weeks);
  const outside = work.filter(w => !inBlock.includes(w));
  const rows = [0, 1, 2, 3, 4, 5, 6].filter(d => inBlock.some(w => weekdayMon0(w.date) === d));
  const done = work.filter(w => w.status === 'completed').length;

  return (
    <>
      <div className="tabs">{mesos.map(m => <button key={m.id} aria-current={m.id === meso.id ? 'page' : undefined} onClick={() => onSelect(m.id)}>{m.name} <span className="muted">{m.weeks}w</span></button>)}</div>
      <div className="card cmp">
        <div className="cmp-head">
          <div className="grow">
            <h2>{meso.name}</h2>
            <div className="muted sm2">{meso.startDate} · {meso.weeks}w · {done}/{work.length} done · {meso.pattern} · {describeProgression(meso.progression)}</div>
          </div>
          <div className="row" style={{ margin: 0 }}>
            <PauseControl meso={meso} work={work} />
            <button className="btn ghost xs" onClick={() => db.mesocycles.update(meso.id, { status: 'completed' })}>Mark complete</button>
            <button className="btn ghost xs" onClick={() => { if (confirm('Archive this block? Its data is kept.')) db.mesocycles.update(meso.id, { status: 'archived' }); }}>Archive</button>
          </div>
        </div>
      </div>
      <div className="gridwrap sched"><div className="grid" style={{ gridTemplateColumns: `42px repeat(${meso.weeks}, minmax(176px, 1fr))` }}>
        <div />
        {Array.from({ length: meso.weeks }, (_, w) => (
          <div key={w} className={`gh ${w === curWeek ? 'cur' : ''}`}><strong>W{w + 1} · {micros.find(m => m.id === meso.sequence[w])?.name ?? 'Paused'}</strong> <span className="muted sm2">{addDays(first, w * 7).slice(5)}→{addDays(first, w * 7 + 6).slice(5)}</span></div>
        ))}
        {rows.map(d => (<Fragment key={d}>
          <div key={`l${d}`} className="gl">{DAYS[d].slice(0, 3)}</div>
          {Array.from({ length: meso.weeks }, (_, w) => (
            <div key={`${d}-${w}`} className="gc">{inBlock.filter(x => weekOf(x.date) === w && weekdayMon0(x.date) === d).map(x => <WorkoutCard key={x.id} w={x} t={tpl(x.templateId)} today={today} actions />)}</div>
          ))}
        </Fragment>))}
      </div></div>
      {outside.length > 0 && <div className="card cmp"><h2>Moved outside the block</h2>{outside.map(x => <WorkoutCard key={x.id} w={x} t={tpl(x.templateId)} today={today} actions />)}</div>}
    </>
  );
}
