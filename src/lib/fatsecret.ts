// Thin client around our Supabase edge function /fatsecret.
// Normalises FatSecret's quirky response shapes into something the UI
// can consume directly.

import { supabase } from "@/integrations/supabase/client";

export interface FsServing {
  serving_id: string;
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface FsFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type?: string;            // "Brand" | "Generic"
  food_url?: string;
  servings: FsServing[];
}

export interface FsSearchHit {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type?: string;
  food_description?: string;     // FatSecret returns a pre-formatted one-liner
}

async function call<T = any>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("fatsecret", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "Edge function error");
  if (!data?.ok) throw new Error(data?.error || "FatSecret request failed");
  return data.data as T;
}

function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseServings(raw: any): FsServing[] {
  if (!raw) return [];
  const list = Array.isArray(raw.serving) ? raw.serving : raw.serving ? [raw.serving] : [];
  return list.map((s: any) => ({
    serving_id: String(s.serving_id ?? ""),
    serving_description: String(s.serving_description ?? "1 serving"),
    metric_serving_amount: s.metric_serving_amount,
    metric_serving_unit: s.metric_serving_unit,
    calories: toNum(s.calories),
    protein: toNum(s.protein),
    carbohydrate: toNum(s.carbohydrate),
    fat: toNum(s.fat),
    fiber: s.fiber != null ? toNum(s.fiber) : undefined,
    sugar: s.sugar != null ? toNum(s.sugar) : undefined,
    sodium: s.sodium != null ? toNum(s.sodium) : undefined,
  }));
}

export function normaliseFood(raw: any): FsFood | null {
  const f = raw?.food ?? raw;
  if (!f?.food_id) return null;
  return {
    food_id: String(f.food_id),
    food_name: String(f.food_name ?? "Unknown food"),
    brand_name: f.brand_name,
    food_type: f.food_type,
    food_url: f.food_url,
    servings: normaliseServings(f.servings),
  };
}

export async function searchFoods(query: string, page = 0): Promise<FsSearchHit[]> {
  const data = await call("search", { query, page });
  const list = data?.foods?.food;
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map((h: any) => ({
    food_id: String(h.food_id),
    food_name: String(h.food_name),
    brand_name: h.brand_name,
    food_type: h.food_type,
    food_description: h.food_description,
  }));
}

export async function autocompleteFoods(query: string): Promise<string[]> {
  const data = await call("autocomplete", { query });
  const list = data?.suggestions?.suggestion;
  if (!list) return [];
  return Array.isArray(list) ? list : [list];
}

export async function getFood(food_id: string): Promise<FsFood | null> {
  const data = await call("food", { food_id });
  return normaliseFood(data);
}

export async function lookupBarcode(barcode: string): Promise<FsFood | null> {
  const data = await call<{ found: boolean; food?: any }>("barcode", { barcode });
  if (!data?.found) return null;
  return normaliseFood(data.food);
}

// Compute per-serving × quantity macros.
export function scaleServing(serving: FsServing, quantity: number) {
  const q = Math.max(0, quantity);
  return {
    calories: Math.round(serving.calories * q),
    protein: Math.round(serving.protein * q * 10) / 10,
    carbs: Math.round(serving.carbohydrate * q * 10) / 10,
    fat: Math.round(serving.fat * q * 10) / 10,
    fiber: serving.fiber != null ? Math.round(serving.fiber * q * 10) / 10 : undefined,
  };
}
