import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db.ts';
import { addDays, todayISO } from '../../core/calendar/dates.ts';
import { assessReadiness, latestFor } from '../../core/progression/readiness.ts';
import CheckIn from './CheckIn.tsx';

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export default function Daily() {
  const today = todayISO();
  const [editing, setEditing] = useState(false);
  // 15 days so the oldest visible day can still see its "yesterday".
  const all = useLiveQuery(() => db.checkins.where('date').between(addDays(today, -15), today, true, true).toArray(), [today]);
  if (!all) return null;

  const rows = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, -i);
    const c = latestFor(all, date);
    return { date, c, r: c ? assessReadiness(c, latestFor(all, addDays(date, -1))) : null };
  });
  const mine = latestFor(all, today);
  const week = rows.slice(0, 7).flatMap(x => (x.c ? [x.c] : []));
  const sleep = avg(week.map(c => c.sleepHours));
  const sq = avg(week.map(c => c.sleepQuality));
  const rd = avg(week.map(c => c.readiness));

  return (
    <>
      {!mine || editing
        ? <CheckIn key={mine?.id ?? 'new'} date={today} initial={mine} title="Daily check-in" submitLabel="Save" showSkip={false} onDone={() => setEditing(false)} />
        : <div className="card"><h2>Today’s check-in</h2>
            <p>Slept {mine.sleepHours} h (quality {mine.sleepQuality}/5) · fatigue {mine.fatigue} · soreness {mine.soreness} · readiness {mine.readiness}</p>
            <div className="row"><button className="btn ghost sm" onClick={() => setEditing(true)}>Edit</button></div></div>}

      <div className="stats">
        <div className="stat"><div className="stat-l">Avg sleep (7 d)</div><div className="stat-v">{sleep === null ? '—' : sleep.toFixed(1)} h</div><div className="stat-s">{week.length} check-ins</div></div>
        <div className="stat"><div className="stat-l">Sleep quality</div><div className="stat-v">{sq === null ? '—' : sq.toFixed(1)}/5</div></div>
        <div className="stat"><div className="stat-l">Self-rated readiness</div><div className="stat-v">{rd === null ? '—' : rd.toFixed(1)}/5</div></div>
      </div>

      <div className="card"><h2>Last 14 days</h2>
        <div className="gridwrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Sleep h</th><th>Sleep q</th><th>Fatigue</th><th>Sore</th><th>Stress</th><th>Ready</th><th>Level</th></tr></thead>
          <tbody>{rows.map(({ date, c, r }) => (
            <tr key={date}><td>{date}</td>
              {c && r
                ? <><td>{c.sleepHours}</td><td>{c.sleepQuality}</td><td>{c.fatigue}</td><td>{c.soreness}</td><td>{c.stress}</td><td>{c.readiness}</td>
                    <td><span className={`rpe ${r.level === 'low' || r.level === 'caution' ? 'hi' : r.level === 'good' ? 'lo' : ''}`}>{r.level}</span></td></>
                : <td colSpan={7} className="muted">no check-in</td>}</tr>))}</tbody>
        </table></div>
      </div>
    </>
  );
}
