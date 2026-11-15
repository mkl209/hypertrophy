import { toDayNumber } from '../../core/calendar/dates.ts';
import { readinessVsPerformance } from '../../core/analytics/analytics.ts';
import LineChart from '../../ui/LineChart.tsx';
import { COLORS, f1, type Data } from './shared.ts';

export default function Recovery({ d }: { d: Data }) {
  const cs = [...d.checkins].sort((a, b) => a.date.localeCompare(b.date));
  const line = (name: string, color: string, f: (c: typeof cs[0]) => number) => ({ name, color, points: cs.map(c => ({ x: toDayNumber(c.date), y: f(c) })) });
  const rp = readinessVsPerformance(d.workouts, d.checkins);
  if (cs.length === 0) return <div className="card"><p className="muted">No check-ins in this period. Complete the pre-workout check-in to see recovery trends.</p></div>;
  return (
    <>
      <div className="card"><h2>Sleep duration (hours)</h2><LineChart series={[line('Hours slept', COLORS[1], c => c.sleepHours)]} />
        <h3>Scores (1–5)</h3>
        <LineChart height={220} series={[line('Readiness', COLORS[2], c => c.readiness), line('Sleep quality', COLORS[1], c => c.sleepQuality), line('Stress', COLORS[0], c => c.stress), line('Mental fatigue', COLORS[3], c => c.mentalFatigue), line('Soreness', COLORS[4], c => c.soreness), line('Joint discomfort', COLORS[5], c => c.jointDiscomfort)]} />
        <p className="muted sm2">Higher means more of the named thing. For stress, fatigue, soreness and joint discomfort, lower is better.</p></div>
      <div className="card"><h2>Readiness and session performance</h2>
        <p className="muted">Each point compares a workout’s total volume with the previous session of the same template, alongside that day’s self-rated readiness.</p>
        {rp.r !== null ? <p><strong>Correlation: {f1(rp.r, 2)}</strong> across {rp.pairs.length} sessions. This shows association only. It does not show that readiness caused the change, and volume also moves with your programme.</p> : <p className="muted">{rp.pairs.length} comparable sessions so far. A correlation is only shown from 8 sessions.</p>}
        <div className="gridwrap"><table className="tbl"><thead><tr><th>Date</th><th>Workout</th><th>Readiness</th><th>Volume vs previous</th></tr></thead><tbody>
          {[...rp.pairs].reverse().map(p => <tr key={p.date + p.template}><td>{p.date}</td><td>{p.template}</td><td>{p.readiness}/5</td><td>{p.change >= 0 ? '+' : ''}{p.change.toFixed(1)}%</td></tr>)}</tbody></table></div></div>
    </>
  );
}
