"use client";

import { Suspense } from "react";
import { BellRing } from "lucide-react";
import { ProjectChangelog, ProjectChangelogLoading } from "../components/ProjectChangelog";
import { ProjectClientNotifications } from "../components/ProjectClientNotifications";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

export default function ChangelogPage() {
  return (
    <Suspense fallback={<ProjectChangelogLoading />}>
      <ProjectPageLayout>
        <div className="flex flex-col gap-7">
          <ProjectPageHeader
            title="Notifications"
            icon={<BellRing className="h-8 w-8 text-primary" />}
          />
          <ProjectClientNotifications showHeader={false} />
          <ProjectChangelog showHeader={false} />
        </div>
      </ProjectPageLayout>
    </Suspense>
  );
}
