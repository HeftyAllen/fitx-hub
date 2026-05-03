/* ──────────────────────────────────────────────────────────────────
 * Public API surface — Spoonacular calls re-exported from the cached
 * client in `lib/spoonacular.ts`. ExerciseDB stays direct (separate
 * provider with its own free quota).
 * ──────────────────────────────────────────────────────────────────*/

export {
  searchRecipes,
  getRecipeById,
  searchIngredients,
  generateMealPlan,
  lookupBarcode,
  getDailyUsage,
  canMakeRequest,
} from "./spoonacular";

const EXERCISE_DB_KEY  = import.meta.env.VITE_RAPIDAPI_KEY ?? "";
const EXERCISE_DB_HOST = import.meta.env.VITE_RAPIDAPI_EXERCISEDB_HOST ?? "exercisedb.p.rapidapi.com";
if (!EXERCISE_DB_KEY && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("[api] VITE_RAPIDAPI_KEY missing — exercise library calls will fail.");
}

const exerciseHeaders = {
  "X-RapidAPI-Key":  EXERCISE_DB_KEY,
  "X-RapidAPI-Host": EXERCISE_DB_HOST,
};

export async function searchExercises(query: string) {
  const res = await fetch(
    `https://${EXERCISE_DB_HOST}/exercises/name/${encodeURIComponent(query)}?limit=20`,
    { headers: exerciseHeaders }
  );
  return res.json();
}

export async function getExercisesByBodyPart(bodyPart: string) {
  const res = await fetch(
    `https://${EXERCISE_DB_HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=20`,
    { headers: exerciseHeaders }
  );
  return res.json();
}

export async function getExercisesByEquipment(equipment: string) {
  const res = await fetch(
    `https://${EXERCISE_DB_HOST}/exercises/equipment/${encodeURIComponent(equipment)}?limit=20`,
    { headers: exerciseHeaders }
  );
  return res.json();
}

export async function getBodyPartList() {
  const res = await fetch(
    `https://${EXERCISE_DB_HOST}/exercises/bodyPartList`,
    { headers: exerciseHeaders }
  );
  return res.json();
}
