// Unit conversion + formatting helpers. Canonical storage is metric (kg, cm).
export type UnitSystem = "metric" | "imperial";

export const kgToLbs = (kg: number) => kg * 2.20462;
export const lbsToKg = (lbs: number) => lbs / 2.20462;
export const cmToIn  = (cm: number) => cm / 2.54;
export const inToCm  = (inch: number) => inch * 2.54;

export function formatWeight(kg: number | null | undefined, units: UnitSystem = "metric", digits = 1): string {
  if (kg == null || isNaN(Number(kg))) return "—";
  return units === "imperial"
    ? `${kgToLbs(Number(kg)).toFixed(digits)} lbs`
    : `${Number(kg).toFixed(digits)} kg`;
}

export function weightLabel(units: UnitSystem) {
  return units === "imperial" ? "lbs" : "kg";
}

export function heightLabel(units: UnitSystem) {
  return units === "imperial" ? "ft/in" : "cm";
}

export function formatHeight(cm: number | null | undefined, units: UnitSystem = "metric"): string {
  if (cm == null || isNaN(Number(cm))) return "—";
  const v = Number(cm);
  if (units === "metric") return `${Math.round(v)} cm`;
  const totalIn = cmToIn(v);
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}'${inch}"`;
}

// Convert a user-entered weight (in their preferred unit) to kg for storage.
export function normalizeWeightToKg(value: number, units: UnitSystem): number {
  return units === "imperial" ? lbsToKg(value) : value;
}
