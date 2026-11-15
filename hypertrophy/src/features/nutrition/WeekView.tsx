import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, startOfWeekMonday } from '../../core/calendar/dates.ts';
import { weekSummary } from '../../core/nutrition/nutrition.ts';
import { DAYS } from '../../ui/util.ts';

export default function WeekView({ date }: { date: string }) {
  const start = startOfWeekMonday(date);
  const foods = useLiveQuery(() => db.foods.where('date').between(start, addDays(start, 6), true, true).toArray(), [start]) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const s = weekSummary(foods, phases, date);
  return (
    <div className="card"><h2>Week of {s.start}</h2>
      <div className="gridwrap"><table className="tbl"><thead><tr><th>Day</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Target kcal</th></tr></thead><tbody>
        {s.days.map((d, i) => <tr key={d.date} className={d.logged ? '' : 'muted'}><td>{DAYS[i].slice(0, 3)} {d.date.slice(5)}</td><td>{d.logged ? Math.round(d.totals.calories) : '–'}</td><td>{d.logged ? Math.round(d.totals.protein) : '–'}</td><td>{d.logged ? Math.round(d.totals.carbs) : '–'}</td><td>{d.logged ? Math.round(d.totals.fat) : '–'}</td><td>{d.phase?.calories ?? '–'}</td></tr>)}
      </tbody></table></div>
      <p><strong>Average over {s.loggedDays} logged day{s.loggedDays === 1 ? '' : 's'}:</strong> {Math.round(s.avg.calories)} kcal · P {Math.round(s.avg.protein)} g · C {Math.round(s.avg.carbs)} g · F {Math.round(s.avg.fat)} g</p>
      <p className="muted">Protein reached at least 90% of target on {s.proteinHitDays} of {s.loggedDays} logged days. Days with nothing logged are excluded from averages.</p>
    </div>
  );
}
