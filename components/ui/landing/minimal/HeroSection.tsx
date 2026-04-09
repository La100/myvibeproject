"use client";

import { Button } from "@/components/ui/button";
import { ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function HeroSection() {
  return (
    <section className="px-6 pb-16 pt-2 lg:px-8">
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="max-w-[690px] pt-10">
          <h1 className="text-balance text-[clamp(1.2rem,1.65vw,2rem)] font-medium leading-[1.2] tracking-tight text-foreground">
            Built to make you extraordinarily productive,
            <br />
            Myvibe is the best way to run projects with AI.
          </h1>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <SignedOut>
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-foreground px-6 text-[1.07rem] font-medium text-background hover:bg-foreground/92"
            >
              <Link href="/sign-up">
                Download for macOS
                <ArrowDownToLine className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-foreground px-6 text-[1.07rem] font-medium text-background hover:bg-foreground/92"
            >
              <Link href="/organisation">
                Go to Dashboard
                <ArrowDownToLine className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </SignedIn>
        </div>

        <div className="mt-14 overflow-hidden rounded-md border border-black/8 bg-[#ebe8e1]">
          <img
            src="https://cursor.com/marketing-static/_next/image?url=https%3A%2F%2Fptht05hbb1ssoooe.public.blob.vercel-storage.com%2Fassets%2Fmisc%2Fasset-cc24ca462279ca23250c.jpg&w=1920&q=70"
            alt="Cursor-style hero demo"
            className="block h-auto w-full"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
