import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_META, SECTION_PATH, type AdminSection } from "@/lib/permissions";
import { SECTION_META } from "@/components/admin/AdminLayout";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SyncStatus from "@/components/SyncStatus";
import { memberGreetingName } from "@/lib/member-identity";

type Feed = {
  rows: (DocumentData & { id: string })[];
  loading: boolean;
  error: boolean;
  cached: boolean;
};
const initial: Feed = { rows: [], loading: true, error: false, cached: false };
export default function AdminOverview() {
  const { role, sections } = useAdmin();
  const { user, userProfile } = useAuth();
  const name = memberGreetingName(userProfile, user?.displayName);
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const meta = ROLE_META[role ?? "readonly"];
  useEffect(() => {
    if (!role || !user) return;
    setFeeds({});
    const sources: {
      name: string;
      path: string;
      max: number;
      own?: boolean;
    }[] = [];
    if (["admin", "moderator", "readonly"].includes(role))
      sources.push({ name: "members", path: "users", max: 500 });
    if (["admin", "moderator", "staff"].includes(role))
      sources.push({ name: "tickets", path: "supportTickets", max: 100 });
    if (["admin", "coach"].includes(role)) {
      sources.push({ name: "plans", path: "library_workouts", max: 200 });
      sources.push({
        name: "assignments",
        path: "coachAssignments",
        max: 100,
        own: role === "coach",
      });
    }
    if (["admin", "moderator", "readonly"].includes(role))
      sources.push({ name: "activity", path: "activityLogs", max: 100 });
    if (role === "staff")
      sources.push({ name: "announcements", path: "announcements", max: 100 });
    const stops = sources.map(({ name, path, max, own }) =>
      onSnapshot(
        query(
          collection(db, path),
          ...(own ? [where("coachId", "==", user.uid)] : []),
          limit(max),
        ),
        { includeMetadataChanges: true },
        (snap) =>
          setFeeds((f) => ({
            ...f,
            [name]: {
              rows: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
              loading: false,
              error: false,
              cached: snap.metadata.fromCache,
            },
          })),
        () =>
          setFeeds((f) => ({
            ...f,
            [name]: { ...initial, loading: false, error: true },
          })),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [role, user]);
  const feed = (key: string) => feeds[key] ?? initial;
  const metrics =
    role === "coach"
      ? [
          {
            label: "Assigned members",
            key: "assignments",
            match: (r: DocumentData) => r.status === "active",
          },
          {
            label: "Published workouts",
            key: "plans",
            match: (r: DocumentData) => r.status === "published",
          },
          {
            label: "Workout drafts",
            key: "plans",
            match: (r: DocumentData) => r.status === "draft",
          },
        ]
      : role === "staff"
        ? [
            {
              label: "Open tickets",
              key: "tickets",
              match: (r: DocumentData) => r.status === "open",
            },
            {
              label: "Awaiting follow-up",
              key: "tickets",
              match: (r: DocumentData) => r.status === "pending",
            },
            {
              label: "Team announcements",
              key: "announcements",
              match: () => true,
            },
          ]
        : [
            { label: "Member directory", key: "members", match: () => true },
            {
              label: role === "readonly" ? "Recorded events" : "Open tickets",
              key: role === "readonly" ? "activity" : "tickets",
              match: (r: DocumentData) =>
                role === "readonly" || r.status === "open",
            },
            {
              label:
                role === "admin"
                  ? "Active coach assignments"
                  : "Suspended members",
              key: role === "admin" ? "assignments" : "members",
              match: (r: DocumentData) =>
                role === "admin" ? r.status === "active" : r.suspended === true,
            },
          ];
  const focusKey =
    role === "coach"
      ? "assignments"
      : role === "readonly"
        ? "activity"
        : "tickets";
  const focus = feed(focusKey);
  const priorityRows = focus.rows
    .filter((r) =>
      role === "coach"
        ? r.status === "active"
        : role === "readonly"
          ? true
          : r.status !== "closed",
    )
    .slice(0, 5);
  const focusSection: AdminSection =
    role === "coach"
      ? "coaching"
      : role === "readonly"
        ? "activity"
        : "support";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-muted-foreground">
          YOUR WORKSPACE <span className="mx-2">/</span>{" "}
          <span className="workspace-accent font-semibold">
            {meta.label.toUpperCase()}
          </span>
        </p>
        <span className="text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <section className="workspace-hero relative overflow-hidden rounded-3xl border border-border p-6 md:p-9">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-card/80 border border-border px-3 py-1.5 text-[11px] font-semibold">
            <Sparkles size={12} className="workspace-accent" /> {meta.focus}
          </span>
          <p className="mt-6 text-sm text-muted-foreground">
            Welcome back{name ? `, ${name}` : ""}.
          </p>
          <h1 className="text-3xl md:text-5xl leading-[1.1] font-extrabold mt-2 max-w-xl">
            {meta.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-4 max-w-lg leading-relaxed">
            {meta.blurb}
          </p>
          <Button asChild className="mt-6 workspace-button rounded-xl gap-2">
            <Link to={SECTION_PATH[meta.primary]}>
              {SECTION_META[meta.primary].label}
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
        <ShieldCheck
          className="absolute -right-6 bottom-0 h-64 w-64 opacity-[.04] workspace-accent"
          strokeWidth={1}
        />
      </section>
      <div className="grid sm:grid-cols-3 gap-4">
        {metrics.map(({ label, key, match }, i) => {
          const f = feed(key);
          return (
            <div key={label} data-tone={["blue", "amber", "violet"][i]} className="workspace-card member-tone-card p-5 md:p-6">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-[10px] workspace-accent font-bold">
                  0{i + 1}
                </span>
              </div>
              <p className="text-4xl font-extrabold mt-5 tracking-tight">
                {f.loading || f.error ? "—" : f.rows.filter(match).length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-3">
                {f.error
                  ? "Data unavailable · check access"
                  : f.loading
                    ? "Loading recorded data…"
                    : `${f.cached ? "Cached" : "Loaded"} sample · up to ${key === "members" ? "500" : key === "plans" ? "200" : "100"} records`}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid xl:grid-cols-[1.35fr_1fr] gap-6">
        <section className="workspace-card p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest workspace-accent font-bold">
                Your focus
              </p>
              <h2 className="text-lg mt-1">
                {role === "coach"
                  ? "Member check-ins"
                  : role === "readonly"
                    ? "Recorded activity"
                    : "Tickets to follow up"}
              </h2>
            </div>
            <Link
              to={SECTION_PATH[focusSection]}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {focus.loading ? (
            <p className="py-10 text-sm text-muted-foreground text-center">
              Loading your workspace…
            </p>
          ) : focus.error ? (
            <div className="flex gap-2 text-sm text-destructive py-8">
              <AlertCircle size={17} /> We couldn't load this feed. Check your
              connection and permissions.
            </div>
          ) : priorityRows.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2
                size={32}
                className="workspace-accent mx-auto mb-3"
              />
              <h3 className="text-sm">
                {role === "coach"
                  ? "No members assigned yet"
                  : "Nothing waiting here"}
              </h3>
              <p className="text-xs text-muted-foreground mt-2">
                {role === "coach"
                  ? "An administrator can assign members to your coaching studio."
                  : "This panel updates when new records arrive."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {priorityRows.map((r) => (
                <Link
                  to={SECTION_PATH[focusSection]}
                  key={r.id}
                  className="flex items-center gap-3 p-3 bg-secondary/40 hover:bg-secondary rounded-xl"
                >
                  <span className="rounded-xl bg-card p-2.5 workspace-accent">
                    {role === "coach" ? (
                      <Dumbbell size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {r.memberName || r.subject || r.action || "Record"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.goal ||
                        r.userEmail ||
                        r.category ||
                        r.status ||
                        "Recorded activity"}
                    </p>
                  </div>
                  <ArrowUpRight size={15} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="workspace-card p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-widest workspace-accent font-bold">
            Tools for your role
          </p>
          <h2 className="text-lg mt-1 mb-5">Make your next move</h2>
          <div className="space-y-1">
            {sections
              .filter((s) => s !== "overview")
              .slice(0, 5)
              .map((s) => {
                const m = SECTION_META[s];
                return (
                  <Link
                    key={s}
                    to={SECTION_PATH[s]}
                    className="flex gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <m.icon
                      size={18}
                      className="workspace-accent shrink-0 mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {m.desc}
                      </p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground mt-1"
                    />
                  </Link>
                );
              })}
          </div>
        </section>
      </div>
      <div className="workspace-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm">Take your journey with you.</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Saved workouts and session recovery work offline. Team changes need
            a connection.
          </p>
        </div>
        <SyncStatus />
      </div>
    </div>
  );
}
