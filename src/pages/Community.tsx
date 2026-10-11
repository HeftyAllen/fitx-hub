import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, MessageCircle, Users, CalendarDays, ShieldCheck, LockKeyhole, Sparkles } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import MemberPageHeader from "@/components/member/MemberPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useCommunityGroups, useCommunityRoom } from "@/hooks/useCommunity";
import { timestampMillis, type CommunityGroup } from "@/lib/community";
import { CreateGroupDialog, GroupMembers } from "@/components/community/GroupManager";
import CommunityChat from "@/components/community/CommunityChat";
import CommunityActivities from "@/components/community/CommunityActivities";
import CommunityModeration from "@/components/community/CommunityModeration";
import { Button } from "@/components/ui/button";
import "@/components/community/community.css";

function CommunityRoom({ group, team }: { group: CommunityGroup; team: boolean }) {
  const { user } = useAuth();
  const { role } = useAdmin();
  const { config } = useFeatureAccess();
  const moderator = team && (role === "admin" || role === "moderator");
  const host = role === "admin" || (role === "coach" && group.coachId === user?.uid);
  const room = useCommunityRoom(group.id, moderator);
  const [params, setParams] = useSearchParams();
  const initialTab = params.get("tab") === "activities" ? "activities" : "chat";
  const [tab, setTab] = useState<"chat" | "activities" | "members" | "moderation">(initialTab);
  const [activityFilter, setActivityFilter] = useState<"all" | "class">("all");
  const members = room.members.filter(member => member.status === "active");
  const tabs: { key: typeof tab; label: string; icon: typeof MessageCircle }[] = [{ key: "chat", label: "Conversation", icon: MessageCircle }, { key: "activities", label: "Activities", icon: CalendarDays }, { key: "members", label: "Members", icon: Users }, ...(moderator ? [{ key: "moderation" as const, label: "Moderation", icon: ShieldCheck }] : [])];
  return <section className={`community-room min-w-0 ${tab === "chat" ? "is-chat-tab" : ""}`} data-tone={group.tone} aria-label={`${group.name} group`}>
    <header className="community-room-heading"><div className="flex items-center gap-3 min-w-0"><button className="community-icon-button lg:hidden" aria-label="Back to groups" onClick={() => { const next = new URLSearchParams(params); next.delete("group"); next.delete("tab"); setParams(next); }}><ArrowLeft size={18} /></button><span className="community-group-mark"><Users size={23} /></span><div className="min-w-0"><h2 className="text-lg font-semibold truncate">{group.name}</h2><p className="text-xs text-muted-foreground mt-1">{members.length} participants · {group.status === "archived" ? "Archived" : "Your coach community"}</p></div></div><span className="community-live-pill"><span />Live updates</span></header>
    {group.description && <p className="community-group-description">{group.description}</p>}
    <nav aria-label="Group sections" className="community-tabs">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} aria-current={tab === item.key ? "page" : undefined} className={tab === item.key ? "is-active" : ""}><item.icon size={15} />{item.label}{item.key === "moderation" && room.reports.some(report => report.status === "open") ? <span className="community-unread-dot" /> : null}</button>)}</nav>
    {team && config.features.community.mode === "disabled" && <p className="community-info">Community is currently hidden from member menus. Administrators can enable it in Platform settings → Feature access.</p>}
    {room.error && <p className="community-info text-destructive" role="alert">{room.error}</p>}
    {tab === "chat" && <CommunityChat group={group} messages={room.messages} members={members} loading={room.loading} cached={room.cached} moderator={moderator} onClass={() => { setActivityFilter("class"); setTab("activities"); }} />}
    {tab === "activities" && <CommunityActivities group={group} activities={room.activities} responses={room.responses} members={members} host={host} filter={activityFilter} onFilterChange={setActivityFilter} />}
    {tab === "members" && <GroupMembers group={group} members={room.members} host={host} moderator={moderator} />}
    {tab === "moderation" && moderator && <CommunityModeration group={group} reports={room.reports} messages={room.messages} />}
  </section>;
}

