"use client";

import { useMemo, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Archive, Check, Percent, Plus } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type TaxFilter = "all" | "archived";

export default function TaxPage() {
  const { organization } = useOrganization();
  const [filter, setFilter] = useState<TaxFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("VAT");
  const [rate, setRate] = useState("23");
  const [submitting, setSubmitting] = useState(false);

  const taxData = useQuery(
    apiAny.taxRates.getTeamTaxRatesByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );

  const createTaxRate = useMutation(apiAny.taxRates.createTaxRate);
  const setDefaultTaxRate = useMutation(apiAny.taxRates.setDefaultTaxRate);
  const archiveTaxRate = useMutation(apiAny.taxRates.archiveTaxRate);

  const visibleTaxRates = useMemo(() => {
    const taxRates = taxData?.taxRates || [];
    return filter === "archived"
      ? taxRates.filter((entry: any) => entry.isArchived)
      : taxRates.filter((entry: any) => !entry.isArchived);
  }, [filter, taxData?.taxRates]);

  const handleCreate = async () => {
    if (!taxData?.teamId || submitting) {
      return;
    }

    const normalizedName = name.trim();
    const normalizedRate = Number.parseFloat(rate);
    if (!normalizedName) {
      toast.error("Tax rate name is required");
      return;
    }
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 100) {
      toast.error("Tax rate must be between 0 and 100");
      return;
    }

    setSubmitting(true);
    try {
      await createTaxRate({
        teamId: taxData.teamId,
        name: normalizedName,
        rate: normalizedRate,
      });
      setDialogOpen(false);
      setName("VAT");
      setRate("23");
      toast.success("Tax rate created");
    } catch (error) {
      toast.error((error as Error).message || "Failed to create tax rate");
    } finally {
      setSubmitting(false);
    }
  };

  if (taxData === undefined) {
    return <Spinner className="pb-8" />;
  }

  if (!taxData) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tax</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage reusable tax rates and keep one default synced wherever totals should match.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="self-start">
              <Plus className="mr-2 h-4 w-4" />
              Create tax rate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Create tax rate</DialogTitle>
              <DialogDescription>
                Add a reusable rate for the whole workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="tax-rate-name">Name</Label>
                <Input
                  id="tax-rate-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="VAT"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tax-rate-rate">Rate (%)</Label>
                <Input
                  id="tax-rate-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  placeholder="23"
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCreate} disabled={submitting}>
                <Plus className="mr-2 h-4 w-4" />
                Create tax rate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "archived" ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setFilter("archived")}
        >
          Archived
        </Button>
      </div>

      <Card className="clean-surface overflow-hidden">
        <CardContent className="p-0">
          {visibleTaxRates.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-muted/40">
                <Percent className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-medium text-foreground">
                  {filter === "archived" ? "No archived tax rates" : "Add your first tax rate"}
                </h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Tax rates will be visible within schedules, purchase orders, and invoicing.
                </p>
              </div>
              {filter !== "archived" && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create tax rate
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 sm:p-6">
              {visibleTaxRates.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-4 rounded-[28px] border border-border/60 bg-background px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[22px] font-medium leading-none text-foreground">
                        {entry.name}
                      </span>
                      <Badge variant="secondary">{entry.rate.toFixed(2)}%</Badge>
                      {entry.isDefault ? <Badge>Default</Badge> : null}
                      {entry.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.isDefault
                        ? "This rate is currently synced as the workspace default."
                        : "Available to be promoted as the default rate."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!entry.isArchived && !entry.isDefault ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={async () => {
                          try {
                            await setDefaultTaxRate({
                              teamId: taxData.teamId,
                              taxRateId: entry.id,
                            });
                            toast.success("Default tax rate updated");
                          } catch (error) {
                            toast.error((error as Error).message || "Failed to set default rate");
                          }
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Set default
                      </Button>
                    ) : null}

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={async () => {
                        try {
                          await archiveTaxRate({
                            teamId: taxData.teamId,
                            taxRateId: entry.id,
                            archived: !entry.isArchived,
                          });
                          toast.success(
                            entry.isArchived ? "Tax rate restored" : "Tax rate archived",
                          );
                        } catch (error) {
                          toast.error((error as Error).message || "Failed to update tax rate");
                        }
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {entry.isArchived ? "Restore" : "Archive"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
