/* ──────────────────────────────────────────────────────────────────
 * Spoonacular client with aggressive client-side caching and
 * a daily-request counter so we stay inside the 150 req/day free tier.
 *
 * Strategy:
 *   1. Cache every search/lookup response in localStorage for 24h
 *   2. Track daily request count so the UI can warn the user
 *   3. Throttle expensive endpoints (meal-plan generator → 1/day)
 *   4. Serve a "recent foods" list locally for zero-API repeat entries
 * ──────────────────────────────────────────────────────────────────*/

const KEY  = import.meta.env.VITE_SPOONACULAR_KEY ?? "";
const BASE = "https://api.spoonacular.com";
if (!KEY && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("[spoonacular] VITE_SPOONACULAR_KEY missing — recipe/nutrition calls will fail.");
}

const CACHE_TTL          = 24 * 60 * 60 * 1000;   // 24h
const DAILY_LIMIT        = 150;                   // free plan
const COUNTER_KEY        = "spoon_daily_counter_v1";
const RECENT_FOODS_KEY   = "spoon_recent_foods_v1";
const MEAL_PLAN_THROTTLE = "spoon_mealplan_lastgen_v1";

/* ────────────── DAILY COUNTER ────────────── */
interface DailyCounter { date: string; count: number; }

function todayKey() { return new Date().toISOString().slice(0, 10); }

export function getDailyUsage(): { used: number; limit: number; resetIn: string } {
  let counter: DailyCounter = { date: todayKey(), count: 0 };
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyCounter;
      if (parsed.date === todayKey()) counter = parsed;
    }
  } catch { /* ignore */ }

  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const ms = tomorrow.getTime() - Date.now();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return { used: counter.count, limit: DAILY_LIMIT, resetIn: `${h}h ${m}m` };
}

function bumpCounter() {
  const { used } = getDailyUsage();
  const next: DailyCounter = { date: todayKey(), count: used + 1 };
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function canMakeRequest(): boolean {
  return getDailyUsage().used < DAILY_LIMIT;
}

/* ────────────── CACHE ────────────── */
function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch { return null; }
}

function cacheSet(key: string, data: any) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); }
  catch (e) {
    // localStorage full → drop oldest spoon_cache entries
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("spoon_cache_"))
        .slice(0, 20)
        .forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* give up */ }
  }
}

/* ────────────── FETCH WRAPPER ────────────── */
async function spoonFetch<T>(cacheKey: string, url: string): Promise<T> {
  const cached = cacheGet<T>(cacheKey);
  if (cached) return cached;

  if (!canMakeRequest()) {
    throw new Error("DAILY_LIMIT_REACHED");
  }

  const res = await fetch(url);
  bumpCounter();

  if (!res.ok) {
    if (res.status === 402 || res.status === 429) throw new Error("DAILY_LIMIT_REACHED");
    throw new Error(`Spoonacular ${res.status}`);
  }
  const data = (await res.json()) as T;
  cacheSet(cacheKey, data);
  return data;
}

/* ────────────── PUBLIC API ────────────── */
export async function searchRecipes(query: string, filters?: {
  diet?: string; cuisine?: string; maxCalories?: number;
  maxReadyTime?: number; type?: string; intolerances?: string;
}) {
  const params = new URLSearchParams({
    apiKey: KEY,
    query,
    number: "12",
    addRecipeNutrition: "true",
  });
  if (filters?.diet)         params.set("diet", filters.diet);
  if (filters?.cuisine)      params.set("cuisine", filters.cuisine);
  if (filters?.maxCalories)  params.set("maxCalories", String(filters.maxCalories));
  if (filters?.maxReadyTime) params.set("maxReadyTime", String(filters.maxReadyTime));
  if (filters?.type)         params.set("type", filters.type);
  if (filters?.intolerances) params.set("intolerances", filters.intolerances);

  const cacheKey = `spoon_cache_search_${query}_${filters?.diet || ""}_${filters?.type || ""}_${filters?.cuisine || ""}_${filters?.intolerances || ""}`;
  return spoonFetch<any>(cacheKey, `${BASE}/recipes/complexSearch?${params}`);
}

