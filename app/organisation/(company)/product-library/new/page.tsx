"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Package } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { getCurrencySymbol } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLoadingState } from "@/components/ui/loading-state";
import { useI18n } from "@/lib/i18n";

import { AddProductForm } from "../components/AddProductForm";

export default function NewProductPage() {
  const { t } = useI18n();
  const { organization, isLoaded } = useOrganization();
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  if (!isLoaded || (organization?.id && team === undefined)) {
    return (
      <AppLoadingState
        variant="section"
        title={t("productLibrary", "loadingTitle")}
        description={t("productLibrary", "loadingDescription")}
        className="min-h-[40vh]"
      />
    );
  }

  if (!organization?.id || !team) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{t("productLibrary", "organizationUnavailable")}</CardTitle>
          <CardDescription>
            {t("productLibrary", "organizationUnavailableDescription")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("productLibrary", "addProduct")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "addProductDescription")}
          </p>
        </div>
      </div>

      <AddProductForm
        teamId={team._id}
        currencySymbol={getCurrencySymbol(team.currency || "PLN")}
      />
    </div>
  );
}
