import type { CompletedSet, PreWorkoutCheckIn, WorkoutDraft } from '../../core/types/index.ts';

type Prev = Record<string, { date: string; sets: CompletedSet[] } | null>;

/** Simple general heuristic, not research-backed. The full recommendation engine arrives in Phase 4. */
function hint(prev: Prev[string], rMax: number, rir: number, c?: PreWorkoutCheckIn): string {
  if (!prev) return `No previous record. Pick a load that leaves about ${rir} reps in reserve.`;
  const top = prev.sets.every(s => s.reps >= rMax);
  const low = !!c && (c.readiness <= 2 || c.sleepQuality <= 2 || c.jointPain >= 3 || c.unwell || c.fatigue >= 4);
  if (top) return low ? 'You reached the top of your rep range last time, but readiness looks lower today. Consider repeating the same load.' : 'You reached the top of your rep range on every set last time. Consider increasing the weight.';
  return low ? 'Readiness looks lower today. Matching last time is a fine target.' : 'Try to match or beat last time’s reps at the same weight, staying inside your rep range.';
}

export default function Feed({ d, prev, unit, onStart, onBack }: { d: WorkoutDraft; prev: Prev; unit: string; onStart: () => void; onBack: () => void }) {
  return (
    <div className="card">
      <h2>{d.templateName} · pre-workout feed</h2>
      {d.checkin ? <p className="muted">Check-in: sleep {d.checkin.sleepHours} h, readiness {d.checkin.readiness}/5, fatigue {d.checkin.fatigue}/5.</p> : <p className="muted">Check-in skipped.</p>}
      {d.exercises.map(e => { const p = prev[e.exerciseId]; return (
        <div key={e.id} className="item col">
          <strong>{e.name}</strong>
          <span>{e.prescribed.sets} × {e.prescribed.repMin}–{e.prescribed.repMax} <span className="chip">RIR {e.prescribed.rir}</span></span>
          <span className="muted">Last time: {p ? `${p.sets.map(s => `${s.weight}${unit}×${s.reps}`).join(', ')} (${p.date})` : 'none'}</span>
          <span className="sm2">{hint(p, e.prescribed.repMax, e.prescribed.rir, d.checkin)} <em className="muted">General heuristic, not from your research notes.</em></span>
        </div>); })}
      <div className="row"><button className="btn" onClick={onStart}>Start logging</button><button className="btn ghost" onClick={onBack}>Back</button></div>
    </div>
  );
}
