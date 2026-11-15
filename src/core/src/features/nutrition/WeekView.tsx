import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, startOfWeekMonday } from '../../core/calendar/dates.ts';
import { weekSummary } from '../../core/nutrition/nutrition.ts';
import { toleranceOf, withinTarget } from '../../core/nutrition/calories.ts';
import { DAYS } from '../../ui/util.ts';

export default function WeekView({ date }: { date: string }) {
  const start = startOfWeekMonday(date);
  const foods = useLiveQuery(() => db.foods.where('date').between(start, addDays(start, 6), true, true).toArray(), [start]) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const s = weekSummary(foods, phases, date);
  // Days that were logged and had a phase, so a calorie target applied.
  const scored = s.days.filter(d => d.logged && d.phase);
  const onTarget = scored.filter(d => d.phase && withinTarget(d.totals.calories, d.phase.calories, toleranceOf(d.phase))).length;
  const tol = scored.length ? toleranceOf(scored[scored.length - 1].phase) : null;
  return (
    <div className="card"><h2>Week of {s.start}</h2>
      <div className="gridwrap"><table className="tbl"><thead><tr><th>Day</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Target kcal</th><th>vs target</th></tr></thead><tbody>
        {s.days.map((d, i) => {
          const diff = d.logged && d.phase ? Math.round(d.totals.calories - d.phase.calories) : null;
          return <tr key={d.date} className={d.logged ? '' : 'muted'}><td>{DAYS[i].slice(0, 3)} {d.date.slice(5)}</td><td>{d.logged ? Math.round(d.totals.calories) : '–'}</td><td>{d.logged ? Math.round(d.totals.protein) : '–'}</td><td>{d.logged ? Math.round(d.totals.carbs) : '–'}</td><td>{d.logged ? Math.round(d.totals.fat) : '–'}</td><td>{d.phase?.calories ?? '–'}</td>
            <td>{diff === null ? '–' : Math.abs(diff) <= toleranceOf(d.phase) ? <span className="badge s-completed">on target</span> : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}</td></tr>;
        })}
      </tbody></table></div>
      <p><strong>Average over {s.loggedDays} logged day{s.loggedDays === 1 ? '' : 's'}:</strong> {Math.round(s.avg.calories)} kcal · P {Math.round(s.avg.protein)} g · C {Math.round(s.avg.carbs)} g · F {Math.round(s.avg.fat)} g</p>
      {tol !== null && <p className="muted">Calories were within ±{tol} kcal of target on {onTarget} of {scored.length} logged day{scored.length === 1 ? '' : 's'}. Small misses either way are fine.</p>}
      <p className="muted">Protein reached at least 90% of target on {s.proteinHitDays} of {s.loggedDays} logged days. Days with nothing logged are excluded from averages.</p>
    </div>
  );
}
