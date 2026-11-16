import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, isValidISODate, todayISO } from '../../core/calendar/dates.ts';
import Today from './Today.tsx';
import WeekView from './WeekView.tsx';
import Phases from './Phases.tsx';
import Supplements from './Supplements.tsx';
import Weight from './Weight.tsx';
import MealPlan from './MealPlan.tsx';
import Recipes from './Recipes.tsx';

const TABS = ['Today', 'Meals', 'Recipes', 'Week', 'Phases', 'Supplements', 'Weight'] as const;
export default function Nutrition() {
  const [tab, setTab] = useState<typeof TABS[number]>('Today');
  const [date, setDate] = useState(todayISO());
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const unit = settings?.unit ?? 'kg';
  const dated = tab === 'Today' || tab === 'Week' || tab === 'Supplements';
  return (
    <>
      <div className="card nutrition-hub">
        <h2>Nutrition workspace</h2>
        <p className="muted">Separate areas for tracking intake, planning targets and monitoring body metrics.</p>
        <div className="nutrition-group"><div className="ci-sec">Daily intake</div><div className="tabs">{TABS.slice(0, 3).map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t === 'Today' ? 'Daily log' : t === 'Meals' ? 'Meal schedule' : t}</button>)}</div></div>
        <div className="nutrition-group"><div className="ci-sec">Progress &amp; targets</div><div className="tabs">{TABS.slice(3, 5).map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div></div>
        <div className="nutrition-group"><div className="ci-sec">Body metrics</div><div className="tabs">{TABS.slice(5).map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div></div>
      </div>
      {dated && <div className="row"><button className="btn ghost sm" aria-label="Previous day" onClick={() => setDate(addDays(date, tab === 'Week' ? -7 : -1))}>←</button>
        <input type="date" value={date} onChange={e => isValidISODate(e.target.value) && setDate(e.target.value)} />
        <button className="btn ghost sm" aria-label="Next day" onClick={() => setDate(addDays(date, tab === 'Week' ? 7 : 1))}>→</button>
        <button className="btn ghost sm" onClick={() => setDate(todayISO())}>Today</button></div>}
      {tab === 'Today' && <Today date={date} />}
      {tab === 'Meals' && <MealPlan />}
      {tab === 'Recipes' && <Recipes />}
      {tab === 'Week' && <WeekView date={date} />}
      {tab === 'Phases' && <Phases unit={unit} />}
      {tab === 'Supplements' && <Supplements date={date} />}
      {tab === 'Weight' && <Weight unit={unit} />}
    </>
  );
}