export async function getRecipeById(id: number) {
  return spoonFetch<any>(
    `spoon_cache_recipe_${id}`,
    `${BASE}/recipes/${id}/information?apiKey=${KEY}&includeNutrition=true`
  );
}

export async function searchIngredients(query: string) {
  return spoonFetch<any>(
    `spoon_cache_ingr_${query}`,
    `${BASE}/food/ingredients/search?apiKey=${KEY}&query=${encodeURIComponent(query)}&number=10`
  );
}

export async function getIngredientInfo(id: number, amount = 100, unit = "grams") {
  return spoonFetch<any>(
    `spoon_cache_ingr_info_${id}_${amount}_${unit}`,
    `${BASE}/food/ingredients/${id}/information?apiKey=${KEY}&amount=${amount}&unit=${unit}`
  );
}

/* Lookup a UPC barcode (camera scan). */
export async function lookupBarcode(upc: string) {
  return spoonFetch<any>(
    `spoon_cache_upc_${upc}`,
    `${BASE}/food/products/upc/${upc}?apiKey=${KEY}`
  );
}

/* ────────────── MEAL PLAN GENERATOR ────────────── */
export interface MealPlanResult {
  week?: Record<string, { meals: any[]; nutrients: any }>;
  meals?: any[];
  nutrients?: any;
}

export function canGenerateMealPlan(): { ok: boolean; nextAvailable?: string } {
  try {
    const raw = localStorage.getItem(MEAL_PLAN_THROTTLE);
    if (!raw) return { ok: true };
    const last = parseInt(raw, 10);
    const elapsed = Date.now() - last;
    const limit = 24 * 60 * 60 * 1000;
    if (elapsed >= limit) return { ok: true };
    const ms = limit - elapsed;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return { ok: false, nextAvailable: `${h}h ${m}m` };
  } catch { return { ok: true }; }
}

export async function generateMealPlan(targetCalories: number, opts?: {
  diet?: string; intolerances?: string; timeFrame?: "day" | "week";
}): Promise<MealPlanResult> {
  const throttle = canGenerateMealPlan();
  if (!throttle.ok) throw new Error(`MEAL_PLAN_THROTTLED:${throttle.nextAvailable}`);

  const params = new URLSearchParams({
    apiKey: KEY,
    timeFrame: opts?.timeFrame || "week",
    targetCalories: String(targetCalories),
  });
  if (opts?.diet)         params.set("diet", opts.diet);
  if (opts?.intolerances) params.set("intolerances", opts.intolerances);

  const cacheKey = `spoon_cache_mealplan_${targetCalories}_${opts?.diet || ""}_${opts?.intolerances || ""}_${opts?.timeFrame || "week"}`;
  const data = await spoonFetch<MealPlanResult>(cacheKey, `${BASE}/mealplanner/generate?${params}`);

  try { localStorage.setItem(MEAL_PLAN_THROTTLE, String(Date.now())); } catch { /* ignore */ }
  return data;
}

/* ────────────── RECENT FOODS (zero-API repeat entries) ────────────── */
export interface RecentFood {
  id: string;        // ingredient id or recipe id (stringified)
  name: string;
  image?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  amount?: number;
  unit?: string;
  meal?: string;
  lastUsed: number;  // epoch ms
  uses: number;
}

export function getRecentFoods(uid: string | null, limit = 12): RecentFood[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`${RECENT_FOODS_KEY}_${uid}`);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentFood[];
    return list.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, limit);
  } catch { return []; }
}

export function pushRecentFood(uid: string | null, food: Omit<RecentFood, "lastUsed" | "uses">) {
  if (!uid) return;
  try {
    const key = `${RECENT_FOODS_KEY}_${uid}`;
    const existing = getRecentFoods(uid, 50);
    const idx = existing.findIndex(f => f.id === food.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...food, lastUsed: Date.now(), uses: existing[idx].uses + 1 };
    } else {
      existing.unshift({ ...food, lastUsed: Date.now(), uses: 1 });
    }
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch { /* ignore */ }
}
