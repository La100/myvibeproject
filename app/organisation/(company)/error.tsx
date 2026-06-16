"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Organization route error", error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            Nie udało się załadować organizacji
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Dane organizacji chwilowo nie są dostępne.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}>
            Spróbuj ponownie
          </Button>
          <Button asChild variant="outline">
            <Link href="/select-organization">Wybierz organizację</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
