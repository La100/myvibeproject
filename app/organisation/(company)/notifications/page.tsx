import { BellRing } from "lucide-react";
import { OrganizationClientNotifications } from "@/components/company/OrganizationClientNotifications";
import { OrganizationChangelog } from "@/components/company/OrganizationChangelog";

export default function OrganizationNotificationsPage() {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <BellRing className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        </div>
        <p className="text-sm text-muted-foreground lg:text-base">
          Client responses and survey submissions across all projects in your organization.
        </p>
      </div>
      <OrganizationClientNotifications showHeader={false} />
      <OrganizationChangelog showHeader={false} />
    </div>
  );
}
