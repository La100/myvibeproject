"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

const conceptVisuals = [
  {
    title: "Studio facade",
    src: "/landing/visualization-1776944094220.webp",
  },
  {
    title: "Site reference",
    src: "/landing/visualization-1776943891109.webp",
  },
  {
    title: "Courtyard option",
    src: "/landing/visualization-1776943915361.webp",
  },
  {
    title: "Village massing",
    src: "/landing/visualization-1776943937854.webp",
  },
];

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/8 bg-white/82 px-3 py-1.5 text-[11px] font-medium text-foreground/50 shadow-[0_8px_18px_rgba(24,20,16,0.04)]">
      {children}
    </span>
  );
}

function Line({ className }: { className: string }) {
  return <div className={`rounded-full bg-stone-300/88 ${className}`} />;
}

function Window({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[24px] border border-black/7 bg-[rgba(253,251,247,0.9)] shadow-[0_24px_60px_rgba(28,22,16,0.08)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-black/6 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-black/12" />
        <span className="h-3 w-3 rounded-full bg-black/9" />
        <span className="h-3 w-3 rounded-full bg-black/9" />
        <span className="ml-auto text-[11px] font-medium text-foreground/40">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ImagePanel({
  visual,
  className,
  imageClassName = "object-cover",
  sizes,
  children,
}: {
  visual: (typeof conceptVisuals)[number];
  className: string;
  imageClassName?: string;
  sizes: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-black/6 bg-[#e8e4dc] shadow-[0_22px_60px_rgba(24,20,16,0.05)] ${className}`}
    >
      <Image
        src={visual.src}
        alt={visual.title}
        fill
        className={imageClassName}
        loading="eager"
        quality={100}
        unoptimized
        sizes={sizes}
      />
      {children}
    </div>
  );
}

function ShowcaseMock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute left-[9%] top-[14%] w-[72%] overflow-hidden rounded-[22px] border border-white/55 bg-[rgba(253,251,247,0.9)] shadow-[0_24px_60px_rgba(28,22,16,0.16)] backdrop-blur-md">
      <div className="flex h-10 items-center border-b border-black/8 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-black/14" />
        <span className="ml-1.5 h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-1.5 h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-auto text-[12px] font-medium text-foreground/54">{label}</span>
      </div>
      <div className="bg-white/76 p-5">{children}</div>
    </div>
  );
}

function ShowcaseSection({
  id,
  visual,
  eyebrow,
  title,
  body,
  action,
  reverse = false,
  children,
}: {
  id: string;
  visual: (typeof conceptVisuals)[number];
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`grid items-center gap-8 border-t border-black/6 py-12 lg:gap-12 lg:py-16 ${
        reverse
          ? "lg:grid-cols-[minmax(18rem,0.36fr)_minmax(0,0.64fr)]"
          : "lg:grid-cols-[minmax(0,0.64fr)_minmax(18rem,0.36fr)]"
      }`}
    >
      <ImagePanel
        visual={visual}
        className={`aspect-[1.34/1] min-h-[340px] w-full max-w-[860px] ${
          reverse ? "lg:order-2 lg:justify-self-end" : ""
        }`}
        sizes="(max-width: 1023px) 100vw, 860px"
      >
        {children}
      </ImagePanel>

      <div className={`max-w-[30rem] ${reverse ? "lg:order-1 lg:pl-0" : "lg:pl-2"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          {eyebrow}
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.75rem,2.4vw,2.35rem)] font-medium leading-[1.08] tracking-[-0.03em] text-foreground">
          {title}
        </h3>
        <p className="mt-3 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          {body}
        </p>
        <Link
          href={id === "product" ? "/#workflow" : id === "resources" ? "/sign-in" : `/#${id}`}
          className="mt-5 inline-flex text-[1rem] font-medium text-[#f06422] transition-colors hover:text-foreground"
        >
          {action}
          <ArrowRight className="ml-1.5 h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function SurfaceCard({
  title,
  body,
  accent,
  path,
  children,
}: {
  title: string;
  body: string;
  accent: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-black/6 bg-[#faf8f4] p-5 shadow-[0_16px_36px_rgba(24,20,16,0.03)]">
      <div className="min-h-[9.5rem]">
        <h4 className="text-[1.15rem] font-medium tracking-[-0.03em] text-foreground">{title}</h4>
        <p className="mt-2 text-[0.98rem] leading-8 text-foreground/58">{body}</p>
        <p className="mt-5 text-[0.98rem] leading-none text-[#f06422]">{accent}</p>
      </div>
      <div className="mt-5 rounded-[18px] bg-[#dfd9cf] p-3">{children}</div>
      <div className="mt-4">
        <Chip>{path}</Chip>
      </div>
    </article>
  );
}

function ProofCard({
  title,
  body,
  path,
  children,
}: {
  title: string;
  body: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-black/6 bg-[#faf8f4] p-6 shadow-[0_18px_40px_rgba(24,20,16,0.03)]">
      <div className="min-h-[9rem]">
        <h4 className="text-[1.2rem] font-medium tracking-[-0.03em] text-foreground">{title}</h4>
        <p className="mt-2 max-w-md text-[1rem] leading-8 text-foreground/58">{body}</p>
      </div>
      <div className="mt-4">{children}</div>
      <div className="mt-5">
        <Chip>{path}</Chip>
      </div>
    </article>
  );
}

export function ProductSections() {
  const { isSignedIn } = useUser();

  return (
    <div className="px-6 pb-14 lg:px-10">
      <div className="mx-auto w-full max-w-[1520px]">
        <section className="max-w-3xl pb-14 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
            Product overview
          </p>
          <h2 className="mt-5 max-w-[16ch] text-balance text-[clamp(1.9rem,3.4vw,3.1rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
            Turn visual exploration into project delivery.
          </h2>
          <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-foreground/56">
            Myvibe keeps references, options, tasks, approvals, and client notes in the
            same workspace so concept work does not get lost between tools.
          </p>
        </section>

        <ShowcaseSection
          id="product"
          visual={conceptVisuals[0]}
          eyebrow="Concept workflow"
          title="Show the direction before it turns into admin."
          body="Collect references, compare options, and package the concept into a client-ready project flow."
          action="See workflow"
        >
          <ShowcaseMock label="ConceptPack.tsx">
            <div className="space-y-4 font-mono text-[13px] leading-7 text-foreground/70">
              <p>
                <span className="text-[#c23a54]">const</span>{" "}
                <span className="text-[#2e6f8f]">direction</span> = studioFacade
              </p>
              <p className="rounded-lg bg-black/4 px-3 py-2">
                render client pack with site, facade, notes
              </p>
              <p>
                export <span className="text-[#c23a54]">review</span> to client portal
              </p>
            </div>
          </ShowcaseMock>
        </ShowcaseSection>

        <ShowcaseSection
          id="workflow"
          visual={conceptVisuals[1]}
          eyebrow="Everywhere in the workflow"
          title="Keep the source image beside the work it creates."
          body="Tasks, sourcing, portal updates, and library decisions stay connected to the visual direction."
          action="Explore workflow"
          reverse
        >
          <ShowcaseMock label="Project flow">
            <div className="grid gap-3">
              {["Tasks synced", "Budget updated", "Client portal ready"].map((item) => (
                <div key={item} className="rounded-[14px] bg-white/78 p-3">
                  <Line className="h-4 w-[72%]" />
                  <p className="mt-2 text-[12px] font-medium text-foreground/54">{item}</p>
                </div>
              ))}
            </div>
          </ShowcaseMock>
        </ShowcaseSection>

        <section className="border-t border-black/6 py-10">
          <div className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <SurfaceCard
              title="Tasks & calendar"
              body="Keep team execution visible inside the same project flow."
              accent="Show timeline"
              path="Timeline view"
            >
              <Window title="Tasks" className="">
                <Line className="h-9 w-full" />
                <div className="mt-4 space-y-3">
                  <Line className="h-4 w-[78%]" />
                  <Line className="h-4 w-[58%]" />
                  <Line className="h-4 w-[66%]" />
                </div>
              </Window>
            </SurfaceCard>

            <SurfaceCard
              title="Shopping & budget"
              body="Track sourcing, pricing, and budget movement as scope changes."
              accent="Track sourcing"
              path="Budget view"
            >
              <Window title="Budget" className="">
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((item) => (
                    <div key={item} className="rounded-[16px] bg-white/74 p-3">
                      <Line className="h-4 w-[70%]" />
                      <Line className="mt-3 h-8 w-[56%]" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-20 rounded-[18px] bg-white/72" />
              </Window>
            </SurfaceCard>

            <SurfaceCard
              title="Client portal"
              body="Publish a cleaner client view instead of forwarding threads."
              accent="Share progress"
              path="Client review"
            >
              <Window title="Portal" className="">
                <div className="space-y-3">
                  <Line className="h-5 w-[60%]" />
                  <div className="h-16 rounded-[18px] bg-white/74" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 rounded-[16px] bg-white/72" />
                    <div className="h-12 rounded-[16px] bg-white/72" />
                  </div>
                </div>
              </Window>
            </SurfaceCard>

            <SurfaceCard
              title="Product library"
              body="Reuse approved products and reduce repeated sourcing work."
              accent="Reuse decisions"
              path="Product library"
            >
              <Window title="Library" className="">
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="rounded-[16px] bg-white/74 p-3">
                      <div className="h-12 rounded-[12px] bg-stone-200/72" />
                      <Line className="mt-3 h-4 w-[76%]" />
                    </div>
                  ))}
                </div>
              </Window>
            </SurfaceCard>
          </div>
        </section>

        <ShowcaseSection
          id="client-collaboration"
          visual={conceptVisuals[2]}
          eyebrow="Client collaboration"
          title="Approvals stay attached to the direction they saw."
          body="Collect structured feedback, estimates, and reporting without splitting the conversation from the concept."
          action="Review delivery"
        >
          <ShowcaseMock label="ClientReview">
            <div className="space-y-3">
              <Line className="h-5 w-[54%]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-[14px] bg-white/72" />
                <div className="h-20 rounded-[14px] bg-white/72" />
              </div>
              <div className="rounded-[14px] bg-white/78 p-3">
                <Line className="h-4 w-[80%]" />
                <Line className="mt-3 h-4 w-[48%]" />
              </div>
            </div>
          </ShowcaseMock>
        </ShowcaseSection>

        <section className="border-t border-black/6 py-10">
          <div className="mt-12 grid gap-4 xl:grid-cols-3">
            <ProofCard
              title="Estimates & payments"
              body="Connect commercial decisions directly to the same project context."
              path="Estimates"
            >
              <Window title="Payments" className="">
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="grid grid-cols-[1.15fr_0.55fr] gap-3 rounded-[16px] bg-white/74 p-3">
                      <Line className="h-4 w-full" />
                      <Line className="h-4 w-[78%]" />
                    </div>
                  ))}
                </div>
              </Window>
            </ProofCard>

            <ProofCard
              title="Surveys & approvals"
              body="Collect structured feedback instead of chasing client notes across channels."
              path="Approvals"
            >
              <div className="rounded-[18px] bg-[#d8d6dd] p-5">
                <div className="mx-auto max-w-[24rem] rounded-[20px] bg-white/92 p-5 shadow-[0_16px_34px_rgba(24,20,16,0.08)]">
                  <Line className="h-5 w-[74%]" />
                  <div className="mt-5 space-y-3">
                    <div className="h-10 rounded-[14px] bg-stone-100" />
                    <div className="h-10 rounded-[14px] bg-stone-100" />
                    <div className="h-10 rounded-[14px] bg-stone-100" />
                  </div>
                </div>
              </div>
            </ProofCard>

            <ProofCard
              title="Reports & visibility"
              body="See what is moving across projects and reuse that knowledge in the next one."
              path="Reports"
            >
              <Window title="Reports" className="">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="rounded-[16px] bg-white/74 p-3">
                        <Line className="h-4 w-[76%]" />
                        <Line className="mt-3 h-8 w-[54%]" />
                      </div>
                    ))}
                  </div>
                  <div className="h-20 rounded-[18px] bg-white/72" />
                </div>
              </Window>
            </ProofCard>
          </div>
        </section>

        <ShowcaseSection
          id="resources"
          visual={conceptVisuals[3]}
          eyebrow="Studio memory"
          title="Reuse approved products instead of rebuilding every choice."
          body="Save the final direction, reports, and product decisions so the next project starts with context."
          action="Start with Myvibe"
          reverse
        >
          <ShowcaseMock label="Library">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="rounded-[12px] bg-white/74 p-3">
                  <div className="h-12 rounded-[10px] bg-stone-200/72" />
                  <Line className="mt-3 h-3 w-[72%]" />
                </div>
              ))}
            </div>
          </ShowcaseMock>
        </ShowcaseSection>

        <section className="flex flex-col items-start justify-between gap-6 border-t border-black/6 pt-10 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
              Next step
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/54">
              Start from a real brief, collect the visual options, and keep client decisions
              attached to the project.
            </p>
          </div>

          <Button asChild className="h-10 rounded-full px-4 text-sm font-medium">
            <Link href={isSignedIn ? "/organisation" : "/sign-in"}>
              {isSignedIn ? "Open dashboard" : "Start with Myvibe"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
