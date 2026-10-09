import { Link } from "react-router-dom";
import { Check, Crown, ArrowUpRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import MemberPageHeader from "@/components/member/MemberPageHeader";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { FEATURES, expiryMillis } from "@/lib/feature-access";
export default function Membership() {
  const { config, member, fromCache } = useFeatureAccess();
  const expires = expiryMillis(member.expiresAt);
  const activePlan = expires !== null && expires <= Date.now() ? "free" : member.plan;
  const planName = activePlan === "free" ? "Free" : activePlan === "plus" ? config.membership.plusName : config.membership.proName;
  return <AppLayout><div className="max-w-5xl mx-auto px-4 md:px-7 space-y-7">
    <MemberPageHeader eyebrow="Your membership" title={config.membership.paywallTitle} description={config.membership.paywallDescription} />
    <div className="member-card p-5 flex items-center gap-4"><span className="p-3 bg-primary/10 rounded-xl text-primary"><Crown size={22} /></span><div><p className="font-semibold">Current membership: {planName}</p><p className="text-xs text-muted-foreground mt-1">{expires !== null && expires > Date.now() ? `Access until ${new Date(expires).toLocaleDateString()}.` : "Your account and saved records stay with you."}{fromCache ? " Showing last verified settings from this device." : ""}</p></div></div>
    <div className="grid md:grid-cols-3 gap-5">
      {(["free", "plus", "pro"] as const).map(plan => {
        const included = FEATURES.filter(feature => {
          const policy = config.features[feature.id];
          const parent = "parent" in feature ? config.features[feature.parent] : null;
          if (policy.mode === "disabled" || parent?.mode === "disabled") return false;
          return (policy.mode === "free" || (plan !== "free" && (policy.requiredPlan !== "pro" || plan === "pro"))) && (!parent || parent.mode === "free" || (plan !== "free" && (parent.requiredPlan !== "pro" || plan === "pro")));
        });
        const name = plan === "free" ? "Free" : plan === "plus" ? config.membership.plusName : config.membership.proName;
        const price = plan === "free" ? "Included" : plan === "plus" ? config.membership.plusPrice : config.membership.proPrice;
        return <section key={plan} className={`member-card p-6 flex flex-col ${plan === activePlan ? "ring-2 ring-primary/50" : ""}`}>
          <p className="member-eyebrow">{plan === activePlan ? "Your current plan" : "Membership"}</p><h2 className="text-2xl font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground mt-3 mb-6">{price || "Ask us for pricing"}</p>
          <ul className="space-y-3 mb-6 flex-1"><li className="flex gap-2 text-xs"><Check size={15} className="text-primary shrink-0" />Profile, dashboard & support</li>{included.map(feature => <li key={feature.id} className="flex gap-2 text-xs"><Check size={15} className="text-primary shrink-0" />{config.features[feature.id].label || feature.label}</li>)}</ul>
          {plan !== "free" && plan !== activePlan && (config.membership.upgradeUrl ? <a href={config.membership.upgradeUrl} target="_blank" rel="noopener noreferrer" className="member-action">{config.membership.upgradeLabel}<ArrowUpRight size={15} /></a> : <Link to="/support" className="member-action">Ask about {name}</Link>)}
        </section>;
      })}
    </div>
    <p className="text-xs text-muted-foreground pb-6">Membership changes appear here when confirmed by our team. Opening a membership link does not change your access.</p>
  </div></AppLayout>;
}
