import { useState } from 'react';
import { updateSettings } from '../../db/db.ts';
import type { ExperienceLevel, WeightUnit } from '../../core/types/index.ts';

const LV: [ExperienceLevel, string, string][] = [
  ['beginner', 'Beginner', 'Under about a year of consistent lifting. You get simple progressive overload and stable programmes.'],
  ['intermediate', 'Intermediate', 'Roughly 1–3 years. Adds volume progression, planned RIR and deloads as options.'],
  ['advanced', 'Advanced', 'Several years of structured training. All options, including custom progression.']
];
export default function Setup() {
  const [lv, setLv] = useState<ExperienceLevel>('beginner');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  return (
    <main style={{ margin: '0 auto', maxWidth: 560 }}>
      <div className="card"><h2>Welcome</h2><p className="muted">Two quick choices. You can change both later in Settings. Your data stays on this device.</p>
        <h3>Training experience</h3>
        {LV.map(([k, l, d]) => <label key={k} className="chk" style={{ alignItems: 'flex-start', minHeight: 48 }}><input type="radio" name="lv" checked={lv === k} onChange={() => setLv(k)} /><span><strong>{l}</strong><br /><span className="muted sm2">{d}</span></span></label>)}
        <h3>Weight unit</h3>
        <div className="row"><label className="chk"><input type="radio" name="u" checked={unit === 'kg'} onChange={() => setUnit('kg')} />Kilograms</label><label className="chk"><input type="radio" name="u" checked={unit === 'lb'} onChange={() => setUnit('lb')} />Pounds</label></div>
        <button className="btn" onClick={() => updateSettings({ experience: lv, unit, setupComplete: true })}>Continue</button></div>
    </main>
  );
}
