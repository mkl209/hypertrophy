import { useState } from 'react';
import { toDayNumber } from '../../core/calendar/dates.ts';
import { exerciseSessions, weeklyTotals, workoutTotals } from '../../core/analytics/analytics.ts';
import { summarize } from '../../core/workout/stats.ts';
import LineChart from '../../ui/LineChart.tsx';
import { COLORS, f1, type Data } from './shared.ts';

export default function Training({ d, all }: { d: Data; all: Data }) {
  const unit = d.settings.unit;
  const tot = workoutTotals(d.workouts);
  const wt = weeklyTotals(d.workouts);
  const used = [...new Map(d.workouts.flatMap(w => w.exercises.map(e => [e.exerciseId, e.exerciseName] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const [exId, setExId] = useState('');
  const [wid, setWid] = useState('');
  const ex = exId || used[0]?.[0] || '';
  const sess = ex ? exerciseSessions(d.workouts, ex) : [];
  const one = d.workouts.find(w => w.id === wid);
  const sorted = [...d.workouts].sort((a, b) => b.finishedAt - a.finishedAt);

  if (d.workouts.length === 0) return <div className="card"><p className="muted">No completed workouts in this period. Analytics use only workouts you actually finished, not planned ones.</p></div>;
  return (
    <>
      <div className="card"><h2>Totals</h2>
        <p>{tot.sessions} sessions · {tot.sets} working sets · {tot.reps} reps · {Math.round(tot.volume).toLocaleString()} {unit} total volume</p>
        <h3>Weekly working sets</h3>
        <LineChart series={[{ name: 'Sets', color: COLORS[0], points: wt.map(w => ({ x: toDayNumber(w.week), y: w.sets })) }]} />
        <h3>Weekly volume ({unit})</h3>
        <LineChart series={[{ name: 'Volume', color: COLORS[1], points: wt.map(w => ({ x: toDayNumber(w.week), y: w.volume })) }]} />
      </div>
      <div className="card"><h2>Exercise progression</h2>
        <label>Exercise<select value={ex} onChange={e => setExId(e.target.value)}>{used.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <LineChart unit={` ${unit}`} series={[{ name: 'Top weight', color: COLORS[0], points: sess.map(s => ({ x: toDayNumber(s.date), y: s.topWeight })) }, { name: 'Est. 1RM', color: COLORS[1], points: sess.map(s => ({ x: toDayNumber(s.date), y: s.bestE1rm })) }]} />
        <div className="gridwrap"><table className="tbl"><thead><tr><th>Date</th><th>Top</th><th>e1RM</th><th>Sets</th><th>Reps</th><th>Avg RIR</th><th></th></tr></thead><tbody>
          {[...sess].reverse().map(s => <tr key={s.workoutId}><td>{s.date}</td><td>{s.topWeight}</td><td>{s.bestE1rm}</td><td>{s.sets}</td><td>{s.reps}</td><td>{f1(s.avgRir)}</td><td>{(s.prWeight || s.prE1rm) && <span className="chip">PR</span>}</td></tr>)}</tbody></table></div>
        <p className="muted sm2">Estimated 1RM uses a standard formula and is most reliable at low reps. Open Exercises history in later phases for notes.</p>
      </div>
      <div className="card"><h2>Individual workout</h2>
        <label>Workout<select value={wid} onChange={e => setWid(e.target.value)}><option value="">Choose…</option>{sorted.map(w => <option key={w.id} value={w.id}>{w.date} · {w.templateName}</option>)}</select></label>
        {one && (() => { const s = summarize(one); return <>
          <p>{s.sets} working sets · {s.reps} reps · {Math.round(s.volume).toLocaleString()} {unit}</p>
          {one.exercises.map(e => { const hist = exerciseSessions(all.workouts, e.exerciseId); const i = hist.findIndex(h => h.workoutId === one.id); const prev = i > 0 ? hist[i - 1] : null; const cur = hist[i];
            return <div key={e.id} className="item col"><strong>{e.exerciseName}</strong><span className="muted">{e.sets.map(x => `${x.weight}×${x.reps}`).join(', ')}</span>
              <span className="sm2">{prev && cur ? `vs ${prev.date}: top weight ${cur.topWeight - prev.topWeight >= 0 ? '+' : ''}${(cur.topWeight - prev.topWeight).toFixed(1)}, reps ${cur.reps - prev.reps >= 0 ? '+' : ''}${cur.reps - prev.reps}` : 'No earlier session to compare.'}{cur && (cur.prWeight || cur.prE1rm) ? ' · PR' : ''}</span></div>; })}</>; })()}
      </div>
    </>
  );
}
