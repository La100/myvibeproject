"use client";

import { BellRing } from "lucide-react";
import { OrganizationClientNotifications } from "@/components/company/OrganizationClientNotifications";
import { OrganizationChangelog } from "@/components/company/OrganizationChangelog";
import { useI18n } from "@/lib/i18n";

export default function OrganizationNotificationsPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <BellRing className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("organizationNotifications", "title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground lg:text-base">
          {t("organizationNotifications", "pageDescription")}
        </p>
      </div>
      <OrganizationClientNotifications showHeader={false} />
      <OrganizationChangelog showHeader={false} />
    </div>
  );
}
