import { updateSettings } from '../../db/db.ts';
import type { ExperienceLevel, Strategy, UserSettings } from '../../core/types/index.ts';
import { STRATEGY_LABEL, allowedStrategies } from '../../core/progression/strategies.ts';

const LEVEL_HELP: Record<ExperienceLevel, string> = {
  beginner: 'Simple progressive overload and stable programmes. Volume periodisation is not offered.',
  intermediate: 'Adds volume progression, planned RIR progression and deloads as options.',
  advanced: 'All options, including custom progression rules and muscle-specific volume emphasis.'
};

export default function Settings({ settings: s }: { settings: UserSettings }) {
  const allowed = allowedStrategies(s.experience);
  const strat = allowed.includes(s.defaultStrategy ?? 'double') ? (s.defaultStrategy ?? 'double') : 'double';
  return (
    <>
      <div className="card">
        <h2>Training profile</h2>
        <div className="row">
          <label>Experience level
            <select value={s.experience} onChange={e => { const lv = e.target.value as ExperienceLevel; updateSettings({ experience: lv, ...(allowedStrategies(lv).includes(s.defaultStrategy ?? 'double') ? {} : { defaultStrategy: 'double' as Strategy }) }); }}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
          <label>Weight unit
            <select value={s.unit} onChange={e => updateSettings({ unit: e.target.value as 'kg' | 'lb' })}>
              <option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option>
            </select>
          </label>
        </div>
        <p className="muted">{LEVEL_HELP[s.experience]}</p>
        <label>Default progression for new blocks<select value={strat} onChange={e => updateSettings({ defaultStrategy: e.target.value as Strategy })}>{allowed.map(k => <option key={k} value={k}>{STRATEGY_LABEL[k]}</option>)}</select></label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={s.recommendationsEnabled} onChange={e => updateSettings({ recommendationsEnabled: e.target.checked })} />
          Show progression recommendations
        </label>
      </div>
      <div className="card">
        <h2>Appearance</h2>
        <div className="row">
          <label>Theme
            <select value={s.theme} onChange={e => updateSettings({ theme: e.target.value as 'light' | 'dark' })}>
              <option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <label>Accent<input type="color" value={s.accent} onChange={e => updateSettings({ accent: e.target.value })} /></label>
          <label>Secondary<input type="color" value={s.secondary} onChange={e => updateSettings({ secondary: e.target.value })} /></label>
          <label>Surface<input type="color" value={s.surface} onChange={e => updateSettings({ surface: e.target.value })} /></label>
          <label>Background<input type="color" value={s.background} onChange={e => updateSettings({ background: e.target.value })} /></label>
        </div>
        <button className="btn ghost" onClick={() => updateSettings({ accent: '#DD403A', secondary: '#F4D35E', surface: '#3E363F', background: '#F6FFF8' })}>Reset colours</button>
      </div>
      <div className="card">
        <h2>Data</h2>
        <p className="muted">Import / export and research documents arrive in later phases. All data is stored locally on this device.</p>
      </div>
    </>
  );
}
