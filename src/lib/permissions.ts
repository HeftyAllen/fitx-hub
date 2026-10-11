export type AdminRole = "admin" | "moderator" | "staff" | "coach" | "readonly";
export type AdminSection =
  | "overview"
  | "users"
  | "content"
  | "coaching"
  | "community"
  | "activity"
  | "announcements"
  | "support"
  | "reports"
  | "settings";
export type Capability =
  | "manage-system"
  | "manage-roles"
  | "moderate-members"
  | "publish-content"
  | "publish-announcements"
  | "reply-support"
  | "coach-members";

export const ROLE_SECTIONS: Record<AdminRole, AdminSection[]> = {
  admin: [
    "overview",
    "users",
    "coaching",
    "community",
    "content",
    "activity",
    "announcements",
    "support",
    "reports",
    "settings",
  ],
  moderator: ["overview", "users", "activity", "support", "community"],
  staff: ["overview", "support", "announcements"],
  coach: ["overview", "coaching", "content", "community"],
  readonly: ["overview", "activity", "reports"],
};
const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  admin: [
    "manage-system",
    "manage-roles",
    "moderate-members",
    "publish-content",
    "publish-announcements",
    "reply-support",
    "coach-members",
  ],
  moderator: ["moderate-members", "reply-support"],
  staff: ["reply-support"],
  coach: ["publish-content", "coach-members"],
  readonly: [],
};
export const ROLE_META: Record<
  AdminRole,
  {
    label: string;
    blurb: string;
    tone: string;
    workspace: string;
    title: string;
    focus: string;
    primary: AdminSection;
  }
> = {
  admin: {
    label: "Administrator",
    workspace: "Control room",
    title: "A stronger community starts here.",
    blurb: "Manage your team, platform, content and member experience.",
    tone: "text-primary",
    focus: "Platform health",
    primary: "users",
  },
  moderator: {
    label: "Moderator",
    workspace: "Community desk",
    title: "Keep the journey safe for everyone.",
    blurb:
      "Review member activity, manage suspensions and resolve community concerns.",
    tone: "text-sky-500",
    focus: "Member safety",
    primary: "users",
  },
  staff: {
    label: "Support staff",
    workspace: "Support desk",
    title: "Make every member feel supported.",
    blurb:
      "Work through incoming tickets, follow up on replies and read team updates.",
    tone: "text-violet-500",
    focus: "Member support",
    primary: "support",
  },
  coach: {
    label: "Coach",
    workspace: "Coaching studio",
    title: "Help your members move forward.",
    blurb:
      "Follow your assigned members, record check-ins and build training plans.",
    tone: "text-emerald-500",
    focus: "Member progress",
    primary: "coaching",
  },
  readonly: {
    label: "Analyst",
    workspace: "Insights desk",
    title: "See the progress behind the numbers.",
    blurb: "Explore platform activity and reports with read-only access.",
    tone: "text-amber-500",
    focus: "Platform insights",
    primary: "reports",
  },
};
export const SECTION_PATH: Record<AdminSection, string> = {
  overview: "/admin",
  users: "/admin/users",
  content: "/admin/content",
  coaching: "/admin/coaching",
  community: "/admin/community",
  activity: "/admin/activity",
  announcements: "/admin/announcements",
  support: "/admin/support",
  reports: "/admin/reports",
  settings: "/admin/settings",
};
export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ROLE_SECTIONS, value)
  );
}
export function canAccess(role: AdminRole | null, section: AdminSection) {
  return !!role && ROLE_SECTIONS[role].includes(section);
}
export function canPerform(role: AdminRole | null, capability: Capability) {
  return !!role && ROLE_CAPABILITIES[role].includes(capability);
}
export function canWrite(role: AdminRole | null) {
  return !!role && ROLE_CAPABILITIES[role].length > 0;
}
export function canManageSystem(role: AdminRole | null) {
  return canPerform(role, "manage-system");
}
export function landingPath(role: AdminRole | null) {
  return role ? SECTION_PATH[ROLE_SECTIONS[role][0]] : "/dashboard";
}
