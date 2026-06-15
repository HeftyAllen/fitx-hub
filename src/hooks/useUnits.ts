import { useAuth } from "@/contexts/AuthContext";
import type { UnitSystem } from "@/lib/units";

export function useUnits(): UnitSystem {
  const { userProfile } = useAuth();
  const u = (userProfile as any)?.units;
  return u === "imperial" ? "imperial" : "metric";
}
