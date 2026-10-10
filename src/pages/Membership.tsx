import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, ArrowUpRight, Sparkles, BellRing, Zap, Heart } from "lucide-react";
import { deleteField, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import MemberPageHeader from "@/components/member/MemberPageHeader";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { db } from "@/lib/firebase";
import { allAvailableFeaturesFree, expiryMillis, membershipInterestPlan, planFeatures, type PlanId } from "@/lib/feature-access";

export default function Membership() {
  const { config, member, fromCache, loading, error } = useFeatureAccess();
  const { user, userProfile } = useAuth();
  const online = useOnline();
  const [saving, setSaving] = useState(false);
  const expires = expiryMillis(member.expiresAt);
  const activePlan = expires !== null && expires <= Date.now() ? "free" : member.plan;
  const nameOf = (plan: PlanId) => plan === "free" ? "Free" : plan === "plus" ? config.membership.plusName : config.membership.proName;
  const allFree = allAvailableFeaturesFree(config);
  const interest = membershipInterestPlan(userProfile?.membershipInterest);
  const plans: PlanId[] = allFree && !config.membership.showFuturePlans ? ["free"] : ["free", "plus", "pro"];

  async function saveInterest(plan: "plus" | "pro" | null) {
    if (!user || !online || saving) return;
    setSaving(true);
    try {
      const value = plan ? { plan, createdAt: serverTimestamp() } : deleteField();
      const batch = writeBatch(db);
      batch.set(doc(db, "users", user.uid, "profile", "data"), { membershipInterest: value }, { merge: true });
      batch.set(doc(db, "users", user.uid), { membershipInterest: value }, { merge: true });
      await batch.commit();
      toast.success(plan ? `Interest in ${nameOf(plan)} saved. Your current access stays the same.` : "Plan interest removed");
    } catch {
      toast.error("Your interest could not be saved. Please try again.");
    } finally { setSaving(false); }
  }

  return <AppLayout><div className="max-w-6xl mx-auto px-4 md:px-7 space-y-7 member-content-stagger">
    <MemberPageHeader eyebrow="Your membership" title={config.membership.paywallTitle} description={config.membership.paywallDescription} />
    {loading ? <p role="status" className="text-sm text-muted-foreground">Loading membership settings…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <>
      <div className="member-membership-banner p-5 sm:p-6 flex items-start gap-4"><span className="member-tone-icon" data-tone="mint"><Heart size={22} /></span><div><p className="font-semibold text-lg">{allFree ? "Everything available today is free." : `Your current membership: ${nameOf(activePlan)}`}</p><p className="text-sm text-muted-foreground mt-1">{allFree ? "Train, log your food, track your progress and explore every enabled tool on the Free plan. No payment needed." : "See the tools included in each plan below. Your saved data stays with your account."}</p>{expires !== null && expires > Date.now() && <p className="text-xs mt-2">{nameOf(activePlan)} access until {new Date(expires).toLocaleDateString()}.</p>}{fromCache && <p className="text-xs text-muted-foreground mt-2">Showing last verified settings from this device.</p>}</div></div>
      <div className={`grid ${plans.length > 1 ? "md:grid-cols-3" : "max-w-xl"} gap-5 items-stretch`}>
        {plans.map(plan => {
          const future = allFree && plan !== "free";
          const included = planFeatures(config, plan);
          const extras = plan === "plus" ? config.membership.plusRoadmap : config.membership.proRoadmap;
          const Icon = plan === "free" ? Heart : plan === "plus" ? Zap : Crown;
          return <section key={plan} aria-label={`${nameOf(plan)} plan`} data-plan={plan} className={`member-plan-card member-card p-6 flex flex-col ${plan === activePlan ? "is-current" : ""}`}>
            <div className="flex items-center justify-between gap-2"><span className="member-tone-icon" data-tone={plan === "free" ? "mint" : plan === "plus" ? "violet" : "amber"}><Icon size={21} /></span><span className="member-plan-badge">{future ? "Coming soon" : plan === activePlan ? "Your current plan" : "Available plan"}</span></div>
            <h2 className="text-2xl font-semibold mt-5">{nameOf(plan)}</h2>
            <p className="text-2xl font-semibold mt-3">{plan === "free" ? "R0" : plan === "plus" ? config.membership.plusPrice : config.membership.proPrice}</p>
            <p className="text-xs text-muted-foreground mt-2 mb-6">{plan === "free" ? allFree ? "All current tools. Free for now." : "Your essential everyday tools." : future ? "Planned price · No charge today" : "Displayed price · Access confirmed by our team"}</p>
            <p className="text-xs font-semibold mb-3">{future ? "Planned extras" : "Included today"}</p>
            <ul className="space-y-3 mb-6 flex-1">{future ? extras.split("\n").map(line => line.trim()).filter(Boolean).map((line, index) => <li key={index} className="flex gap-2 text-xs leading-relaxed"><Sparkles size={15} className="member-plan-accent shrink-0" />{line}</li>) : <><li className="flex gap-2 text-xs"><Check size={15} className="member-plan-accent shrink-0" />Profile, Today & support</li>{included.map(feature => <li key={feature.id} className="flex gap-2 text-xs"><Check size={15} className="member-plan-accent shrink-0" />{config.features[feature.id].label || feature.label}</li>)}</>}</ul>
            {future ? <><p className="text-xs text-muted-foreground mb-4">Current tools stay in Free. These extras are planned for a future release.</p><button disabled={!online || saving} onClick={() => saveInterest(plan as "plus" | "pro")} className="member-action secondary w-full" aria-pressed={interest === plan}><BellRing size={15} />{saving ? "Saving…" : interest === plan ? "Interest saved" : `Notify me about ${nameOf(plan)}`}</button></> : plan === "free" || plan === activePlan ? <div className="member-plan-footer text-xs"><Check size={15} />{plan === activePlan ? "You're on this plan" : "Included with your account"}</div> : config.membership.upgradeUrl ? <a href={config.membership.upgradeUrl} target="_blank" rel="noopener noreferrer" className="member-action w-full">{config.membership.upgradeLabel}<ArrowUpRight size={15} /></a> : <Link to="/support" className="member-action w-full">Ask about {nameOf(plan)}</Link>}
          </section>;
        })}
      </div>
      {interest && <div className="member-card p-4 flex flex-wrap items-center justify-between gap-3" role="status"><p className="text-xs text-muted-foreground">You've registered interest in {nameOf(interest)}. This does not start a subscription or change your access.</p><button onClick={() => saveInterest(null)} disabled={!online || saving} className="text-xs font-semibold text-primary">Remove my interest</button></div>}
      {!online && <p role="status" className="text-xs text-muted-foreground">Reconnect to save or update plan interest.</p>}
      <p className="text-xs text-muted-foreground pb-6">{allFree ? "Future plans are previews, not active subscriptions. Launch details and final pricing will be confirmed before paid plans open." : "Membership changes appear when confirmed by our team. Opening a membership link does not change your access."}</p>
    </>}
  </div></AppLayout>;
}
