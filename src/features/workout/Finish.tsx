import { useState } from 'react';
import { db, newId } from '../../db/db.ts';
import { findPRs, summarize, toCompleted } from '../../core/workout/stats.ts';
import type { CompletedWorkout, PostWorkoutFeedback, WeightUnit, WorkoutDraft } from '../../core/types/index.ts';

const S = ({ label, v, set }: { label: string; v: number; set: (n: number) => void }) => (
  <label className="slider">{label}: <strong>{v}</strong><input type="range" min={1} max={5} value={v} onChange={e => set(Number(e.target.value))} /></label>);

export default function Finish({ d, history, unit, onSaved, onBack }: { d: WorkoutDraft; history: CompletedWorkout[]; unit: WeightUnit; onSaved: () => void; onBack: () => void }) {
  const [wid] = useState(newId());
  const [f, setF] = useState<PostWorkoutFeedback>({ id: newId(), workoutId: wid, pump: 3, soreness: 2, workload: 3, fatigue: 2, performance: 'met', difficulty: 'appropriate', createdAt: Date.now() });
  const [busy, setBusy] = useState(false);
  const done = toCompleted(d, wid, Date.now(), unit);
  const sum = summarize(done), prs = findPRs(history, done);

  const save = async () => {
    setBusy(true);
    const w = toCompleted(d, wid, Date.now(), unit);
    await db.transaction('rw', db.completed, db.feedback, db.scheduled, db.drafts, async () => {
      await db.completed.put(w); await db.feedback.put(f);
      if (d.scheduledId) await db.scheduled.update(d.scheduledId, { status: 'completed' });
      await db.drafts.delete('current');
    });
    onSaved();
  };
  return (
    <div className="card">
      <h2>Workout summary</h2>
      <p>{sum.exercises} exercises · {sum.sets} working sets · {sum.reps} reps · {Math.round(sum.volume).toLocaleString()} {unit} total volume</p>
      {prs.length > 0 && <div><h3>Personal records</h3>{prs.map((p, i) => <div key={i}><span className="chip">PR</span> {p.exerciseName}: {p.type === 'weight' ? 'heaviest weight' : 'estimated 1RM'} {p.value} {unit}</div>)}</div>}
      <h3>How did it go?</h3>
      <S label="Muscle pump" v={f.pump} set={n => setF({ ...f, pump: n })} />
      <S label="Soreness" v={f.soreness} set={n => setF({ ...f, soreness: n })} />
      <S label="Perceived workload" v={f.workload} set={n => setF({ ...f, workload: n })} />
      <S label="General fatigue" v={f.fatigue} set={n => setF({ ...f, fatigue: n })} />
      <div className="row">
        <label>Performance vs expectations<select value={f.performance} onChange={e => setF({ ...f, performance: e.target.value as PostWorkoutFeedback['performance'] })}><option value="below">Below</option><option value="met">Met</option><option value="exceeded">Exceeded</option></select></label>
        <label>Felt<select value={f.difficulty} onChange={e => setF({ ...f, difficulty: e.target.value as PostWorkoutFeedback['difficulty'] })}><option value="easy">Too easy</option><option value="appropriate">Appropriate</option><option value="hard">Too hard</option></select></label>
      </div>
      <label>Notes<input type="text" value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
      <p className="muted">Unlogged sets are not saved. Saving stores a permanent record that later template edits cannot change.</p>
      <div className="row"><button className="btn" disabled={busy} onClick={save}>Save workout</button><button className="btn ghost" onClick={onBack}>Back to logging</button></div>
    </div>
  );
}
