import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useFeatureAccess } from "@/contexts/FeatureAccessContext";
import { featureForPath } from "@/lib/feature-access";
export default function MemberPageHeader({ eyebrow, title, description, actions, children }: {
  eyebrow: string; title: string; description: string; actions?: ReactNode; children?: ReactNode;
}) {
  const { pathname } = useLocation();
  const { config } = useFeatureAccess();
  const feature = pathname === "/coaching" ? undefined : featureForPath(pathname);
  const displayTitle = feature ? config.features[feature].label || title : title;
  return <header className="member-page-header">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
      <div className="min-w-0"><p className="member-eyebrow">{eyebrow}</p><h1 className="member-page-title">{displayTitle}</h1><p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">{description}</p></div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
    {children && <div className="mt-6">{children}</div>}
  </header>;
}
