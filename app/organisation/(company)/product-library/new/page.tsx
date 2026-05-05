"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Package } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { getCurrencySymbol } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLoadingState } from "@/components/ui/loading-state";

import { AddProductForm } from "../components/AddProductForm";

export default function NewProductPage() {
  const { organization, isLoaded } = useOrganization();
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  if (!isLoaded || (organization?.id && team === undefined)) {
    return (
      <AppLoadingState
        variant="section"
        title="Loading product library"
        description="Preparing organization product settings."
        className="min-h-[40vh]"
      />
    );
  }

  if (!organization?.id || !team) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Organization unavailable</CardTitle>
          <CardDescription>
            Join or select an organization before adding products to the library.
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
          <h1 className="text-2xl font-bold">Add Product</h1>
          <p className="text-sm text-muted-foreground">
            Save a reusable product entry for your organization with sourcing details, specifications, and an uploaded image.
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
