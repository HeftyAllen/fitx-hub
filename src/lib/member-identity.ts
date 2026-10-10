/** Use the member's saved identity, never an email prefix or a demo account label. */
export function cleanMemberName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function memberGreetingName(profile: { name?: unknown; greetingName?: unknown } | null | undefined, authName?: string | null): string {
  for (const value of [profile?.greetingName, profile?.name, authName]) {
    const name = cleanMemberName(value);
    if (name && !/^fitx[\s_-]*qa$/i.test(name)) return name;
  }
  return "";
}
