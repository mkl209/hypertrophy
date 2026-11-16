import { useState } from 'react';
import { lookupBarcode, searchFoods, type FoodSearchResult } from '../../core/nutrition/openFoodFacts.ts';

export interface SelectedFood { food: FoodSearchResult; grams: number; mealId?: string }
export default function FoodSearch({ onAdd, mealId, onMealChange, meals }: { onAdd: (food: SelectedFood) => Promise<void>; mealId: string; onMealChange: (id: string) => void; meals: { id: string; name: string }[] }) {
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const search = async () => {
    setBusy(true); setError(''); setMessage(''); setSelected(null);
    try { const found = await searchFoods(query); setResults(found); if (!found.length) setMessage('No matching foods with usable nutrition data. Try a brand or a more specific product name.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Food search failed.'); }
    finally { setBusy(false); }
  };
  const scan = async () => {
    setBusy(true); setError(''); setMessage('');
    try { const found = await lookupBarcode(barcode); setResults([found]); setSelected(found); }
    catch (e) { setError(e instanceof Error ? e.message : 'Barcode lookup failed.'); }
    finally { setBusy(false); }
  };
  const add = async () => {
    const amount = Number(grams);
    if (!selected || !Number.isFinite(amount) || amount <= 0 || amount > 5000) return setError('Enter a serving between 1 and 5000 grams.');
    setBusy(true); setError('');
    try { await onAdd({ food: selected, grams: amount, mealId: mealId || undefined }); setMessage(`Added ${amount} g of ${selected.name}.`); setSelected(null); setGrams('100'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add food.'); }
    finally { setBusy(false); }
  };
  const per = (v: number) => `${(v * Number(grams || 0) / 100).toFixed(1)}`;
  return <div className="card">
    <h2>Find food · Open Food Facts</h2>
    <p className="muted sm2">Search products or enter a barcode. Values are per 100 g from product labels; database entries can be incomplete or user-submitted, so check the package when accuracy matters.</p>
    <div className="row"><label style={{ flex: 1 }}>Food or product<input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search(); }} placeholder="e.g. Tesco Greek yoghurt" /></label><button className="btn" disabled={busy || query.trim().length < 2} onClick={() => void search()}>{busy ? 'Searching…' : 'Search'}</button></div>
    <div className="row"><label style={{ flex: 1 }}>Barcode<input inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="8–14 digit barcode" /></label><button className="btn ghost" disabled={busy || !barcode.trim()} onClick={() => void scan()}>Look up barcode</button></div>
    {error && <p role="alert" className="err">{error}</p>}{message && <p className="muted sm2">{message}</p>}
    {results.length > 0 && <div className="col" style={{ gap: 8 }}>{results.map(r => <button type="button" key={r.code} className={`item ${selected?.code === r.code ? 'selected' : ''}`} style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => { setSelected(r); setError(''); setGrams('100'); }}>
      <span style={{ flex: 1 }}><strong>{r.name}</strong><span className="muted sm2" style={{ display: 'block' }}>{r.brand}{r.quantity ? ` · ${r.quantity}` : ''}</span><span className="muted sm2" style={{ display: 'block' }}>Per 100 g: {Math.round(r.calories)} kcal · P{r.protein} C{r.carbs} F{r.fat} · fibre {r.fibre} g</span></span><span className="chip">{selected?.code === r.code ? 'Selected' : 'Select'}</span>
    </button>)}</div>}
    {selected && <div className="card" style={{ marginTop: 12 }}><h3>{selected.name}</h3><div className="row"><label>Amount (g)<input type="number" min="1" max="5000" value={grams} onChange={e => setGrams(e.target.value)} /></label><label>Meal<select value={mealId} onChange={e => onMealChange(e.target.value)}>{/* selection is controlled by the parent meal shortcut */}<option value="">Unassigned</option>{meals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div style={{ flex: 1 }}><strong>Calculated macros</strong><div className="muted sm2">{per(selected.calories)} kcal · P{per(selected.protein)} g · C{per(selected.carbs)} g · F{per(selected.fat)} g · fibre {per(selected.fibre)} g</div></div><button className="btn" disabled={busy} onClick={() => void add()}>Add food</button></div></div>}
    <p className="muted sm2">Data source: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL database). Search is limited to about 8 requests/minute by this app; searches run only when you press Search and repeated queries are cached during this session.</p>
  </div>;
}
