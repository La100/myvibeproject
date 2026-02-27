"use client";

import { Suspense } from "react";
import { BellRing } from "lucide-react";
import { ProjectChangelog, ProjectChangelogSkeleton } from "../components/ProjectChangelog";
import { ProjectClientNotifications } from "../components/ProjectClientNotifications";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

export default function ChangelogPage() {
  return (
    <Suspense fallback={<ProjectChangelogSkeleton />}>
      <ProjectPageLayout>
        <div className="space-y-7">
          <ProjectPageHeader
            title="Notifications"
            icon={<BellRing className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
            subtitle="Client responses and full project activity history."
          />
          <ProjectClientNotifications showHeader={false} />
          <ProjectChangelog showHeader={false} />
        </div>
      </ProjectPageLayout>
    </Suspense>
  );
}
