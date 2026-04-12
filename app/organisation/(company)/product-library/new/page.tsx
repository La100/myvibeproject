"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Package } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { AddProductForm } from "../components/AddProductForm";

const currencySymbols: Record<string, string> = {
  PLN: "zł",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
  HUF: "Ft",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  MXN: "$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
};

export default function NewProductPage() {
  const { organization, isLoaded } = useOrganization();
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  if (!isLoaded || (organization?.id && team === undefined)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
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
        currencySymbol={currencySymbols[team.currency || "PLN"] || team.currency || "PLN"}
      />
    </div>
  );
}
