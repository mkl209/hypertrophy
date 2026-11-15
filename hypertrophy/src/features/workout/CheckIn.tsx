import { useState } from 'react';
import { db, newId } from '../../db/db.ts';
import type { PreWorkoutCheckIn } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

const Slider = ({ label, v, set, lo, hi }: { label: string; v: number; set: (n: number) => void; lo: string; hi: string }) => (
  <label className="slider">{label}: <strong>{v}</strong>
    <input type="range" min={1} max={5} step={1} value={v} onChange={e => set(Number(e.target.value))} />
    <span className="muted sm2">{lo} ← → {hi}</span></label>
);

export default function CheckIn({ date, scheduledId, onDone }: { date: string; scheduledId?: string; onDone: (c?: PreWorkoutCheckIn) => void }) {
  const [c, setC] = useState<PreWorkoutCheckIn>({ id: newId(), date, scheduledId, sleepHours: 7.5, sleepQuality: 3, fatigue: 2, soreness: 2, recovery: 3, stress: 2, mentalFatigue: 2, motivation: 3, readiness: 3, jointDiscomfort: 1, jointPain: 1, unwell: false, hydration: 3, createdAt: Date.now() });
  const p = (k: keyof PreWorkoutCheckIn) => (n: number) => setC(x => ({ ...x, [k]: n }));
  const caution = c.unwell || c.jointPain >= 4;
  const go = async () => { await db.checkins.put(c); onDone(c); };
  return (
    <div className="card">
      <h2>Pre-workout check-in</h2><p className="muted">About 30 seconds. All of this is optional context for your recommendations.</p>
      <h3>Sleep</h3>
      <label>Hours slept<input type="number" min={0} max={16} step={0.25} value={c.sleepHours} onChange={e => setC({ ...c, sleepHours: num(e.target.value, 0) })} /></label>
      <Slider label="Sleep quality" v={c.sleepQuality} set={p('sleepQuality')} lo="poor" hi="great" />
      <h3>Recovery</h3>
      <Slider label="General fatigue" v={c.fatigue} set={p('fatigue')} lo="fresh" hi="exhausted" />
      <Slider label="Muscle soreness" v={c.soreness} set={p('soreness')} lo="none" hi="very sore" />
      <Slider label="Recovered from last sessions" v={c.recovery} set={p('recovery')} lo="not at all" hi="fully" />
      <h3>Mind</h3>
      <Slider label="Stress" v={c.stress} set={p('stress')} lo="calm" hi="very stressed" />
      <Slider label="Mental fatigue" v={c.mentalFatigue} set={p('mentalFatigue')} lo="sharp" hi="drained" />
      <Slider label="Motivation" v={c.motivation} set={p('motivation')} lo="low" hi="high" />
      <Slider label="Overall readiness" v={c.readiness} set={p('readiness')} lo="poor" hi="excellent" />
      <h3>Body</h3>
      <Slider label="Joint discomfort" v={c.jointDiscomfort} set={p('jointDiscomfort')} lo="none" hi="a lot" />
      <Slider label="Joint pain" v={c.jointPain} set={p('jointPain')} lo="none" hi="sharp / severe" />
      <label className="chk"><input type="checkbox" checked={c.unwell} onChange={e => setC({ ...c, unwell: e.target.checked })} />Feeling ill or unwell</label>
      {caution && <p className="err" role="alert">Don’t push through concerning pain or illness. Consider a lighter session, swapping exercises, or resting. If pain is persistent or sharp, get it checked by a qualified professional. This app can’t diagnose injuries.</p>}
      <h3>Hydration</h3>
      <Slider label="Hydration today" v={c.hydration} set={p('hydration')} lo="dry" hi="well hydrated" />
      <label>Water so far (litres, optional)<input type="number" min={0} step={0.1} value={c.waterL ?? ''} onChange={e => setC({ ...c, waterL: e.target.value === '' ? undefined : num(e.target.value, 0) })} /></label>
      <label>Notes<input type="text" value={c.notes ?? ''} onChange={e => setC({ ...c, notes: e.target.value })} /></label>
      <div className="row"><button className="btn" onClick={go}>Continue</button><button className="btn ghost" onClick={() => onDone(undefined)}>Skip check-in</button></div>
    </div>
  );
}
