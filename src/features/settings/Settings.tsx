import { updateSettings, db } from '../../db/db.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ExperienceLevel, Strategy, UserSettings } from '../../core/types/index.ts';
import DataPanel from './DataPanel.tsx';
import { STRATEGY_LABEL, allowedStrategies } from '../../core/progression/strategies.ts';

const LEVEL_HELP: Record<ExperienceLevel, string> = {
  beginner: 'Simple progressive overload and stable programmes. Volume periodisation is not offered.',
  intermediate: 'Adds volume progression, planned RIR progression and deloads as options.',
  advanced: 'All options, including custom progression rules and muscle-specific volume emphasis.'
};

export default function Settings({ settings: s }: { settings: UserSettings }) {
  const muscles = useLiveQuery(() => db.muscles.filter(m => !m.archived).toArray(), []) ?? [];
  const setVolumePreference = (muscleId: string, field: 'min' | 'max', raw: string) => {
    const all = { ...(s.muscleVolumePreferences ?? {}) };
    const next = { ...(all[muscleId] ?? {}) };
    if (raw === '') delete next[field]; else { const value = Number(raw); if (!Number.isInteger(value) || value < 0 || value > 40) return; next[field] = value; }
    if (next.min === undefined && next.max === undefined) delete all[muscleId]; else all[muscleId] = next;
    void updateSettings({ muscleVolumePreferences: all });
  };
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
        <h2>Muscle volume preferences</h2>
        <p className="muted sm2">Set a preferred weekly range of weighted sets for each muscle. The minimum is your lower reference point; the maximum is an upper guardrail, not a target the programme must reach. The lower bound is the starting reference; only increase volume when performance and recovery support it. The upper bound is a ceiling, not a target to chase. These preferences guide progression recommendations using completed work, remaining scheduled sessions and the current workout's planned sets. Extra sets are allocated only to muscles below their minimum, and only when recovery and performance allow.</p>
        <div className="item col" style={{ gap: 8 }}>
          <div className="row" style={{ margin: 0, fontWeight: 600 }}><span style={{ flex: 1 }}>Muscle</span><span style={{ width: 100 }}>Min / week</span><span style={{ width: 100 }}>Max / week</span></div>
          {muscles.map(m => { const pref = s.muscleVolumePreferences?.[m.id]; const invalid = pref?.min !== undefined && pref?.max !== undefined && pref.min > pref.max; return (
            <div key={m.id} className="row" style={{ margin: 0, alignItems: 'center' }}><span style={{ flex: 1 }}>{m.name}</span>
              <input aria-label={`${m.name} minimum weekly sets`} type="number" min={0} max={40} step={1} placeholder="—" style={{ width: 100 }} value={pref?.min ?? ''} onChange={e => setVolumePreference(m.id, 'min', e.target.value)} />
              <div style={{ width: 100 }}><input aria-label={`${m.name} maximum weekly sets`} type="number" min={0} max={40} step={1} placeholder="—" style={{ width: '100%' }} value={pref?.max ?? ''} onChange={e => setVolumePreference(m.id, 'max', e.target.value)} />{invalid && <span className="err sm2">Max must be at least min.</span>}</div>
            </div>
          ); })}
        </div>
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
      <DataPanel />
    </>
  );
}
