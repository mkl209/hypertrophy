import { useState } from 'react';
import { diffDays, todayISO, toDayNumber } from '../../core/calendar/dates.ts';
import { muscleVolume, weeklyMuscleSets, type ExMuscles, type Range } from '../../core/analytics/analytics.ts';
import { updateSettings } from '../../db/db.ts';
import LineChart from '../../ui/LineChart.tsx';
import { COLORS, f1, type Data } from './shared.ts';

export default function Muscles({ d, range }: { d: Data; range: Range }) {
  const w = d.settings.secondaryMuscleWeight;
  const ex = new Map<string, ExMuscles>(d.exercises.map(e => [e.id, { primary: e.primaryMuscles, secondary: e.secondaryMuscles }]));
  const rows = muscleVolume(d.workouts, ex, w).sort((a, b) => b.weighted - a.weighted);
  const name = (id: string) => d.muscles.find(m => m.id === id)?.name ?? id;
  const [sel, setSel] = useState('');
  const first = d.workouts.map(x => x.date).sort()[0];
  const start = first && first > range.from ? first : range.from;
  const end = range.to < todayISO() ? range.to : todayISO();
  const weeks = Math.max(1, Math.ceil((diffDays(end, start) + 1) / 7));
  const max = Math.max(1, ...rows.map(r => r.weighted));
  const chosen = sel || rows[0]?.muscleId || '';
  const series = chosen ? weeklyMuscleSets(d.workouts, ex, w, chosen) : [];
  if (rows.length === 0) return <div className="card"><p className="muted">No completed workouts in this period.</p></div>;
  return (
    <>
      <div className="card"><h2>Sets per muscle group</h2>
        <label>Weight given to indirect (secondary) sets: <strong>{w}</strong>
          <input type="range" min={0} max={1} step={0.25} value={w} onChange={e => updateSettings({ secondaryMuscleWeight: Number(e.target.value) })} /></label>
        <p className="muted sm2">Weighted sets = direct sets + {w} × indirect sets. This is an estimate based on each exercise’s primary and secondary muscles, not an exact physiological measure. Muscles come from the current exercise definitions.</p>
        {rows.map(r => {
          const pref = d.settings.muscleVolumePreferences?.[r.muscleId];
          return (
          <div key={r.muscleId} style={{ margin: '10px 0' }}>
            <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}><strong>{name(r.muscleId)}</strong><span>{r.direct} direct · {r.indirect} indirect · <strong>{f1(r.weighted)}</strong> weighted</span></div>
            <div className="bar"><div style={{ width: `${(r.weighted / max) * 100}%`, background: 'var(--accent)' }} /></div>
            <span className="muted sm2">≈ {f1(r.weighted / weeks)} weighted sets/week · trained directly in {r.sessions} session{r.sessions === 1 ? '' : 's'} (≈ {f1(r.sessions / weeks)}/week) over {weeks} week{weeks === 1 ? '' : 's'}{pref ? ` · preference ${pref.min ?? '—'}–${pref.max ?? '—'} sets/week` : ''}</span>
          </div>); })}
      </div>
      <div className="card"><h2>Weekly trend</h2>
        <label>Muscle<select value={chosen} onChange={e => setSel(e.target.value)}>{rows.map(r => <option key={r.muscleId} value={r.muscleId}>{name(r.muscleId)}</option>)}</select></label>
        <LineChart series={[{ name: 'Direct sets', color: COLORS[0], points: series.map(s => ({ x: toDayNumber(s.week), y: s.direct })) }, { name: 'Weighted sets', color: COLORS[1], points: series.map(s => ({ x: toDayNumber(s.week), y: s.weighted })) }]} />
      </div>
    </>
  );
}
