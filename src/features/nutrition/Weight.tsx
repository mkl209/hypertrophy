import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { isValidISODate, toDayNumber, todayISO, addDays } from '../../core/calendar/dates.ts';
import { movingAverage, sumFoods, weeklyRate } from '../../core/nutrition/nutrition.ts';
import LineChart from '../../ui/LineChart.tsx';

export default function Weight({ unit }: { unit: string }) {
  const entries = useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState('');
  const [err, setErr] = useState('');
  const ma = movingAverage(entries);
  const rate = weeklyRate(entries);
  const latest = entries[entries.length - 1];
  const from = latest ? addDays(latest.date, -14) : todayISO();
  const foods = useLiveQuery(() => db.foods.where('date').between(from, latest?.date ?? todayISO(), true, true).toArray(), [from, latest?.date]) ?? [];
  const loggedDays = new Set(foods.map(f => f.date)).size;
  const avgKcal = loggedDays ? sumFoods(foods).calories / loggedDays : null;
  const phase = latest ? phases.filter(p => p.startDate <= latest.date && (!p.endDate || latest.date <= p.endDate)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0] : undefined;

  const save = async () => {
    const n = Number(w);
    if (!isValidISODate(date)) return setErr('Pick a valid date.');
    if (!Number.isFinite(n) || n < 20 || n > 400) return setErr('Enter a realistic bodyweight.');
    await db.weights.put({ date, weight: n }); setW(''); setErr('');
  };
  return (
    <>
      <div className="card"><h2>Bodyweight</h2>
        <div className="row"><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Weight ({unit})<input inputMode="decimal" value={w} onChange={e => setW(e.target.value)} /></label>
          <button className="btn" onClick={save}>Save</button></div>
        <p className="muted sm2">One entry per date; saving the same date replaces it.</p>
        {err && <p role="alert" className="err">{err}</p>}
        {latest && <p><strong>7-day average: {ma[ma.length - 1].avg.toFixed(1)} {unit}</strong>{rate !== null ? ` · trend ${rate > 0 ? '+' : ''}${rate.toFixed(2)} ${unit}/week over the last 4 weeks` : ' · trend needs 3+ weigh-ins across at least a week'}{phase?.weeklyChange !== undefined ? ` (phase target ${phase.weeklyChange > 0 ? '+' : ''}${phase.weeklyChange})` : ''}</p>}
        {avgKcal !== null && <p className="muted">Context: you averaged {Math.round(avgKcal)} kcal on {loggedDays} logged days in the 2 weeks to your latest weigh-in{phase ? ` (target ${phase.calories})` : ''}. This is a comparison, not proof of cause.</p>}
        <LineChart unit={` ${unit}`} series={[{ name: 'Weigh-ins', color: '#7a727b', dots: true, points: ma.map(e => ({ x: toDayNumber(e.date), y: e.weight })) }, { name: '7-day average', color: 'var(--accent)', points: ma.map(e => ({ x: toDayNumber(e.date), y: e.avg })) }]} />
      </div>
      <div className="card"><h2>History</h2>
        {[...ma].reverse().slice(0, 30).map(e => <div key={e.date} className="item"><span>{e.date}</span><span><strong>{e.weight}</strong> {unit} <span className="muted">(avg {e.avg.toFixed(1)})</span> <button className="btn ghost sm" onClick={() => db.weights.delete(e.date)}>Delete</button></span></div>)}
        {entries.length === 0 && <p className="muted">No weigh-ins yet.</p>}
      </div>
    </>
  );
}
