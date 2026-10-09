import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LockKeyhole, PauseCircle, ShieldAlert } from "lucide-react";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { featureDefinition, type FeatureId } from "@/lib/feature-access";
import AppLayout from "@/components/layout/AppLayout";
export function FeatureNotice({ feature }: { feature: FeatureId }) {
  const { getAccess, config } = useFeatureAccess();
  const access = getAccess(feature);
  const definition = featureDefinition(feature);
  const policyName = access.policy.label || featureDefinition(access.feature).label;
  const disabled = access.state === "disabled";
  const plan = access.policy.requiredPlan === "pro" ? config.membership.proName : config.membership.plusName;
  if (access.loading) return <div className="member-card p-10 text-center" role="status">Checking feature access…</div>;
  return <section className="member-card p-7 sm:p-10 max-w-2xl mx-auto text-center space-y-5" aria-label={`${definition.label} access`}>
    <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto">{access.error ? <ShieldAlert size={25} /> : disabled ? <PauseCircle size={25} /> : <LockKeyhole size={25} />}</span>
    <p className="member-eyebrow">{access.error ? "Check your connection" : disabled ? "Taking a little pause" : `${plan} membership`}</p>
    <h1 className="member-page-title">{access.error ? "We couldn't verify access." : disabled ? `${policyName} is currently unavailable.` : config.membership.paywallTitle}</h1>
    <p className="text-sm text-muted-foreground leading-relaxed">{access.error || access.policy.message || (disabled ? "Your saved records are kept safely. This section will return when our team enables it." : config.membership.paywallDescription)}</p>
    {!disabled && !access.error && <p className="text-xs text-primary">{definition.label} is included with {plan}.</p>}
    <div className="flex justify-center flex-wrap gap-3">
      {!disabled && !access.error && <Link to={`/membership?feature=${feature}`} className="member-action">View membership<ArrowRight size={15} /></Link>}
      <Link to="/dashboard" className="member-action secondary">Back to Today</Link>
      <Link to="/support" className="member-action secondary">Contact support</Link>
    </div>
  </section>;
}
export default function FeatureGate({ feature, children, inline = false }: { feature: FeatureId; children: ReactNode; inline?: boolean }) {
  const { getAccess } = useFeatureAccess();
  const access = getAccess(feature);
  if (access.state === "allowed" && !access.loading && !access.error) return <>{children}</>;
  const notice = <FeatureNotice feature={feature} />;
  return inline ? notice : <AppLayout><div className="px-4 md:px-8 py-8">{notice}</div></AppLayout>;
}
