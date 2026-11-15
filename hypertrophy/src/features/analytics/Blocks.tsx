import { useState } from 'react';
import { todayISO } from '../../core/calendar/dates.ts';
import { mesoSummary, muscleVolume, type ExMuscles } from '../../core/analytics/analytics.ts';
import LineChart from '../../ui/LineChart.tsx';
import { COLORS, f1, pct, type Data } from './shared.ts';

export default function Blocks({ d }: { d: Data }) {
  const [ids, setIds] = useState<string[]>([]);
  const today = todayISO();
  const chosen = d.mesos.filter(m => ids.includes(m.id));
  const sums = chosen.map(m => mesoSummary(m, d.scheduled, d.workouts, d.checkins, d.feedback, today));
  const ex = new Map<string, ExMuscles>(d.exercises.map(e => [e.id, { primary: e.primaryMuscles, secondary: e.secondaryMuscles }]));
  const name = (id: string) => d.muscles.find(m => m.id === id)?.name ?? id;
  const per = sums.map((s, i) => new Map(muscleVolume(s.workouts, ex, d.settings.secondaryMuscleWeight).map(r => [r.muscleId, r.weighted / chosen[i].weeks])));
  const muscleIds = [...new Set(per.flatMap(m => [...m.keys()]))].sort((a, b) => name(a).localeCompare(name(b)));
  const unit = d.settings.unit;
  return (
    <>
      <div className="card"><h2>Compare mesocycles</h2>
        {d.mesos.length === 0 && <p className="muted">No mesocycles yet.</p>}
        {d.mesos.map(m => <label key={m.id} className="chk" style={{ minHeight: 40 }}><input type="checkbox" checked={ids.includes(m.id)} onChange={() => setIds(ids.includes(m.id) ? ids.filter(x => x !== m.id) : [...ids, m.id])} />{m.name} <span className="muted">· {m.startDate} · {m.weeks} weeks · {m.status}</span></label>)}
        <p className="muted sm2">Pick one for a breakdown, or several to compare. Only workouts you completed are counted.</p>
      </div>
      {chosen.length > 0 && <>
        <div className="card"><h2>Overview</h2><div className="gridwrap"><table className="tbl"><thead><tr><th></th>{chosen.map(m => <th key={m.id}>{m.name}</th>)}</tr></thead><tbody>
          {([
            ['Sessions completed', (s: typeof sums[0]) => `${s.completed} of ${s.due} due`],
            ['Completion rate', (s: typeof sums[0]) => pct(s.completionRate)],
            ['Missed or overdue', (s: typeof sums[0]) => String(s.missed)],
            ['Skipped', (s: typeof sums[0]) => String(s.skipped)],
            ['Working sets', (s: typeof sums[0]) => String(s.totals.sets)],
            [`Total volume (${unit})`, (s: typeof sums[0]) => Math.round(s.totals.volume).toLocaleString()],
            ['Avg sets / week', (s: typeof sums[0], i: number) => f1(s.totals.sets / chosen[i].weeks)],
            ['Avg readiness (1–5)', (s: typeof sums[0]) => f1(avgOf(s.weeks.map(w => w.avgReadiness)))],
            ['Avg RIR', (s: typeof sums[0]) => f1(avgOf(s.weeks.map(w => w.avgRir)))]
          ] as [string, (s: typeof sums[0], i: number) => string][]).map(([l, f]) => <tr key={l}><td>{l}</td>{sums.map((s, i) => <td key={i}>{f(s, i)}</td>)}</tr>)}
        </tbody></table></div>
        <p className="muted sm2">Completion rate = completed ÷ sessions due so far. Skipped sessions count as not completed.</p></div>
        <div className="card"><h2>Weekly volume by week of block ({unit})</h2>
          <LineChart xFormat={x => `W${x}`} series={sums.map((s, i) => ({ name: chosen[i].name, color: COLORS[i % COLORS.length], points: s.weeks.filter(w => w.sessions > 0).map(w => ({ x: w.week + 1, y: w.volume })) }))} />
          <h3>Average RIR by week</h3>
          <LineChart xFormat={x => `W${x}`} series={sums.map((s, i) => ({ name: chosen[i].name, color: COLORS[i % COLORS.length], points: s.weeks.filter(w => w.avgRir !== null).map(w => ({ x: w.week + 1, y: w.avgRir as number })) }))} />
          <h3>Readiness and post-workout fatigue by week (1–5)</h3>
          <LineChart xFormat={x => `W${x}`} series={sums.flatMap((s, i) => [
            { name: `${chosen[i].name} readiness`, color: COLORS[(i * 2) % COLORS.length], points: s.weeks.filter(w => w.avgReadiness !== null).map(w => ({ x: w.week + 1, y: w.avgReadiness as number })) },
            { name: `${chosen[i].name} fatigue`, color: COLORS[(i * 2 + 1) % COLORS.length], points: s.weeks.filter(w => w.avgFatigueFeedback !== null).map(w => ({ x: w.week + 1, y: w.avgFatigueFeedback as number })) }])} />
        </div>
        <div className="card"><h2>Weighted sets per muscle per week</h2><div className="gridwrap"><table className="tbl"><thead><tr><th>Muscle</th>{chosen.map(m => <th key={m.id}>{m.name}</th>)}</tr></thead><tbody>
          {muscleIds.map(id => <tr key={id}><td>{name(id)}</td>{per.map((m, i) => <td key={i}>{f1(m.get(id) ?? 0)}</td>)}</tr>)}</tbody></table></div>
          <p className="muted sm2">Averaged over each block’s planned length; indirect sets are weighted by your setting in the Muscles tab (an estimate).</p></div>
      </>}
    </>
  );
}
const avgOf = (a: (number | null)[]): number | null => { const v = a.filter((x): x is number => x !== null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
