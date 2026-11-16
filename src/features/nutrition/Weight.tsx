import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { isValidISODate, toDayNumber, todayISO, addDays } from '../../core/calendar/dates.ts';
import { movingAverage, sumFoods, weeklyRate } from '../../core/nutrition/nutrition.ts';
import { toleranceOf, withinTarget } from '../../core/nutrition/calories.ts';
import LineChart from '../../ui/LineChart.tsx';
import { adaptiveCalorieSuggestion } from '../../core/nutrition/adaptive.ts';
import { phaseEnergy } from '../../core/nutrition/calories.ts';

export default function Weight({ unit }: { unit: string }) {
  const entries = useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? [];
  const phases = useLiveQuery(() => db.phases.toArray(), []) ?? [];
  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState('');
  const [bf, setBf] = useState('');
  const [err, setErr] = useState('');
  const ma = movingAverage(entries);
  const rate = weeklyRate(entries);
  const latest = entries[entries.length - 1];
  const from = latest ? addDays(latest.date, -14) : todayISO();
  const foods = useLiveQuery(() => db.foods.where('date').between(from, latest?.date ?? todayISO(), true, true).toArray(), [from, latest?.date]) ?? [];
  const loggedDays = new Set(foods.map(f => f.date)).size;
  const avgKcal = loggedDays ? sumFoods(foods).calories / loggedDays : null;
  const phase = latest ? phases.filter(p => p.startDate <= latest.date && (!p.endDate || latest.date <= p.endDate)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0] : undefined;
  const suggestion = phase ? adaptiveCalorieSuggestion(entries, foods, phase, unit === 'lb' ? 'lb' : 'kg') : undefined;

  // Body fat is optional per entry, so work from the raw entries (not the moving-average rows).
  const bfEntries = entries.flatMap(e => (e.bodyFat != null ? [{ date: e.date, weight: e.weight, bf: e.bodyFat }] : []));
  const latestBf = bfEntries[bfEntries.length - 1];
  const prevBf = bfEntries[bfEntries.length - 2];
  // Estimates are noisy, so smooth over the last 3 estimates.
  const bfAvg = bfEntries.map((e, i) => { const win = bfEntries.slice(Math.max(0, i - 2), i + 1); return { date: e.date, avg: win.reduce((s, x) => s + x.bf, 0) / win.length }; });
  const bfByDate = new Map(entries.map(e => [e.date, e.bodyFat]));
  const fatMass = latestBf ? (latestBf.weight * latestBf.bf) / 100 : 0;

  const save = async () => {
    const n = Number(w);
    const b = bf.trim() === '' ? undefined : Number(bf);
    if (!isValidISODate(date)) return setErr('Pick a valid date.');
    if (!Number.isFinite(n) || n < 20 || n > 400) return setErr('Enter a realistic bodyweight.');
    if (b !== undefined && (!Number.isFinite(b) || b < 3 || b > 60)) return setErr('Enter a realistic body fat estimate (3–60%), or leave it blank.');
    await db.weights.put({ date, weight: n, ...(b !== undefined ? { bodyFat: b } : {}) }); setW(''); setBf(''); setErr('');
  };
  return (
    <>
      <div className="card"><h2>Bodyweight and body fat</h2>
        <div className="row"><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Weight ({unit})<input inputMode="decimal" value={w} onChange={e => setW(e.target.value)} /></label>
          <label>Est. body fat % (optional)<input inputMode="decimal" value={bf} onChange={e => setBf(e.target.value)} /></label>
          <button className="btn" onClick={save}>Save</button></div>
        <p className="muted sm2">One entry per date; saving the same date replaces it, including its body fat.</p>
        {err && <p role="alert" className="err">{err}</p>}
        {latest && <p><strong>7-day average: {ma[ma.length - 1].avg.toFixed(1)} {unit}</strong>{rate !== null ? ` · trend ${rate > 0 ? '+' : ''}${rate.toFixed(2)} ${unit}/week over the last 4 weeks` : ' · trend needs 3+ weigh-ins across at least a week'}{phase?.weeklyChange !== undefined ? ` (phase target ${phase.weeklyChange > 0 ? '+' : ''}${phase.weeklyChange})` : ''}</p>}
        {latestBf && <p><strong>Est. body fat: {latestBf.bf.toFixed(1)}%</strong> <span className="muted">on {latestBf.date}</span>{prevBf ? ` · ${latestBf.bf - prevBf.bf > 0 ? '+' : ''}${(latestBf.bf - prevBf.bf).toFixed(1)} pts since ${prevBf.date}` : ''} · ≈ {fatMass.toFixed(1)} {unit} fat, {(latestBf.weight - fatMass).toFixed(1)} {unit} lean</p>}
        {latestBf && <p className="muted sm2">Body fat is an estimate and varies a few points between methods, so watch the trend rather than single readings, and use the same method each time.</p>}
        {avgKcal !== null && <p className="muted">Context: you averaged {Math.round(avgKcal)} kcal on {loggedDays} logged days in the 2 weeks to your latest weigh-in{phase ? ` (target ${phase.calories} ±${toleranceOf(phase)}${withinTarget(avgKcal, phase.calories, toleranceOf(phase)) ? ', so on target' : ''})` : ''}. This is a comparison, not proof of cause.</p>}
        <LineChart unit={` ${unit}`} series={[{ name: 'Weigh-ins', color: '#7a727b', dots: true, points: ma.map(e => ({ x: toDayNumber(e.date), y: e.weight })) }, { name: '7-day average', color: 'var(--accent)', points: ma.map(e => ({ x: toDayNumber(e.date), y: e.avg })) }]} />
        {bfEntries.length >= 2 && <><h3>Estimated body fat</h3>
          <LineChart unit=" %" series={[{ name: 'Estimates', color: '#7a727b', dots: true, points: bfEntries.map(e => ({ x: toDayNumber(e.date), y: e.bf })) }, { name: '3-estimate average', color: 'var(--accent)', points: bfAvg.map(e => ({ x: toDayNumber(e.date), y: e.avg })) }]} /></>}
      </div>
      {phase && suggestion && <div className="card"><h2>Adaptive calorie coach</h2>
        <p className="muted sm2">Suggestions use your recent weight trend and food logs. Nothing changes until you explicitly accept a recommendation.</p>
        <p><strong>{suggestion.status === 'insufficient-data' ? 'More data needed' : suggestion.status === 'on-track' ? 'On track' : suggestion.status === 'no-rate-target' ? 'Set a weekly weight target' : 'Adjustment to consider'}</strong></p>
        <p>{suggestion.message}</p>
        <div className="muted sm2">Average logged intake: {suggestion.averageCalories !== undefined ? `${suggestion.averageCalories} kcal/day` : 'not available'} · Weight trend: {suggestion.currentRate !== undefined ? `${suggestion.currentRate > 0 ? '+' : ''}${suggestion.currentRate.toFixed(2)} ${unit}/week` : 'not available'} · Target: {suggestion.targetRate !== undefined ? `${suggestion.targetRate > 0 ? '+' : ''}${suggestion.targetRate.toFixed(2)} ${unit}/week` : 'not configured'} · Food logging: {suggestion.loggedDays}/14 days · Weigh-ins: {suggestion.weighIns}</div>
        {suggestion.suggestedCalories !== undefined && suggestion.adjustment !== undefined && suggestion.adjustment !== 0 && <div className="row"><strong>Suggested target: {suggestion.suggestedCalories} kcal ({suggestion.adjustment > 0 ? '+' : ''}{suggestion.adjustment} kcal)</strong><button className="btn" onClick={async () => { const energy = phaseEnergy(phase); const nextAdjustment = energy.adjustment + suggestion.adjustment!; const carbDelta = Math.round(suggestion.adjustment! / 4); const nextCarbs = Math.max(0, phase.carbs + carbDelta); const hasRestOverrides = phase.restDayCalories !== undefined || phase.restDayProtein !== undefined || phase.restDayCarbs !== undefined || phase.restDayFat !== undefined; await db.phases.update(phase.id, { maintenance: energy.maintenance, adjustment: nextAdjustment, calories: energy.maintenance + nextAdjustment, carbs: nextCarbs, ...(hasRestOverrides ? { restDayCalories: (phase.restDayCalories ?? phase.calories) + suggestion.adjustment!, restDayCarbs: Math.max(0, (phase.restDayCarbs ?? phase.carbs) + carbDelta) } : {}) }); }}>Accept suggestion</button></div>}
        {suggestion.status === 'on-track' && <p className="muted">No change recommended.</p>}
      </div>}
      <div className="card"><h2>History</h2>
        {[...ma].reverse().slice(0, 30).map(e => { const b = bfByDate.get(e.date); return <div key={e.date} className="item"><span>{e.date}</span><span><strong>{e.weight}</strong> {unit} <span className="muted">(avg {e.avg.toFixed(1)}){b != null ? ` · ${b}% BF` : ''}</span> <button className="btn ghost sm" onClick={() => db.weights.delete(e.date)}>Delete</button></span></div>; })}
        {entries.length === 0 && <p className="muted">No weigh-ins yet.</p>}
      </div>
    </>
  );
}
