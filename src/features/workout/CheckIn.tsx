import { useState, type CSSProperties, type ReactNode } from 'react';
import { db, newId } from '../../db/db.ts';
import type { PreWorkoutCheckIn } from '../../core/types/index.ts';
import { num } from '../../ui/util.ts';

type Kind = 'slider' | 'buttons';

/** One 1-5 question. `as` picks how it is shown: a compact slider or a row of 1-5 buttons. */
function Scale({ label, name, v, set, lo, hi, as }: {
  label: string; name: string; v: number; set: (n: number) => void; lo: string; hi: string; as: Kind;
}) {
  return (
    <div className="ci-field">
      <div className="ci-head">
        <span className="ci-label">{label}</span>
        {as === 'slider' && <strong className="ci-val">{v}</strong>}
      </div>
      {as === 'slider' ? (
        <input
          type="range" className="ci-range" min={1} max={5} step={1} value={v} aria-label={label}
          style={{ '--p': `${(v - 1) * 25}%` } as CSSProperties}
          onChange={e => set(Number(e.target.value))}
        />
      ) : (
        <div className="seg-group" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map(n => (
            <label key={n} className="seg">
              <input type="radio" name={name} checked={v === n} onChange={() => set(n)} />
              <span>{n}</span>
            </label>
          ))}
        </div>
      )}
      <div className="ci-ends"><span>{lo}</span><span>{hi}</span></div>
    </div>
  );
}

const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="ci-sec">{title}</h3>
    <div className="ci-grid">{children}</div>
  </section>
);

export default function CheckIn({ date, scheduledId, initial, title = 'Pre-workout check-in', submitLabel = 'Continue', showSkip = true, onDone }: {
  date: string; scheduledId?: string; initial?: PreWorkoutCheckIn; title?: string; submitLabel?: string; showSkip?: boolean;
  onDone: (c?: PreWorkoutCheckIn) => void;
}) {
  const [c, setC] = useState<PreWorkoutCheckIn>(initial ?? { id: newId(), date, scheduledId, sleepHours: 7.5, sleepQuality: 3, fatigue: 2, soreness: 2, recovery: 3, stress: 2, mentalFatigue: 2, motivation: 3, readiness: 3, jointDiscomfort: 1, jointPain: 1, unwell: false, hydration: 3, createdAt: Date.now() });
  const p = (k: keyof PreWorkoutCheckIn) => (n: number) => setC(x => ({ ...x, [k]: n }));
  const caution = c.unwell || c.jointPain >= 4;
  const go = async () => { await db.checkins.put(c); onDone(c); };

  // To swap any question between a slider and buttons, change its `as` prop below.
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted sm2 ci-intro">About 30 seconds. All of this is optional context for your recommendations.</p>

      <Sec title="Sleep">
        <label className="ci-field">Hours slept last night<input type="number" min={0} max={16} step={0.25} value={c.sleepHours} onChange={e => setC({ ...c, sleepHours: num(e.target.value, 0) })} /></label>
        <Scale as="buttons" label="Sleep quality" name="sleepQuality" v={c.sleepQuality} set={p('sleepQuality')} lo="poor" hi="great" />
      </Sec>

      <Sec title="Recovery">
        <Scale as="slider" label="General fatigue" name="fatigue" v={c.fatigue} set={p('fatigue')} lo="fresh" hi="exhausted" />
        <Scale as="slider" label="Muscle soreness" name="soreness" v={c.soreness} set={p('soreness')} lo="none" hi="very sore" />
        <Scale as="buttons" label="Recovered from last sessions" name="recovery" v={c.recovery} set={p('recovery')} lo="not at all" hi="fully" />
      </Sec>

      <Sec title="Mind">
        <Scale as="slider" label="Stress" name="stress" v={c.stress} set={p('stress')} lo="calm" hi="very stressed" />
        <Scale as="slider" label="Mental fatigue" name="mentalFatigue" v={c.mentalFatigue} set={p('mentalFatigue')} lo="sharp" hi="drained" />
        <Scale as="buttons" label="Motivation" name="motivation" v={c.motivation} set={p('motivation')} lo="low" hi="high" />
        <Scale as="buttons" label="Overall readiness" name="readiness" v={c.readiness} set={p('readiness')} lo="poor" hi="excellent" />
      </Sec>

      <Sec title="Body">
        <Scale as="buttons" label="Joint discomfort" name="jointDiscomfort" v={c.jointDiscomfort} set={p('jointDiscomfort')} lo="none" hi="a lot" />
        <Scale as="buttons" label="Joint pain" name="jointPain" v={c.jointPain} set={p('jointPain')} lo="none" hi="sharp / severe" />
        <div className="ci-field ci-toggle">
          <label className="chk"><input type="checkbox" className="switch" checked={c.unwell} onChange={e => setC({ ...c, unwell: e.target.checked })} />Feeling ill or unwell</label>
        </div>
        {caution && <p className="err ci-wide" role="alert">Don’t push through concerning pain or illness. Consider a lighter session, swapping exercises, or resting. If pain is persistent or sharp, get it checked by a qualified professional. This app can’t diagnose injuries.</p>}
      </Sec>

      <Sec title="Hydration">
        <Scale as="slider" label="Hydration today" name="hydration" v={c.hydration} set={p('hydration')} lo="dry" hi="well hydrated" />
        <label className="ci-field">Water so far (litres, optional)<input type="number" min={0} step={0.1} value={c.waterL ?? ''} onChange={e => setC({ ...c, waterL: e.target.value === '' ? undefined : num(e.target.value, 0) })} /></label>
        <label className="ci-field ci-wide">Notes<input type="text" value={c.notes ?? ''} onChange={e => setC({ ...c, notes: e.target.value })} /></label>
      </Sec>

      <div className="row">
        <button className="btn" onClick={go}>{submitLabel}</button>
        {showSkip && <button className="btn ghost" onClick={() => onDone(undefined)}>Skip check-in</button>}
      </div>
    </div>
  );
}
