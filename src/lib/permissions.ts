export type AdminRole = "admin" | "moderator" | "staff" | "readonly";

export type AdminSection =
  | "overview"
  | "users"
  | "content"
  | "activity"
  | "announcements"
  | "support"
  | "reports"
  | "settings";

/** Which console sections each role can open. Order matters — first = landing page. */
export const ROLE_SECTIONS: Record<AdminRole, AdminSection[]> = {
  admin: ["overview", "users", "content", "activity", "announcements", "support", "reports", "settings"],
  moderator: ["overview", "users", "activity", "announcements", "support", "reports"],
  staff: ["overview", "content", "support", "announcements"],
  readonly: ["overview", "activity", "reports"],
};

export const ROLE_META: Record<AdminRole, { label: string; blurb: string; tone: string }> = {
  admin: { label: "Administrator", blurb: "Full access — branding, roles, content & data", tone: "text-primary" },
  moderator: { label: "Moderator", blurb: "People, activity, support & broadcasts", tone: "text-sky-400" },
  staff: { label: "Coach / Staff", blurb: "Content library & member support", tone: "text-emerald-400" },
  readonly: { label: "Analyst (read-only)", blurb: "View metrics & reports, no changes", tone: "text-amber-400" },
};

export const SECTION_PATH: Record<AdminSection, string> = {
  overview: "/admin",
  users: "/admin/users",
  content: "/admin/content",
  activity: "/admin/activity",
  announcements: "/admin/announcements",
  support: "/admin/support",
  reports: "/admin/reports",
  settings: "/admin/settings",
};

export function canAccess(role: AdminRole | null, section: AdminSection) {
  if (!role) return false;
  return ROLE_SECTIONS[role].includes(section);
}

/** read-only roles may look but never mutate */
export function canWrite(role: AdminRole | null) {
  return role === "admin" || role === "moderator" || role === "staff";
}

/** only full admins may change roles, branding, flags & destructive ops */
export function canManageSystem(role: AdminRole | null) {
  return role === "admin";
}

export function landingPath(role: AdminRole | null) {
  if (!role) return "/dashboard";
  return SECTION_PATH[ROLE_SECTIONS[role][0]];
}
