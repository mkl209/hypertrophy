export interface FoodSearchResult { code: string; name: string; brand: string; quantity: string; image?: string; calories: number; protein: number; carbs: number; fat: number; fibre: number; }
interface OFFProduct { code?: string; product_name?: string; product_name_en?: string; brands?: string; quantity?: string; image_front_small_url?: string; nutriments?: Record<string, number | string | undefined> }
interface OFFResponse { products?: OFFProduct[]; status?: number | string; product?: OFFProduct }
const FIELDS = 'code,product_name,product_name_en,brands,quantity,image_front_small_url,nutriments';
let lastSearchAt = 0;
const LAST_SEARCH_KEY = 'hypertrophy-off-last-search';
const cache = new Map<string, FoodSearchResult[]>();

function toResult(p: OFFProduct): FoodSearchResult | null {
  const n = p.nutriments ?? {};
  const val = (...keys: string[]) => { for (const key of keys) { const v = Number(n[key]); if (Number.isFinite(v)) return v; } return 0; };
  const name = (p.product_name_en || p.product_name || '').trim();
  const code = String(p.code ?? '').trim();
  if (!name || !code) return null;
  const kcal = val('energy-kcal_100g') || Math.round(val('energy_100g') / 4.184);
  const result = { code, name, brand: p.brands ?? '', quantity: p.quantity ?? '', image: p.image_front_small_url, calories: kcal, protein: val('proteins_100g'), carbs: val('carbohydrates_100g'), fat: val('fat_100g'), fibre: val('fiber_100g', 'fibre_100g') };
  if (![result.calories, result.protein, result.carbs, result.fat].some(x => x > 0)) return null;
  return result;
}

/** Explicit-submit search only: OFF limits search endpoints to 10 requests/minute/IP. */
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) throw new Error('Enter at least two characters.');
  if (cache.has(q)) return cache.get(q)!;
  let previous = lastSearchAt;
  try { previous = Math.max(previous, Number(localStorage.getItem(LAST_SEARCH_KEY) || 0)); } catch { /* storage may be unavailable */ }
  const wait = Math.max(0, 7000 - (Date.now() - previous));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.search = new URLSearchParams({ search_terms: query.trim(), search_simple: '1', action: 'process', json: '1', page_size: '20', fields: FIELDS }).toString();
  lastSearchAt = Date.now();
  try { localStorage.setItem(LAST_SEARCH_KEY, String(lastSearchAt)); } catch { /* session-level throttle still applies */ }
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(response.status === 429 || response.status === 503 ? 'Open Food Facts is temporarily rate-limiting requests. Please wait before searching again.' : `Food search failed (${response.status}).`);
  const data = await response.json() as OFFResponse;
  const results = (data.products ?? []).map(toResult).filter((x): x is FoodSearchResult => !!x).slice(0, 20);
  cache.set(q, results);
  return results;
}

export async function lookupBarcode(code: string): Promise<FoodSearchResult> {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{8,14}$/.test(clean)) throw new Error('Enter a valid 8–14 digit barcode.');
  const response = await fetch(`https://world.openfoodfacts.org/api/v3.6/product/${encodeURIComponent(clean)}?fields=${encodeURIComponent(FIELDS)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Barcode lookup failed (${response.status}).`);
  const data = await response.json() as OFFResponse;
  const result = data.product && data.status !== 'failure' && data.status !== 0 ? toResult(data.product) : null;
  if (!result) throw new Error('No product with usable nutrition data was found for that barcode.');
  return result;
}
