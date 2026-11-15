import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, todayISO } from '../../core/calendar/dates.ts';
import { mesoEnd, inRange, type Range } from '../../core/analytics/analytics.ts';
import type { Data } from './shared.ts';
import Training from './Training.tsx';
import Muscles from './Muscles.tsx';
import Blocks from './Blocks.tsx';
import Recovery from './Recovery.tsx';
import NutritionStats from './NutritionStats.tsx';

const TABS = ['Training', 'Muscles', 'Blocks', 'Recovery', 'Nutrition'] as const;
export default function Analytics() {
  const today = todayISO();
  const [tab, setTab] = useState<typeof TABS[number]>('Training');
  const [key, setKey] = useState('w8');
  const [cf, setCf] = useState(addDays(today, -56)); const [ct, setCt] = useState(today);
  const workouts = useLiveQuery(() => db.completed.toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const muscles = useLiveQuery(() => db.muscles.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const mesos = useLiveQuery(() => db.mesocycles.toArray(), []);
  const scheduled = useLiveQuery(() => db.scheduled.toArray(), []);
  const checkins = useLiveQuery(() => db.checkins.toArray(), []);
  const feedback = useLiveQuery(() => db.feedback.toArray(), []);
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const phases = useLiveQuery(() => db.phases.toArray(), []);
  if (!workouts || !exercises || !muscles || !settings || !mesos || !scheduled || !checkins || !feedback || !foods || !weights || !phases) return null;

  const m = key.startsWith('m:') ? mesos.find(x => x.id === key.slice(2)) : undefined;
  const range: Range = key === 'all' ? { from: '1900-01-01', to: '2999-12-31' } : key === 'custom' ? { from: cf, to: ct } : m ? { from: m.startDate, to: mesoEnd(m) }
    : { from: addDays(today, -7 * Number(key.slice(1))), to: today };
  const data: Data = { workouts, exercises, muscles, settings, mesos, scheduled, checkins, feedback, foods, weights, phases };
  const inR = { ...data, workouts: workouts.filter(w => inRange(w.date, range)), checkins: checkins.filter(c => inRange(c.date, range)), foods: foods.filter(f => inRange(f.date, range)), weights: weights.filter(w => inRange(w.date, range)) };

  return (
    <>
      <div className="tabs">{TABS.map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab !== 'Blocks' && <div className="card"><div className="row" style={{ margin: 0 }}>
        <label>Period<select value={key} onChange={e => setKey(e.target.value)}>
          <option value="w4">Last 4 weeks</option><option value="w8">Last 8 weeks</option><option value="w12">Last 12 weeks</option><option value="all">All time</option><option value="custom">Custom range</option>
          {mesos.map(x => <option key={x.id} value={`m:${x.id}`}>Mesocycle: {x.name}</option>)}</select></label>
        {key === 'custom' && <><label>From<input type="date" value={cf} onChange={e => setCf(e.target.value)} /></label><label>To<input type="date" value={ct} onChange={e => setCt(e.target.value)} /></label></>}
        <span className="muted">{inR.workouts.length} completed workout{inR.workouts.length === 1 ? '' : 's'} in range</span></div></div>}
      {tab === 'Training' && <Training d={inR} all={data} />}
      {tab === 'Muscles' && <Muscles d={inR} range={range} />}
      {tab === 'Blocks' && <Blocks d={data} />}
      {tab === 'Recovery' && <Recovery d={inR} />}
      {tab === 'Nutrition' && <NutritionStats d={inR} range={range} />}
    </>
  );
}
