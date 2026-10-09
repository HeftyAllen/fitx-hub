/** Pure access checks for Firebase-authenticated Edge Functions. No client-supplied plan is trusted. */
export function decodeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if ("mapValue" in record) return decodeFirestoreFields((record.mapValue as { fields?: Record<string, unknown> }).fields || {});
  if ("arrayValue" in record) return ((record.arrayValue as { values?: unknown[] }).values || []).map(decodeFirestoreValue);
  for (const key of ["stringValue", "booleanValue", "timestampValue", "nullValue"]) if (key in record) return record[key];
  for (const key of ["integerValue", "doubleValue"]) if (key in record) return Number(record[key]);
  return null;
}
export function decodeFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}
export function serverFeatureAllowed(id: "nutrition" | "barcode", rawConfig: Record<string, unknown> | null, rawMember: Record<string, unknown> | null, now = Date.now()) {
  const policies = (rawConfig?.features || {}) as Record<string, { mode?: string; requiredPlan?: string }>;
  const member = rawMember || {};
  const expiry = member.expiresAt;
  const current = expiry == null || (typeof expiry === "string" && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > now);
  function single(feature: string) {
    const policy = policies[feature];
    if (policy === undefined) return true;
    if (!policy || typeof policy !== "object") return false;
    const mode = policy.mode === undefined ? "free" : policy.mode;
    if (mode === "free") return true;
    if (mode !== "premium" || !current) return false;
    const minimum = policy.requiredPlan === undefined ? "plus" : policy.requiredPlan;
    if (minimum !== "plus" && minimum !== "pro") return false;
    return (minimum === "pro" ? member.plan === "pro" : member.plan === "plus" || member.plan === "pro")
      || (Array.isArray(member.features) && member.features.includes(feature));
  }
  return single("nutrition") && (id !== "barcode" || single("barcode"));
}
