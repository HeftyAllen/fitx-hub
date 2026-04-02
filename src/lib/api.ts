const EXERCISE_DB_KEY = "02e5919d7cmshe07914db7605532p164aa8jsn0cde2d877db5";
const EXERCISE_DB_HOST = "exercisedb.p.rapidapi.com";
const SPOONACULAR_KEY = "e65fd7fb2e8c41e8aacabf4b6da43a1e";
const SPOONACULAR_BASE = "https://api.spoonacular.com";

const exerciseHeaders = {
  "X-RapidAPI-Key": EXERCISE_DB_KEY,
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

export async function searchRecipes(query: string, filters?: {
  diet?: string;
  cuisine?: string;
  maxCalories?: number;
  maxReadyTime?: number;
  type?: string;
}) {
  const params = new URLSearchParams({
    apiKey: SPOONACULAR_KEY,
    query,
    number: "12",
    addRecipeNutrition: "true",
  });
  if (filters?.diet) params.set("diet", filters.diet);
  if (filters?.cuisine) params.set("cuisine", filters.cuisine);
  if (filters?.maxCalories) params.set("maxCalories", String(filters.maxCalories));
  if (filters?.maxReadyTime) params.set("maxReadyTime", String(filters.maxReadyTime));
  if (filters?.type) params.set("type", filters.type);

  const res = await fetch(`${SPOONACULAR_BASE}/recipes/complexSearch?${params}`);
  return res.json();
}

export async function getRecipeById(id: number) {
  const res = await fetch(
    `${SPOONACULAR_BASE}/recipes/${id}/information?apiKey=${SPOONACULAR_KEY}&includeNutrition=true`
  );
  return res.json();
}

export async function searchIngredients(query: string) {
  const res = await fetch(
    `${SPOONACULAR_BASE}/food/ingredients/search?apiKey=${SPOONACULAR_KEY}&query=${encodeURIComponent(query)}&number=10`
  );
  return res.json();
}

export async function generateMealPlan(targetCalories: number, diet?: string) {
  const params = new URLSearchParams({
    apiKey: SPOONACULAR_KEY,
    timeFrame: "week",
    targetCalories: String(targetCalories),
  });
  if (diet) params.set("diet", diet);

  const res = await fetch(`${SPOONACULAR_BASE}/mealplanner/generate?${params}`);
  return res.json();
}
