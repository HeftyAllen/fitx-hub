import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, doc, onSnapshot, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import { Dumbbell, UtensilsCrossed, Video, ArrowUpRight, CheckCircle2, MessageSquare, Play, Users, CalendarDays, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { useOnline } from "@/hooks/useOnline";
import { useCoachingProgrammes } from "@/hooks/useCoachingProgrammes";
import { loadWorkoutDraft } from "@/lib/offline/drafts";
import { programmeKinds, programmeSchedule, programmeWorkout, type CoachAssignment, type CoachingProgramme, type ProgrammeResponse } from "@/lib/coaching";
import AppLayout from "@/components/layout/AppLayout";
import MemberPageHeader from "@/components/member/MemberPageHeader";
import { FeatureNotice } from "@/components/member/FeatureGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const icons = { workout: Dumbbell, class: Video, nutrition: UtensilsCrossed };
function MemberProgramme({ assignment, programme, response }: { assignment: CoachAssignment; programme: CoachingProgramme; response?: ProgrammeResponse }) {
  const { user } = useAuth();
  const { getAccess } = useFeatureAccess();
  const online = useOnline();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(response?.feedback || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = programmeKinds[programme.kind]; const Icon = icons[programme.kind];
  const access = getAccess(meta.feature);
  const allowed = access.state === "allowed" && !access.loading && !access.error;
  useEffect(() => { if (!dirty) setFeedback(response?.feedback || ""); }, [response?.feedback, dirty]);
  async function sendUpdate(status: "seen" | "completed") {
    if (!user || !online || !allowed || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "coachAssignments", assignment.id, "responses", programme.id), { memberId: user.uid, status, feedback: feedback.trim(), updatedAt: serverTimestamp() });
      setDirty(false); toast.success("Your update was shared with your coach.");
    } catch { toast.error("Your update could not sync. Check your connection or coaching access and try again."); }
    finally { setSaving(false); }
  }
  function startWorkout() {
    if (!user || !allowed) return;
    const draft = loadWorkoutDraft(user.uid);
    const plan = programmeWorkout(assignment.id, programme);
    if (draft && draft.plan.id !== plan.id) { toast.info("You have a saved workout. Resume or discard it in Training before starting another."); navigate("/workout-planner"); return; }
    navigate("/workout-session", draft ? undefined : { state: { plan } });
  }
  async function saveWorkout() {
    if (!user || !allowed || !online || saving) return;
    setSaving(true);
    try {
      const plan = programmeWorkout(assignment.id, programme);
      await setDoc(doc(db, "users", user.uid, "workoutPlans", plan.id), { ...plan, createdAt: serverTimestamp() }, { merge: true });
      toast.success("Added to your training plans.");
    } catch { toast.error("This workout could not be added. Check your connection and training access."); }
    finally { setSaving(false); }
  }
  return <article className="member-card coach-shared-card p-5 sm:p-6" data-tone={meta.tone}>
    <div className="flex gap-3 items-start mb-4"><span className="member-tone-icon"><Icon size={20} /></span><div className="min-w-0 flex-1"><p className="text-[10px] member-tone-text font-semibold mb-1">{meta.label}</p><h3 className="text-lg font-semibold break-words">{programme.title}</h3><p className="text-xs text-muted-foreground mt-2 flex gap-1.5 items-center"><CalendarDays size={13} />{programmeSchedule(programme.startsAt)}{programme.kind !== "nutrition" && ` · ${programme.durationMinutes} min`}</p></div>{response?.status === "completed" && <CheckCircle2 size={20} className="text-primary shrink-0" aria-label="Marked complete" />}</div>
    {!allowed ? <FeatureNotice feature={meta.feature} /> : <>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{programme.details}</p>
      {programme.exercises.length > 0 && <ol className="coach-member-exercises">{programme.exercises.map((exercise, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><strong>{exercise.name}</strong><small>{exercise.sets} sets × {exercise.reps} reps · {exercise.restSeconds}s rest · {exercise.equipment}</small></div></li>)}</ol>}
      <div className="flex flex-wrap gap-2 mt-5">
        {programme.exercises.length > 0 && <><Button className="workout-primary-button" onClick={startWorkout}><Play size={15} />Start workout</Button><Button variant="outline" className="gap-1.5 text-xs" onClick={saveWorkout} disabled={!online || saving}><Plus size={14} />Save to training</Button></>}
        {programme.kind === "class" && programme.meetingUrl && <Button asChild variant="outline" className="gap-1.5 text-xs"><a href={programme.meetingUrl} target="_blank" rel="noopener noreferrer">Open class link<ArrowUpRight size={14} /></a></Button>}
      </div>
      <details className="coach-feedback-box mt-5">
        <summary><MessageSquare size={15} /><span>Update your coach</span><span className="ml-auto text-[10px] text-muted-foreground">{response?.status === "completed" ? "Complete" : response ? "Seen" : "No update yet"}</span></summary>
        <div className="pt-4 space-y-3"><label htmlFor={`feedback-${programme.id}`} className="text-xs font-semibold block">How is this programme going?</label><Textarea id={`feedback-${programme.id}`} maxLength={2000} value={feedback} onChange={event => { setFeedback(event.target.value); setDirty(true); }} placeholder="What worked, what felt difficult, or a question for your coach…" />
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!online || saving} onClick={() => sendUpdate(response?.status || "seen")}>Share update</Button><Button size="sm" className="gap-1.5" disabled={!online || saving} onClick={() => sendUpdate(response?.status === "completed" ? "seen" : "completed")}><CheckCircle2 size={14} />{response?.status === "completed" ? "Reopen programme" : "Mark complete"}</Button></div><p className="text-[10px] text-muted-foreground">Your assigned coach sees your update. Completion is recorded when you mark it here.</p>
        </div>
      </details>
    </>}
  </article>;
}

