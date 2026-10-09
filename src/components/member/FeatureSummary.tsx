import { Link } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { featureDefinition, type FeatureId } from "@/lib/feature-access";
export default function FeatureSummary({ feature }: { feature: FeatureId }) {
  const { config, getAccess } = useFeatureAccess();
  const access = getAccess(feature);
  if (access.state === "disabled") return null;
  const label = config.features[feature].label || featureDefinition(feature).label;
  return <section className="member-card p-6 flex flex-col justify-between gap-5"><div><span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4"><LockKeyhole size={19} /></span><h2 className="member-panel-title">{label}</h2><p className="text-xs text-muted-foreground mt-3">{access.loading ? "Checking your access…" : access.error || access.policy.message || `Add ${label.toLowerCase()} to your journey with an active membership.`}</p></div><Link to={`/membership?feature=${feature}`} className="member-action secondary">View membership<ArrowRight size={14} /></Link></section>;
}
