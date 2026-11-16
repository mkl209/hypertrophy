import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { addDays, todayISO } from '../../core/calendar/dates.ts';
import { previousSets } from '../../core/workout/stats.ts';
import { latestFor } from '../../core/progression/readiness.ts';
import type { ScheduledWorkout, WorkoutDraft } from '../../core/types/index.ts';
import type { Rec } from '../../core/progression/engine.ts';
import CheckIn from './CheckIn.tsx';
import Daily from './Daily.tsx';
import Feed from './Feed.tsx';
import Logger from './Logger.tsx';
import Finish from './Finish.tsx';
import History from './History.tsx';
import Run from './Run.tsx';

export default function Workout() {
  const today = todayISO();
  const [tab, setTab] = useState<'Train' | 'Run' | 'Daily' | 'History'>('Train');
  const [draft, setDraft] = useState<WorkoutDraft | null | undefined>(undefined);
  const [msg, setMsg] = useState('');
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const history = useLiveQuery(() => db.completed.toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.filter(t => !t.archived).toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.filter(e => !e.archived).sortBy('name'), []) ?? [];
  const due = useLiveQuery(() => db.scheduled.where('date').between(addDays(today, -14), addDays(today, 7), true, true).filter(w => w.status === 'scheduled').toArray(), [today]) ?? [];
  const todayRows = useLiveQuery(() => db.checkins.where('date').equals(today).toArray(), [today]);
  const todayCheckin = todayRows ? latestFor(todayRows, today) : undefined;

  useEffect(() => { db.drafts.get('current').then(d => {
    if (!d) { setDraft(null); return; }
    // Migrate an in-progress draft from older set categories: failure becomes working at 0 RIR; drop becomes working.
    const migrated = { ...d, exercises: d.exercises.map(e => ({ ...e, list: e.list.map(s => {
      const legacyKind = (s as { kind: string }).kind;
      return { ...s, kind: legacyKind === 'warmup' ? 'warmup' as const : 'working' as const, rir: legacyKind === 'failure' && !s.rir ? '0' : s.rir, technique: s.technique };
    }) })) };
    setDraft(migrated);
  }); }, []);
  useEffect(() => { if (draft === undefined) return; if (draft) void db.drafts.put(draft); }, [draft]);
  const update = (f: (d: WorkoutDraft) => WorkoutDraft) => setDraft(p => (p ? f(p) : p));
  if (draft === undefined || !settings) return null;
  const unit = settings.unit;
  const prev = Object.fromEntries(exercises.map(e => [e.id, previousSets(history, e.id)]));
  const prevFor = (id: string) => previousSets(history, id);

  const start = async (templateId: string, sw?: ScheduledWorkout) => {
    const t = await db.templates.get(templateId); if (!t) return;
    const d: WorkoutDraft = {
      id: 'current', scheduledId: sw?.id, mesocycleId: sw?.mesocycleId, templateId, templateName: t.name, date: sw?.date ?? today, startedAt: Date.now(),
      // Reuse today's daily check-in if there is one, otherwise ask for it.
      checkin: todayCheckin, stage: todayCheckin ? 'feed' : 'checkin',
      exercises: t.exercises.map(te => {
        const p = prevFor(te.exerciseId)?.sets ?? [];
        return { id: newId(), exerciseId: te.exerciseId, name: te.exerciseName, restSec: te.restSec, notes: te.notes, prescribed: { sets: te.sets, repMin: te.repMin, repMax: te.repMax, rir: te.rir },
          list: Array.from({ length: te.sets }, (_, i) => { const q = p[i] ?? p[p.length - 1]; return { id: newId(), kind: 'working' as const, weight: q ? String(q.weight) : '', reps: q ? String(q.reps) : '', rir: '', done: false }; }) };
      })
    };
    setMsg(''); setDraft(d);
  };
  const applyRec = (exId: string, rec: Rec) => update(d => ({ ...d, exercises: d.exercises.map(e => e.id !== exId ? e : { ...e, prescribed: { ...e.prescribed, sets: rec.sets },
    list: Array.from({ length: rec.sets }, (_, i) => { const old = e.list[i]; const t = rec.targets[i]; return { id: old?.id ?? newId(), kind: 'working' as const, weight: t && t.weight !== null ? String(t.weight) : old?.weight ?? '', reps: t ? String(t.repMin) : old?.reps ?? '', rir: '', done: false }; }) }) }));
  const discard = async () => { if (confirm('Discard this workout in progress?')) { await db.drafts.delete('current'); setDraft(null); } };
  const tname = (id: string) => templates.find(t => t.id === id)?.name ?? 'Workout';

  if (draft) return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}><strong>{draft.templateName} · {draft.date}</strong><button className="btn ghost sm" onClick={discard}>Discard</button></div>
      {draft.stage === 'checkin' && <CheckIn date={today} scheduledId={draft.scheduledId} onDone={c => update(d => ({ ...d, checkin: c, stage: 'feed' }))} />}
      {draft.stage === 'feed' && <Feed d={draft} history={history} exercises={exercises} settings={settings} level={settings.experience} enabled={settings.recommendationsEnabled} defaultStrategy={settings.defaultStrategy ?? 'double'} unit={unit} onApply={applyRec} onStart={() => update(d => ({ ...d, stage: 'log' }))} onBack={() => update(d => ({ ...d, stage: 'checkin' }))} />}
      {draft.stage === 'log' && <Logger d={draft} setD={update} prev={prev} exercises={exercises} unit={unit} onFinish={() => update(d => ({ ...d, stage: 'finish' }))} />}
      {draft.stage === 'finish' && <Finish d={draft} history={history} unit={unit} onBack={() => update(d => ({ ...d, stage: 'log' }))} onSaved={() => { setDraft(null); setMsg('Workout saved.'); setTab('History'); }} />}
    </>
  );
  return (
    <>
      <div className="tabs">{(['Train', 'Run', 'Daily', 'History'] as const).map(t => <button key={t} aria-current={t === tab ? 'page' : undefined} onClick={() => setTab(t)}>{t}</button>)}</div>
      {msg && <p role="status" className="chip" style={{ display: 'inline-block' }}>{msg}</p>}
      {tab === 'Run' ? <Run /> : tab === 'History' ? <History /> : tab === 'Daily' ? <Daily /> : (
        <div className="card"><h2>Start a workout</h2>
          <p className="muted sm2">{todayCheckin ? 'Today’s check-in is done and will be used.' : 'No check-in yet today. You’ll be asked when you start, or fill it in on the Daily tab.'}</p>
          {[...due].sort((a, b) => a.date.localeCompare(b.date)).map(w => (
            <div key={w.id} className="item"><div><strong>{tname(w.templateId)}</strong><div className="muted">{w.date === today ? 'Today' : w.date < today ? `Overdue · ${w.date}` : w.date}</div></div>
              <button className="btn" onClick={() => start(w.templateId, w)}>Start</button></div>))}
          {due.length === 0 && <p className="muted">Nothing scheduled in the next week or overdue.</p>}
          <label>Unscheduled workout<select value="" onChange={e => e.target.value && start(e.target.value)}><option value="">Choose a template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>)}
    </>
  );
}