function MemberCoachProgrammes({ assignment }: { assignment: CoachAssignment }) {
  const { programmes, responses, loaded, error } = useCoachingProgrammes(assignment.id);
  return <section className="space-y-4">
    <div className="member-preview-banner"><p className="text-sm font-semibold">{assignment.coachName || "Your assigned coach"}</p><p className="text-xs text-muted-foreground mt-1">{assignment.goal || "Build your next milestone together."}</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!loaded && <p className="text-sm text-muted-foreground">Loading your programmes…</p>}
    {loaded && !error && !programmes.length && <div className="member-card p-8 text-center"><Dumbbell size={28} className="text-primary mx-auto mb-3" /><h2 className="text-lg font-semibold">Your next plan starts here.</h2><p className="text-sm text-muted-foreground mt-2">Your coach's home workouts, classes and nutrition guidance will appear here when shared.</p></div>}
    {programmes.map(programme => <MemberProgramme key={programme.id} assignment={assignment} programme={programme} response={responses.find(response => response.id === programme.id)} />)}
  </section>;
}

export default function MyCoach() {
  const { user } = useAuth();
  const online = useOnline();
  const [assignments, setAssignments] = useState<CoachAssignment[]>([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setAssignments([]); setLoaded(false); setError("");
    if (!user) return;
    return onSnapshot(query(collection(db, "coachAssignments"), where("memberId", "==", user.uid), where("status", "==", "active")), snap => {
      const rows = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as CoachAssignment);
      setAssignments(rows); setSelected(previous => rows.some(row => row.id === previous) ? previous : rows[0]?.id || ""); setLoaded(true); setError("");
    }, () => { setAssignments([]); setLoaded(true); setError("Your coaching connection could not load. Check your connection or ask your administrator to check coaching access."); });
  }, [user]);
  const assignment = assignments.find(row => row.id === selected);
  return <AppLayout><div className="max-w-4xl mx-auto px-4 md:px-7 py-6 pb-12 space-y-6">
    <MemberPageHeader eyebrow="Together, even between sessions" title="Your coach. Your next step." description="Home workouts, gym or online classes, and nutrition guidance shared with you. Keep your coach updated as you go." actions={<Link to="/library" className="member-action secondary">Explore the coach library<ArrowUpRight size={14} /></Link>} />
    {!online && <p className="member-preview-banner text-xs">Viewing saved coaching information offline. Reconnect to share an update or save a plan. Saved workouts can still be resumed in Training.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!loaded && <p className="text-sm text-muted-foreground">Finding your coaching connection…</p>}
    {assignments.length > 1 && <label className="coach-field-label block">Your coach<select className="mt-2 w-full p-3 bg-card border border-border rounded-xl" value={selected} onChange={event => setSelected(event.target.value)}>{assignments.map(row => <option key={row.id} value={row.id}>{row.coachName || "Assigned coach"} · {row.goal || row.memberName}</option>)}</select></label>}
    {assignment && <MemberCoachProgrammes key={assignment.id} assignment={assignment} />}
    {loaded && !error && !assignments.length && <div className="member-card p-8 text-center"><span className="member-tone-icon mx-auto mb-4" data-tone="violet"><Users size={23} /></span><h2 className="text-xl font-semibold">A little support goes a long way.</h2><p className="text-sm text-muted-foreground max-w-md mx-auto mt-3">Once an administrator connects you with a coach, your shared programmes and classes will appear here.</p><Link to="/support" className="member-action mt-5">Ask about coaching<ArrowUpRight size={14} /></Link></div>}
  </div></AppLayout>;
}
