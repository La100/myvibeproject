"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Check, Percent } from "lucide-react";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_ORGANIZATION_TAX_SETTINGS,
  resolveOrganizationTaxSettings,
} from "@/lib/organizationTax";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export default function TaxPage() {
  const { organization } = useOrganization();
  const { t } = useI18n();
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxLabel, setTaxLabel] = useState(
    DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel,
  );
  const [taxRate, setTaxRate] = useState(
    String(DEFAULT_ORGANIZATION_TAX_SETTINGS.taxRate),
  );
  const [submitting, setSubmitting] = useState(false);

  const teamData = useQuery(
    apiAny.teams.getTeamSettingsByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const resolvedTaxSettings = useMemo(
    () => resolveOrganizationTaxSettings(teamData?.organizationTaxSettings),
    [teamData?.organizationTaxSettings],
  );

  useEffect(() => {
    if (!teamData) {
      return;
    }

    setTaxEnabled(resolvedTaxSettings.taxEnabled);
    setTaxLabel(resolvedTaxSettings.taxLabel);
    setTaxRate(String(resolvedTaxSettings.taxRate));
  }, [resolvedTaxSettings, teamData]);

  const handleSave = async () => {
    if (!teamData?.teamId || submitting) {
      return;
    }

    const normalizedLabel = taxLabel.trim();
    const normalizedRate = Number.parseFloat(taxRate);

    if (!normalizedLabel) {
      toast.error(t("taxPage", "toastLabelRequired"));
      return;
    }

    if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 100) {
      toast.error(t("taxPage", "toastRateInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      await updateTeamSettings({
        teamId: teamData.teamId,
        organizationTaxSettings: {
          taxEnabled,
          taxRate: normalizedRate,
          taxLabel: normalizedLabel,
        },
      });
      toast.success(t("taxPage", "toastUpdated"));
    } catch (error) {
      toast.error(t("taxPage", "toastUpdateFailed"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (teamData === undefined) {
    return <Spinner className="pb-8" />;
  }

  if (!teamData) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("taxPage", "title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("taxPage", "description")}
        </p>
      </div>

      <Card className="clean-surface">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-medium text-foreground">{t("taxPage", "workspaceDefault")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("taxPage", "workspaceDefaultDescription")}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tax-enabled">{t("taxPage", "enableDefaultTax")}</Label>
              <Select
                value={taxEnabled ? "enabled" : "disabled"}
                onValueChange={(value) => setTaxEnabled(value === "enabled")}
              >
                <SelectTrigger id="tax-enabled">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">{t("taxPage", "enabled")}</SelectItem>
                  <SelectItem value="disabled">{t("taxPage", "disabled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tax-label">{t("taxPage", "taxLabel")}</Label>
              <Input
                id="tax-label"
                value={taxLabel}
                onChange={(event) => setTaxLabel(event.target.value)}
                placeholder={t("taxPage", "taxLabelPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tax-rate">{t("taxPage", "defaultRate")}</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
                placeholder={t("taxPage", "taxRatePlaceholder")}
              />
            </div>

          </div>

          {taxEnabled ? (
            <div className="rounded-2xl border border-border/60 bg-secondary/70 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{t("taxPage", "currentDefault")}</span>
                <Badge>{taxLabel.trim() || DEFAULT_ORGANIZATION_TAX_SETTINGS.taxLabel}</Badge>
                <Badge variant="secondary">
                  {Number.parseFloat(taxRate || "0").toFixed(2)}%
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("taxPage", "currentDefaultDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/70 px-4 py-4 text-sm text-muted-foreground">
              {t("taxPage", "noDefaultTax")}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-secondary/70 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card">
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{t("taxPage", "lightweightTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("taxPage", "lightweightDescription")}
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={submitting}>
              <Check className="mr-2 h-4 w-4" />
              {t("taxPage", "save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
