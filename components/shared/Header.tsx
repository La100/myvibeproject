"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/70 bg-background/90 p-4 shadow-[0_10px_30px_-26px_rgba(22,22,22,0.75)] backdrop-blur-md">
      <Link href="/dashboard" className="flex cursor-pointer items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <h1 className="clean-title text-xl font-medium">Myvibe project</h1>
          <Badge variant="secondary" className="w-fit">
            Architectural Project Manager
          </Badge>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link href="/sign-in">Log In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </SignedOut>
      </div>
    </header>
  );
}
