import { useEffect, useMemo, useState } from 'react';
import { FINDINGS } from '../../research/findings.ts';
import type { ExperienceLevel } from '../../core/types/index.ts';

interface Page { p: number; t: string }
export default function Research({ level }: { level: ExperienceLevel }) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [q, setQ] = useState('');
  const [lv, setLv] = useState<ExperienceLevel | 'all'>(level);
  useEffect(() => { import('../../research/pages.json').then(m => setPages(m.default as Page[])); }, []);

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!pages || n.length < 3) return [];
    const out: { p: number; snip: string }[] = [];
    for (const pg of pages) { const i = pg.t.toLowerCase().indexOf(n); if (i >= 0) out.push({ p: pg.p, snip: `${i > 60 ? '…' : ''}${pg.t.slice(Math.max(0, i - 60), i + 140)}…` }); if (out.length >= 25) break; }
    return out;
  }, [pages, q]);
  const shown = FINDINGS.filter(f => lv === 'all' || f.levels.includes(lv));
  const topics = [...new Set(shown.map(f => f.topic))];

  return (
    <>
      <div className="card"><h2>Research library</h2>
        <p className="muted">Built from your own notes in Research.pdf ({pages ? `${pages.length} pages indexed` : 'loading…'}). Findings below are short paraphrases with the PDF page they came from. Recommendations cite these; if nothing relevant exists, none is shown. These are notes on studies with their own limitations, so treat them as guidance, not certainty.</p>
        <label>Search the document<input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. rest, volume, RIR" /></label>
        {q.trim().length >= 3 && <p className="muted">{hits.length} page{hits.length === 1 ? '' : 's'} match{hits.length >= 25 ? ' (first 25)' : ''}.</p>}
        {hits.map(h => <div key={h.p} className="item col"><strong>Page {h.p}</strong><span className="muted sm2">{h.snip}</span></div>)}
      </div>
      <div className="card"><h2>Findings used by recommendations</h2>
        <label>Show for level<select value={lv} onChange={e => setLv(e.target.value as ExperienceLevel | 'all')}><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        {topics.map(t => <div key={t}><h3>{t}</h3>{shown.filter(f => f.topic === t).map(f => (
          <div key={f.id} className="item col"><span>{f.text}</span><span className="muted sm2">{f.source}, p. {f.page} · levels: {f.levels.join(', ')}</span>{f.caveat && <span className="muted sm2">Caveat: {f.caveat}</span>}</div>))}</div>)}
        <p className="muted sm2">Heuristics such as “add reps before load” come from general coaching practice, not from these findings, and are labelled that way in the app.</p>
      </div>
    </>
  );
}
