import { fromDayNumber } from '../core/calendar/dates.ts';

export interface Series { name: string; color: string; points: { x: number; y: number }[]; dots?: boolean }
/** Small dependency-free SVG line chart. x values are day numbers. */
export default function LineChart({ series, height = 180, unit = '' }: { series: Series[]; height?: number; unit?: string }) {
  const pts = series.flatMap(s => s.points);
  if (pts.length < 2) return <p className="muted">Not enough data to chart yet.</p>;
  const W = 600, pad = 34;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const ySpan = y1 - y0 || 1, xSpan = x1 - x0 || 1;
  const X = (x: number) => pad + ((x - x0) / xSpan) * (W - pad * 1.5);
  const Y = (y: number) => height - pad / 1.4 - ((y - y0) / ySpan) * (height - pad * 1.6);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={series.map(s => s.name).join(', ')}>
        <text x={4} y={Y(y1) + 4} fontSize="11" fill="currentColor">{y1.toFixed(1)}</text>
        <text x={4} y={Y(y0) + 4} fontSize="11" fill="currentColor">{y0.toFixed(1)}</text>
        <text x={pad} y={height - 4} fontSize="11" fill="currentColor">{fromDayNumber(x0).slice(5)}</text>
        <text x={W - 40} y={height - 4} fontSize="11" fill="currentColor">{fromDayNumber(x1).slice(5)}</text>
        {series.map(s => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth={s.dots ? 1 : 2.5} strokeOpacity={s.dots ? 0.5 : 1} points={s.points.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')} />
            {s.dots && s.points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={3} fill={s.color} />)}
          </g>))}
      </svg>
      <div className="muted sm2">{series.map(s => <span key={s.name} style={{ marginRight: 12 }}><span style={{ color: s.color }}>●</span> {s.name}</span>)}{unit}</div>
    </div>
  );
}
