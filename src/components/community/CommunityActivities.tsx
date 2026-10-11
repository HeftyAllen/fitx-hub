import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ArrowUpRight, CalendarPlus, CheckCircle2, Plus, Play, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { useOnline } from "@/hooks/useOnline";
import { loadWorkoutDraft } from "@/lib/offline/drafts";
import { emptyCoachingExercise, programmeSchedule } from "@/lib/coaching";
import { activityKinds, activitySchema, communityWorkout, timestampMillis, type ActivityKind, type ActivityResponse, type CommunityActivity, type CommunityActivityInput, type CommunityGroup, type CommunityMember } from "@/lib/community";
import { FeatureNotice } from "@/components/member/FeatureGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const newActivity = (): CommunityActivityInput => ({ title: "", kind: "workout", details: "", exercises: [emptyCoachingExercise()], durationMinutes: 30, startsAt: "", meetingUrl: "" });
function localDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function ActivityEditor({ group, activity, host, onClose }: { group: CommunityGroup; activity?: CommunityActivity; host: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const online = useOnline();
  const [draft, setDraft] = useState<CommunityActivityInput>(activity || newActivity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const originalRevision = useRef(timestampMillis(activity?.updatedAt));
  const change = <K extends keyof CommunityActivityInput>(key: K, value: CommunityActivityInput[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !online || saving) return;
    const parsed = activitySchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError("");
    try {
      const ref = doc(db, "communityGroups", group.id, "activities", activity?.id || doc(collection(db, "communityGroups", group.id, "activities")).id);
      if (activity) await runTransaction(db, async transaction => {
        const current = await transaction.get(ref);
        if (!current.exists() || timestampMillis(current.data().updatedAt) !== originalRevision.current) throw new Error("conflict");
        transaction.update(ref, { ...parsed.data, updatedAt: serverTimestamp(), updatedBy: user.uid });
      });
      else await setDoc(ref, { ...parsed.data, status: host ? "published" : "draft", createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: user.uid });
      toast.success(activity ? "Activity updated for everyone." : host ? "Shared with your group." : "Workout draft shared. Your coach can publish it when ready."); onClose();
    } catch (reason) { setError(reason instanceof Error && reason.message === "conflict" ? "Someone updated this activity while you were editing. Close and reopen it to use the latest version." : "This activity could not sync. Check your connection and group access."); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="community-dialog max-h-[90dvh] overflow-y-auto">
    <DialogTitle>{activity ? "Edit shared activity" : host ? "Share an activity" : "Build a workout together"}</DialogTitle><DialogDescription>{host ? "Share a session, guidance or an announcement with your group." : "Everyone in your group can improve this draft. Your coach approves it before members start it."}</DialogDescription>
    <form onSubmit={save} className="space-y-4">
      {host && !activity && <label className="community-field">Activity type<select aria-label="Activity type" value={draft.kind} onChange={event => { const kind = event.target.value as ActivityKind; setDraft(previous => ({ ...previous, kind, exercises: kind === "workout" ? [emptyCoachingExercise()] : [], startsAt: "", meetingUrl: "" })); }}>{Object.entries(activityKinds).map(([kind, meta]) => <option key={kind} value={kind}>{meta.label}</option>)}</select></label>}
      <label className="community-field">Activity title<input value={draft.title} maxLength={120} required onChange={event => change("title", event.target.value)} placeholder="Your next small win" /></label>
      <label className="community-field">Instructions or message<textarea aria-label="Instructions or message" rows={4} value={draft.details} maxLength={10000} required onChange={event => change("details", event.target.value)} placeholder="What should your group know?" /></label>
      {(draft.kind === "workout" || draft.kind === "class") && <label className="community-field">Duration in minutes<input type="number" min={5} max={180} value={draft.durationMinutes} onChange={event => change("durationMinutes", Number(event.target.value))} /></label>}
      {draft.kind === "class" && <><label className="community-field">Class date and time<input type="datetime-local" required value={localDateTime(draft.startsAt)} onChange={event => change("startsAt", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label><label className="community-field">Online class link (optional)<input type="url" value={draft.meetingUrl} maxLength={1000} placeholder="https://…" onChange={event => change("meetingUrl", event.target.value)} /></label><p className="text-xs text-muted-foreground">Times display in each member’s local time. Use your usual video meeting service or describe the gym location above.</p></>}
      {draft.kind === "workout" && <fieldset className="space-y-3"><legend className="community-field mb-2">Exercises</legend>{draft.exercises.map((exercise, index) => {
        const edit = (key: string, value: string | number) => change("exercises", draft.exercises.map((item, i) => i === index ? { ...item, [key]: value } : item));
        return <div key={index} className="community-exercise-editor"><label className="community-field">Exercise {index + 1}<input value={exercise.name} maxLength={120} required onChange={event => edit("name", event.target.value)} placeholder="Bodyweight squat" /></label><div className="community-exercise-numbers">{[["sets", "Sets", 1, 10], ["reps", "Reps", 1, 100], ["restSeconds", "Rest (sec)", 0, 600]].map(([key, label, min, max]) => <label key={key} className="community-field">{label}<input type="number" min={min} max={max} value={exercise[key as "sets" | "reps" | "restSeconds"]} onChange={event => edit(String(key), Number(event.target.value))} /></label>)}</div><label className="community-field">Equipment<input maxLength={80} value={exercise.equipment} onChange={event => edit("equipment", event.target.value)} /></label><Button type="button" size="sm" variant="ghost" onClick={() => change("exercises", draft.exercises.filter((_, i) => i !== index))}><Trash2 size={14} />Remove exercise</Button></div>;
      })}<Button type="button" variant="outline" disabled={draft.exercises.length >= 20} onClick={() => change("exercises", [...draft.exercises, emptyCoachingExercise()])}><Plus size={15} />Add exercise</Button></fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={saving || !online} type="submit">{saving ? "Sharing…" : activity ? "Save changes" : host ? "Share with group" : "Share workout draft"}</Button>
    </form>
  </DialogContent></Dialog>;
}

function ActivityCard({ group, activity, responses, member, host, onEdit }: { group: CommunityGroup; activity: CommunityActivity; responses: ActivityResponse[]; member?: CommunityMember; host: boolean; onEdit: () => void }) {
  const { user } = useAuth();
  const { getAccess } = useFeatureAccess();
  const online = useOnline();
  const navigate = useNavigate();
  const meta = activityKinds[activity.kind];
  const access = getAccess(meta.feature);
  const rewards = getAccess("rewards");
  const allowed = host || (access.state === "allowed" && !access.loading && !access.error) || (activity.kind === "challenge" && rewards.state === "allowed" && !rewards.loading && !rewards.error);
  const calendar = getAccess("calendar");
  const own = responses.find(response => response.userId === user?.uid);
  const [feedback, setFeedback] = useState(own?.feedback || "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setFeedback(own?.feedback || ""); }, [own?.feedback, dirty]);
  const active = group.status === "active";
  const canRespond = !!member && active && allowed && activity.status === "published";
  const canEdit = active && (host || (member && activity.kind === "workout" && activity.status === "draft" && allowed));
  async function respond(status: ActivityResponse["status"]) {
    if (!user || !member || !online || !canRespond || busy) return;
    setBusy(true);
    try { await setDoc(doc(db, "communityGroups", group.id, "responses", `${activity.id}_${user.uid}`), { activityId: activity.id, userId: user.uid, name: member.name, status, feedback: feedback.trim(), updatedAt: serverTimestamp() }); setDirty(false); toast.success("Your group update is shared."); }
    catch { toast.error("Your update could not sync. Check group and feature access."); } finally { setBusy(false); }
  }
  async function saveWorkout() {
    if (!user || !canRespond || !online || busy) return;
    setBusy(true);
    try { const plan = communityWorkout(group.id, activity); await setDoc(doc(db, "users", user.uid, "workoutPlans", plan.id), { ...plan, createdAt: serverTimestamp() }, { merge: true }); toast.success("Added to your training plans."); }
    catch { toast.error("This workout could not be saved."); } finally { setBusy(false); }
  }
  function startWorkout() {
    if (!user || !canRespond) return;
    const plan = communityWorkout(group.id, activity);
    const draft = loadWorkoutDraft(user.uid);
    if (draft && draft.plan.id !== plan.id) { toast.info("Resume or discard your saved workout in Training before starting another."); navigate("/workout-planner"); return; }
    navigate("/workout-session", draft ? undefined : { state: { plan } });
  }
  async function addToCalendar() {
    if (!user || !canRespond || !online || busy || !activity.startsAt) return;
    setBusy(true);
    try {
      const date = new Date(activity.startsAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      await setDoc(doc(db, "users", user.uid, "calendarEntries", `community_${group.id}_${activity.id}`), { date: dateKey, planId: "", planName: activity.title, kind: "class", communityGroupId: group.id, communityActivityId: activity.id, startsAt: activity.startsAt, notes: activity.details.slice(0, 1000), createdAt: serverTimestamp() }, { merge: true });
      toast.success("Class reminder added to Calendar. Check the group for schedule updates.");
    } catch { toast.error("The reminder could not be saved. Check Calendar access."); } finally { setBusy(false); }
  }
  async function changeStatus(status: CommunityActivity["status"]) {
    if (!user || !online || !host || busy) return;
    setBusy(true);
    try { await updateDoc(doc(db, "communityGroups", group.id, "activities", activity.id), { status, updatedAt: serverTimestamp(), updatedBy: user.uid }); toast.success(status === "published" ? "Activity published." : "Activity withdrawn."); }
    catch { toast.error("The activity status could not sync."); } finally { setBusy(false); }
  }
  const going = responses.filter(response => response.status === "going" || response.status === "completed");
  return <article className="community-activity-card" data-kind={activity.kind}>
    <div className="flex items-start gap-3"><span className="community-activity-emoji" aria-hidden="true">{meta.emoji}</span><div className="min-w-0 flex-1"><p className="community-activity-kind">{meta.label}{activity.status !== "published" && ` · ${activity.status === "draft" ? "Draft · awaiting coach approval" : "Withdrawn"}`}</p><h3 className="text-lg font-semibold break-words">{activity.title}</h3><p className="text-xs text-muted-foreground mt-2">{activity.kind === "class" ? programmeSchedule(activity.startsAt) : activity.kind === "workout" ? `${activity.durationMinutes} min · ${activity.exercises.length} exercises` : "Shared with your group"}</p></div>{own?.status === "completed" && <CheckCircle2 size={20} className="text-primary shrink-0" aria-label="Marked complete" />}</div>
    {!allowed ? <FeatureNotice feature={meta.feature} /> : <>
      <p className="community-activity-details">{activity.details}</p>
      {!!activity.exercises.length && <ol className="community-exercise-list">{activity.exercises.map((exercise, index) => <li key={index}><span>{index + 1}</span><div><strong>{exercise.name}</strong><small>{exercise.sets} sets × {exercise.reps} reps · {exercise.restSeconds}s rest · {exercise.equipment}</small></div></li>)}</ol>}
      <div className="community-card-actions">
        {canRespond && activity.kind === "workout" && <><Button size="sm" onClick={startWorkout}><Play size={14} />Start workout</Button><Button size="sm" variant="outline" disabled={!online || busy} onClick={() => void saveWorkout()}>Save to training</Button></>}
        {canRespond && activity.kind === "class" && <><Button size="sm" disabled={!online || busy} onClick={() => void respond(own?.status === "going" ? "not_going" : "going")}>{own?.status === "going" ? "Cancel booking" : "Book class"}</Button>{calendar.state === "allowed" && !calendar.loading && !calendar.error && <Button size="sm" variant="outline" disabled={!online || busy} onClick={() => void addToCalendar()}><CalendarPlus size={14} />Add to Calendar</Button>}{activity.meetingUrl && <Button size="sm" variant="outline" asChild><a href={activity.meetingUrl} target="_blank" rel="noopener noreferrer">Open class link<ArrowUpRight size={14} /></a></Button>}</>}
        {canRespond && activity.kind === "challenge" && own?.status !== "joined" && own?.status !== "completed" && <Button size="sm" disabled={!online || busy} onClick={() => void respond("joined")}>Join challenge</Button>}
        {canEdit && <Button size="sm" variant="outline" disabled={!online} onClick={onEdit}><Pencil size={14} />{activity.status === "draft" ? "Improve draft" : "Edit activity"}</Button>}
        {host && active && activity.status !== "published" && <Button size="sm" disabled={!online || busy} onClick={() => void changeStatus("published")}>{activity.status === "draft" ? "Approve & publish" : "Republish"}</Button>}
        {host && active && activity.status === "published" && <Button size="sm" variant="ghost" disabled={!online || busy} onClick={() => void changeStatus("withdrawn")}>Withdraw</Button>}
      </div>
      {activity.kind === "class" && <p className="text-xs text-muted-foreground mt-3">{going.length} booked · {going.slice(0, 4).map(response => response.name).join(", ") || "Be the first to join"}</p>}
      {canRespond && <details className="community-feedback"><summary>Share a group update{own && <span>{own.status === "completed" ? "Completed" : "Update shared"}</span>}</summary><label className="community-field mt-3">Your update to the group<textarea aria-label="Your update to the group" rows={3} maxLength={2000} value={feedback} onChange={event => { setFeedback(event.target.value); setDirty(true); }} placeholder="How did it go? Anything you need help with?" /></label><p className="text-xs text-muted-foreground mt-2">Visible to your group. Use My coach or Support for private details. Completion is self-reported.</p><div className="community-card-actions"><Button size="sm" variant="outline" disabled={!online || busy} onClick={() => void respond(own?.status || (activity.kind === "class" ? "going" : activity.kind === "challenge" ? "joined" : "seen"))}>Share update</Button>{activity.kind !== "announcement" && <Button size="sm" disabled={!online || busy} onClick={() => void respond("completed")}>Mark complete</Button>}</div></details>}
      {!!responses.length && <details className="community-feedback"><summary>Group updates <span>{responses.filter(response => response.feedback || response.status === "completed").length}</span></summary><div className="space-y-3 mt-3">{responses.filter(response => response.feedback || response.status === "completed").map(response => <div key={response.id} className="community-response"><strong>{response.name}</strong><span>{response.status === "completed" ? "Completed" : "Update"}</span>{response.feedback && <p>{response.feedback}</p>}</div>)}</div></details>}
    </>}
  </article>;
}

export default function CommunityActivities({ group, activities, responses, members, host, filter, onFilterChange }: { group: CommunityGroup; activities: CommunityActivity[]; responses: ActivityResponse[]; members: CommunityMember[]; host: boolean; filter: "all" | "class"; onFilterChange: (filter: "all" | "class") => void }) {
  const { user } = useAuth();
  const { getAccess } = useFeatureAccess();
  const online = useOnline();
  const training = getAccess("training");
  const member = members.find(item => item.id === user?.uid);
  const [editor, setEditor] = useState<CommunityActivity | "new" | null>(null);
  const visible = activities.filter(activity => (host || activity.status !== "withdrawn") && (filter === "all" || activity.kind === "class"));
  const canCreate = group.status === "active" && (host || (member && training.state === "allowed" && !training.loading && !training.error));
  return <section className="community-activities"><div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div className="community-filter"><button className={filter === "all" ? "is-active" : ""} onClick={() => onFilterChange("all")}>All activities</button><button className={filter === "class" ? "is-active" : ""} onClick={() => onFilterChange("class")}>Classes</button></div>{canCreate && <Button size="sm" disabled={!online} onClick={() => setEditor("new")}><Plus size={14} />{host ? "Share activity" : "Create shared workout"}</Button>}</div>
    <div className="space-y-4">{visible.map(activity => <ActivityCard key={activity.id} group={group} activity={activity} responses={responses.filter(response => response.activityId === activity.id)} member={member} host={host} onEdit={() => setEditor(activity)} />)}{!visible.length && <p className="community-info">{filter === "class" ? "Your coach’s classes will appear here." : "A fresh start. Share a workout draft or wait for your coach’s next activity."}</p>}</div>
    {editor && <ActivityEditor group={group} activity={editor === "new" ? undefined : editor} host={host} onClose={() => setEditor(null)} />}
  </section>;
}
