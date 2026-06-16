"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            Nie udało się załadować widoku
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Spróbuj ponownie. Jeśli problem wróci, wróć do poprzedniej strony.
          </p>
        </div>
        <Button type="button" onClick={reset}>
          Spróbuj ponownie
        </Button>
      </div>
    </main>
  );
}