export default function Community({ team = false }: { team?: boolean }) {
  const { user } = useAuth();
  const { role } = useAdmin();
  const { groups, loading, error } = useCommunityGroups(user?.uid, role, team);
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const canCreate = team && (role === "admin" || role === "coach");
  const selected = groups.find(group => group.id === params.get("group"));
  const visible = groups.filter(group => group.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => timestampMillis(b.lastMessageAt || b.createdAt) - timestampMillis(a.lastMessageAt || a.createdAt));
  const select = (id: string) => { const next = new URLSearchParams(params); next.set("group", id); next.delete("tab"); setParams(next); };
  const body = <div className={`${team ? "community-page space-y-5" : "community-page px-4 md:px-7 max-w-[1500px] mx-auto"} ${selected ? "has-open-room" : ""}`}>
    <MemberPageHeader eyebrow={team ? "Your coaching community" : "A little more together"} title={team && role === "moderator" ? "Keep the community welcoming." : "Find your people. Keep your momentum."} description={team ? "Coach groups, shared sessions and conversations that keep members connected." : "Talk with your coach, join a class and build your next workout together."} actions={canCreate ? <Button onClick={() => setCreateOpen(true)}><Plus size={16} />Create group</Button> : undefined} />
    {error && <p className="community-info text-destructive" role="alert">{error}</p>}
    <div className={`community-layout ${selected ? "has-selected-group" : ""}`}>
      <aside className="community-group-list" aria-label="Your community groups"><div className="flex justify-between items-center mb-4"><h2 className="text-sm font-semibold">{team ? "Coach groups" : "Your groups"}</h2><span className="text-xs text-muted-foreground">{groups.length}</span></div><label className="sr-only" htmlFor="community-search">Search groups</label><input id="community-search" className="community-search" placeholder="Find a group…" value={search} onChange={event => setSearch(event.target.value)} />
        {loading && <p className="text-sm text-muted-foreground py-8" role="status">Loading your groups…</p>}
        <div className="space-y-2 mt-4">{visible.map(group => <button key={group.id} className={`community-group-card ${selected?.id === group.id ? "is-active" : ""}`} data-tone={group.tone} onClick={() => select(group.id)} aria-current={selected?.id === group.id ? "page" : undefined}><span className="community-group-mark"><Users size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm truncate">{group.name}</strong><span className="block text-xs text-muted-foreground truncate mt-1">{group.status === "archived" ? "Archived group" : group.description || "Conversations, classes and encouragement"}</span></span>{group.lastMessageAt && <span className="community-group-time">{new Date(timestampMillis(group.lastMessageAt)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}</button>)}</div>
        {!loading && !visible.length && <div className="py-8 text-center"><Users size={27} className="mx-auto text-primary mb-3" /><p className="text-sm font-semibold">{search ? "No matching groups" : "Your next chapter starts together."}</p><p className="text-xs text-muted-foreground mt-2 leading-relaxed">{search ? "Try another group name." : canCreate ? "Create a group and invite your assigned clients." : "Your coach can invite you to a group. Private programmes are still available in My coach."}</p></div>}
        <p className="community-privacy-note"><LockKeyhole size={13} />Group conversations are shared with participants and authorised moderators.</p>
      </aside>
      {selected ? <CommunityRoom key={`${user?.uid}:${selected.id}`} group={selected} team={team} /> : <section className="community-welcome"><span className="community-welcome-orbit"><Sparkles size={38} /></span><p className="member-eyebrow mt-7">Small steps. Shared energy.</p><h2>Better with your people.</h2><p>Open a group to catch up, plan a session or celebrate a milestone.</p><div className="community-welcome-chips"><span>💬 Real conversations</span><span>🏋️ Shared workouts</span><span>📅 Coach classes</span></div></section>}
    </div>
    {canCreate && <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={select} />}
  </div>;
  return team ? body : <AppLayout>{body}</AppLayout>;
}
