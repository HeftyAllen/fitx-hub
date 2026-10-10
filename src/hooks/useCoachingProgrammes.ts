import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseProgramme, type CoachingProgramme, type ProgrammeResponse } from "@/lib/coaching";

export function useCoachingProgrammes(assignmentId: string | undefined, team = false) {
  const [programmes, setProgrammes] = useState<CoachingProgramme[]>([]);
  const [responses, setResponses] = useState<ProgrammeResponse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [programmeError, setProgrammeError] = useState("");
  const [responseError, setResponseError] = useState("");
  useEffect(() => {
    setProgrammes([]); setResponses([]); setLoaded(false); setProgrammeError(""); setResponseError("");
    if (!assignmentId) return;
    const stops = [onSnapshot(query(collection(db, "coachAssignments", assignmentId, "programmes"), ...(team ? [] : [where("status", "==", "published")])), snap => {
      setProgrammes(snap.docs.flatMap(doc => { const programme = parseProgramme(doc.id, doc.data()); return programme ? [programme] : []; }));
      setLoaded(true);
      setProgrammeError("");
    }, () => { setProgrammes([]); setLoaded(true); setProgrammeError("Shared programmes could not load. Check your connection or coaching access."); }),
    onSnapshot(collection(db, "coachAssignments", assignmentId, "responses"), snap => {
      setResponses(snap.docs.flatMap(doc => {
        const data = doc.data();
        return (data.status === "seen" || data.status === "completed") && typeof data.feedback === "string" ? [{ id: doc.id, status: data.status, feedback: data.feedback }] : [];
      }));
      setResponseError("");
    }, () => { setResponses([]); setResponseError("Member updates could not load. Check your connection or coaching access."); })];
    return () => stops.forEach(stop => stop());
  }, [assignmentId, team]);
  return { programmes, responses, loaded, error: programmeError || responseError };
}
