import { toDayNumber, startOfWeekMonday, todayISO } from '../../core/calendar/dates.ts';
import { movingAverage, phaseForDate, sumFoods, weeklyRate } from '../../core/nutrition/nutrition.ts';
import { phaseSummary, type Range } from '../../core/analytics/analytics.ts';
import LineChart from '../../ui/LineChart.tsx';
import { COLORS, type Data } from './shared.ts';

const GOAL = { bulk: 'Bulking', maintain: 'Maintenance', cut: 'Cutting' };
export default function NutritionStats({ d, range }: { d: Data; range: Range }) {
  const unit = d.settings.unit;
  const dates = [...new Set(d.foods.map(f => f.date))].sort();
  const daily = dates.map(date => ({ date, t: sumFoods(d.foods.filter(f => f.date === date)) }));
  const weeks = new Map<string, typeof daily>();
  for (const x of daily) { const k = startOfWeekMonday(x.date); weeks.set(k, [...(weeks.get(k) ?? []), x]); }
  const weekly = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, l]) => ({ week, n: l.length, kcal: l.reduce((t, x) => t + x.t.calories, 0) / l.length, protein: l.reduce((t, x) => t + x.t.protein, 0) / l.length, carbs: l.reduce((t, x) => t + x.t.carbs, 0) / l.length, fat: l.reduce((t, x) => t + x.t.fat, 0) / l.length }));
  const ma = movingAverage(d.weights);
  const rate = weeklyRate(d.weights, 10000);
  const hit = daily.filter(x => { const p = phaseForDate(d.phases, x.date); return p && x.t.protein >= p.protein * 0.9; }).length;
  const withPhase = daily.filter(x => phaseForDate(d.phases, x.date)).length;
  const overlapping = d.phases.filter(p => p.startDate <= range.to && (!p.endDate || p.endDate >= range.from));
  const today = todayISO();
  const wlog = d.weights; // already range-filtered
  if (daily.length === 0 && wlog.length === 0) return <div className="card"><p className="muted">No nutrition or bodyweight data in this period.</p></div>;
  return (
    <>
      <div className="card"><h2>Calories</h2>
        <LineChart unit=" kcal" series={[{ name: 'Daily kcal', color: COLORS[5], dots: true, points: daily.map(x => ({ x: toDayNumber(x.date), y: x.t.calories })) }, { name: 'Weekly average', color: COLORS[0], points: weekly.map(w => ({ x: toDayNumber(w.week) + 3, y: w.kcal })) }]} />
        <p className="muted">Protein reached at least 90% of target on {hit} of {withPhase} logged days that fall inside a phase. Averages use logged days only.</p>
        <div className="gridwrap"><table className="tbl"><thead><tr><th>Week</th><th>Days</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead><tbody>
          {[...weekly].reverse().map(w => <tr key={w.week}><td>{w.week}</td><td>{w.n}</td><td>{Math.round(w.kcal)}</td><td>{Math.round(w.protein)}</td><td>{Math.round(w.carbs)}</td><td>{Math.round(w.fat)}</td></tr>)}</tbody></table></div></div>
      <div className="card"><h2>Bodyweight</h2>
        <LineChart unit={` ${unit}`} series={[{ name: 'Weigh-ins', color: COLORS[5], dots: true, points: ma.map(e => ({ x: toDayNumber(e.date), y: e.weight })) }, { name: '7-day average', color: COLORS[0], points: ma.map(e => ({ x: toDayNumber(e.date), y: e.avg })) }]} />
        <p>{rate !== null ? `Trend over this period: ${rate > 0 ? '+' : ''}${rate.toFixed(2)} ${unit}/week.` : 'A trend needs 3+ weigh-ins across at least a week.'}</p></div>
      <div className="card"><h2>Phases in this period</h2>
        <div className="gridwrap"><table className="tbl"><thead><tr><th>Phase</th><th>Dates</th><th>Avg kcal (target)</th><th>Avg protein (target)</th><th>Weight trend /wk (target)</th></tr></thead><tbody>
          {overlapping.map(p => { const s = phaseSummary(p, d.foods.length ? d.foods : [], d.weights, today); return <tr key={p.id}><td>{p.name} · {GOAL[p.goal]}</td><td>{p.startDate} → {p.endDate ?? 'ongoing'}</td><td>{s.avgKcal ? Math.round(s.avgKcal) : '–'} ({p.calories})</td><td>{s.avgProtein ? Math.round(s.avgProtein) : '–'} ({p.protein})</td><td>{s.rate !== null ? s.rate.toFixed(2) : '–'} ({p.weeklyChange ?? '–'})</td></tr>; })}</tbody></table></div>
        <p className="muted sm2">Phase figures use data inside the selected period.</p></div>
    </>
  );
}
