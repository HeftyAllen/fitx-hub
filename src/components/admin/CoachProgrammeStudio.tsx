import { useState } from "react";
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { Dumbbell, UtensilsCrossed, Video, Plus, X, Send, CalendarDays, CheckCircle2, MessageSquare, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { useCoachingProgrammes } from "@/hooks/useCoachingProgrammes";
import { emptyCoachingExercise, programmeKinds, programmeSchedule, programmeSchema, type CoachAssignment, type CoachingExercise, type ProgrammeKind } from "@/lib/coaching";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const programmeIcons = { workout: Dumbbell, class: Video, nutrition: UtensilsCrossed };

export default function CoachProgrammeStudio({ assignment, assignments }: { assignment: CoachAssignment; assignments: CoachAssignment[] }) {
  const { user } = useAuth();
  const online = useOnline();
  const { programmes, responses, loaded, error } = useCoachingProgrammes(assignment.id, true);
  const [kind, setKind] = useState<ProgrammeKind>("workout");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [exercises, setExercises] = useState<CoachingExercise[]>([emptyCoachingExercise()]);
  const [duration, setDuration] = useState(30);
  const [startsAt, setStartsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [recipients, setRecipients] = useState([assignment.id]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const activeClients = assignments.filter(client => client.status === "active");
  const liveProgrammes = programmes.filter(programme => programme.status === "published");

  function updateExercise(index: number, patch: Partial<CoachingExercise>) {
    setExercises(prev => prev.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise));
  }
  async function shareProgramme() {
    if (!user || !online || saving || assignment.status !== "active") return;
    const recipientsNow = activeClients.filter(client => recipients.includes(client.id));
    if (!recipientsNow.length || recipientsNow.length > 10) { setFormError("Choose between one and 10 active members per programme."); return; }
    const date = startsAt ? new Date(startsAt) : null;
    const parsed = programmeSchema.safeParse({ title, kind, details, exercises: kind === "nutrition" ? [] : exercises.filter(exercise => exercise.name.trim()), durationMinutes: duration,
      startsAt: kind === "class" && date && !Number.isNaN(date.getTime()) ? date.toISOString() : "", meetingUrl: kind === "class" ? meetingUrl : "" });
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setSaving(true); setFormError("");
    try {
      const id = doc(collection(db, "coachAssignments", assignment.id, "programmes")).id;
      const batch = writeBatch(db);
      for (const client of recipientsNow) batch.set(doc(db, "coachAssignments", client.id, "programmes", id), { ...parsed.data, status: "published", createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await batch.commit();
      setTitle(""); setDetails(""); setExercises([emptyCoachingExercise()]); setStartsAt(""); setMeetingUrl("");
      toast.success(`Shared with ${recipientsNow.length} member${recipientsNow.length === 1 ? "" : "s"}.`);
    } catch { setFormError("This programme could not sync. Check your connection and coaching access, then try again."); }
    finally { setSaving(false); }
  }
  async function withdraw(id: string) {
    if (!online || saving) return;
    setSaving(true);
    try { await updateDoc(doc(db, "coachAssignments", assignment.id, "programmes", id), { status: "withdrawn", updatedAt: serverTimestamp() }); toast.success("Programme withdrawn for this member."); }
    catch { toast.error("Could not withdraw this programme."); }
    finally { setSaving(false); }
  }

  return <section className="coach-programme-studio" aria-labelledby="shared-programmes-title">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><p className="member-eyebrow !mb-1">Stay connected between sessions</p><h3 id="shared-programmes-title" className="text-lg font-semibold">Shared programmes</h3><p className="text-xs text-muted-foreground mt-2">Members see these in My coach. Their updates appear here as they sync.</p></div>
      <span className="coach-sync-badge"><CheckCircle2 size={13} />{liveProgrammes.length} shared</span>
    </div>
    {error && <p role="alert" className="text-xs text-destructive mb-4">{error}</p>}
    {!loaded && <p className="text-xs text-muted-foreground mb-4">Loading shared programmes…</p>}
    <div className="space-y-3 mb-5">
      {liveProgrammes.map(programme => {
        const meta = programmeKinds[programme.kind]; const Icon = programmeIcons[programme.kind];
        const response = responses.find(response => response.id === programme.id);
        return <article key={programme.id} className="coach-shared-card" data-tone={meta.tone}>
          <div className="flex items-start gap-3"><span className="member-tone-icon !w-9 !h-9"><Icon size={17} /></span><div className="flex-1 min-w-0"><p className="text-[10px] member-tone-text mb-1">{meta.label}</p><h4 className="text-sm font-semibold break-words">{programme.title}</h4>
            <p className="text-[11px] text-muted-foreground mt-1">{programme.kind === "class" ? programmeSchedule(programme.startsAt) : programme.kind === "nutrition" ? "Meals & daily guidance" : `${programme.exercises.length} exercises · ${programme.durationMinutes} min`}</p></div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Withdraw ${programme.title}`} title="Withdraw for this member" disabled={!online || saving} onClick={() => withdraw(programme.id)}><EyeOff size={14} /></Button></div>
          <div className="coach-response-line"><span className={response?.status === "completed" ? "text-primary" : "text-muted-foreground"}>{response?.status === "completed" ? "Member marked complete" : response ? "Seen by member" : "Awaiting member update"}</span></div>
          {response?.feedback && <p className="coach-member-feedback"><MessageSquare size={14} /><span className="whitespace-pre-wrap">{response.feedback}</span></p>}
        </article>;
      })}
      {loaded && !error && !liveProgrammes.length && <p className="text-xs text-muted-foreground">No programme shared with this member yet.</p>}
    </div>

    {assignment.status === "active" && <details className="coach-compose" open={liveProgrammes.length === 0}>
      <summary><Plus size={16} />Create a programme<span className="text-[10px] text-muted-foreground ml-auto">Workout · Class · Nutrition</span></summary>
      <div className="space-y-4 pt-5">
        <div className="coach-kind-picker" aria-label="Programme type">{(Object.keys(programmeKinds) as ProgrammeKind[]).map(value => {
          const meta = programmeKinds[value]; const Icon = programmeIcons[value];
          return <button type="button" key={value} aria-pressed={kind === value} data-tone={meta.tone} onClick={() => { setKind(value); setFormError(""); }}><Icon size={18} /><span>{meta.label}</span></button>;
        })}</div>
        <label className="coach-field-label">Programme title<Input className="mt-1.5" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder={kind === "nutrition" ? "e.g. A balanced week of meals" : kind === "class" ? "e.g. Saturday strength from home" : "e.g. Your 30-minute home routine"} /></label>
        <label className="coach-field-label">{kind === "nutrition" ? "Meals, portions & daily guidance" : "Instructions & what to bring"}<Textarea className="mt-1.5 min-h-24" value={details} onChange={event => setDetails(event.target.value)} maxLength={10000} placeholder={kind === "nutrition" ? "Write the meals, portions, swaps and daily habits agreed with your member…" : "Warm-up, technique cues, equipment and any modifications…"} /></label>
        {kind !== "nutrition" && <div className="space-y-3">
          <div className="flex justify-between items-center"><h4 className="text-xs font-semibold">Exercises{kind === "class" ? " (optional)" : ""}</h4><Button variant="outline" size="sm" disabled={exercises.length >= 20} onClick={() => setExercises(prev => [...prev, emptyCoachingExercise()])} className="text-[11px] gap-1"><Plus size={13} />Add exercise</Button></div>
          {exercises.map((exercise, index) => <div key={index} className="coach-exercise-builder">
            <div className="flex gap-2"><label className="coach-field-label flex-1">Exercise {index + 1}<Input className="mt-1" value={exercise.name} onChange={event => updateExercise(index, { name: event.target.value })} maxLength={120} placeholder="e.g. Bodyweight squat" /></label><Button variant="ghost" size="icon" className="self-end shrink-0" aria-label={`Remove exercise ${index + 1}`} onClick={() => setExercises(prev => prev.filter((_, i) => i !== index))}><X size={15} /></Button></div>
            <div className="grid grid-cols-3 gap-2 mt-3">{([{ key: "sets", label: "Sets", min: 1, max: 10 }, { key: "reps", label: "Reps", min: 1, max: 100 }, { key: "restSeconds", label: "Rest (sec)", min: 0, max: 600 }] as const).map(field => <label className="coach-field-label" key={field.key}>{field.label}<Input className="mt-1" type="number" min={field.min} max={field.max} aria-label={`${field.label} for exercise ${index + 1}`} value={exercise[field.key]} onChange={event => updateExercise(index, { [field.key]: Number(event.target.value) })} /></label>)}</div>
            <label className="coach-field-label block mt-3">Equipment<Input className="mt-1" value={exercise.equipment} onChange={event => updateExercise(index, { equipment: event.target.value })} maxLength={80} /></label>
          </div>)}
          <label className="coach-field-label flex items-center gap-3">Session length<Input className="w-20" type="number" min={5} max={180} value={duration} onChange={event => setDuration(Number(event.target.value))} aria-label="Session length in minutes" /><span className="text-muted-foreground">minutes</span></label>
        </div>}
        {kind === "class" && <div className="grid sm:grid-cols-2 gap-3"><label className="coach-field-label">Class date & time<Input className="mt-1.5" type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label className="coach-field-label">Online class link (optional)<Input className="mt-1.5" type="url" value={meetingUrl} onChange={event => setMeetingUrl(event.target.value)} placeholder="https://…" maxLength={1000} /></label><p className="text-[10px] text-muted-foreground sm:col-span-2 flex items-center gap-1.5"><CalendarDays size={12} />Times use your device's time zone. Members see their local time.</p></div>}
        <fieldset className="coach-recipients"><legend className="coach-field-label">Share with assigned members</legend><p className="text-[10px] text-muted-foreground mt-1">Choose up to 10 members for each publication.</p><div className="flex flex-wrap gap-2 mt-2">{activeClients.map(client => <label key={client.id} className="coach-recipient"><input type="checkbox" checked={recipients.includes(client.id)} onChange={event => setRecipients(prev => event.target.checked ? [...prev, client.id] : prev.filter(id => id !== client.id))} />{client.memberName}</label>)}</div></fieldset>
        {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
        <Button className="workspace-button w-full gap-2" disabled={!online || saving || !recipients.length} onClick={shareProgramme}><Send size={15} />{saving ? "Sharing…" : "Share programme"}</Button>
      </div>
    </details>}
  </section>;
}
