"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const AITokenUsageStats = () => {
  const { t } = useI18n();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("aiShell", "tokenUsageTitle")}
          </CardTitle>
          <CardDescription>
            {t("aiShell", "tokenUsageDisabled")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t("aiShell", "tokenUsageUnavailable")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AITokenUsageStats;




















































