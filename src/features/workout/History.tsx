import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { summarize } from '../../core/workout/stats.ts';

export default function History() {
  const list = useLiveQuery(() => db.completed.orderBy('finishedAt').reverse().toArray(), []) ?? [];
  if (list.length === 0) return <div className="card"><h2>History</h2><p className="muted">No completed workouts yet.</p></div>;
  return (
    <div className="card"><h2>History</h2>
      {list.map(w => { const s = summarize(w); return (
        <details key={w.id} className="item col"><summary><strong>{w.date} · {w.templateName}</strong> <span className="muted">{s.sets} sets · {Math.round(s.volume).toLocaleString()} {w.unit}</span></summary>
          {w.exercises.map(e => <div key={e.id} style={{ marginTop: 8 }}><strong>{e.exerciseName}</strong><div className="muted">{e.sets.map(x => `${x.kind === 'working' ? '' : x.kind + ' '}${x.weight}×${x.reps}${x.rir !== undefined ? ` @${x.rir}` : ''}`).join(' · ')}</div></div>)}
          <div className="row"><button className="btn ghost sm" onClick={async () => { if (!confirm('Delete this saved workout? This cannot be undone.')) return;
            await db.transaction('rw', db.completed, db.feedback, db.scheduled, async () => { await db.completed.delete(w.id); await db.feedback.where('workoutId').equals(w.id).delete(); if (w.scheduledId) await db.scheduled.update(w.scheduledId, { status: 'scheduled' }); }); }}>Delete workout</button></div>
        </details>); })}
    </div>
  );
}
