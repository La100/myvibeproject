"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

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

function IntroBlock({
  eyebrow,
  title,
  body,
  path,
}: {
  eyebrow: string;
  title: string;
  body: string;
  path: string;
}) {
  return (
    <div className="max-w-[31rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
        {eyebrow}
      </p>
      <h3 className="mt-8 max-w-[10ch] text-balance text-[clamp(2.5rem,5vw,4.8rem)] font-medium leading-[0.96] tracking-[-0.06em] text-foreground">
        {title}
      </h3>
      <p className="mt-8 max-w-lg text-pretty text-[1.05rem] leading-[1.7] text-foreground/58">
        {body}
      </p>
      <div className="mt-10">
        <Chip>{path}</Chip>
      </div>
    </div>
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
          <h2 className="mt-5 max-w-[13ch] text-balance text-[clamp(2.2rem,4.6vw,4.2rem)] font-medium leading-[0.98] tracking-[-0.06em] text-foreground">
            One page, a few different rhythms, and clearer proof that Myvibe is a full product.
          </h2>
          <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-foreground/56">
            The landing should not feel templated. One section can be editorial, another can
            be a surface grid, another can act like a product proof wall.
          </p>
        </section>

        <section
          id="product"
          className="grid items-center gap-12 border-t border-black/6 py-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:py-16"
        >
          <IntroBlock
            eyebrow="Project workspace"
            title="Run the whole project from one calm workspace."
            body="Show projects, timeline, tasks, notes, and files together so the landing sells an operating layer, not just a chat interface."
            path="/public/landing/projects-overview.png"
          />

          <div className="relative min-h-[430px] overflow-hidden rounded-[44px] border border-black/6 bg-[linear-gradient(180deg,#ece7de_0%,#ddd5c8_100%)] shadow-[0_28px_80px_rgba(24,20,16,0.05)] lg:min-h-[560px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_76%,rgba(228,202,160,0.4),transparent_22%)]" />
            <div className="absolute left-6 top-6">
              <Chip>Projects and overview</Chip>
            </div>
            <div className="absolute bottom-6 left-6">
              <Chip>Swap with /public/landing/projects-overview.png</Chip>
            </div>

            <div className="absolute left-[10%] top-[14%] w-[56%]">
              <Window title="Projects" className="">
                <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/34">Project list</p>
                <div className="mt-5 space-y-3">
                  <Line className="h-5 w-[54%]" />
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-[18px] bg-white/74 p-4">
                      <Line className="h-5 w-[72%]" />
                      <Line className="mt-3 h-4 w-[48%]" />
                    </div>
                  ))}
                </div>
              </Window>
            </div>

            <div className="absolute bottom-[10%] right-[7%] w-[62%]">
              <Window title="Overview" className="">
                <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/34">Current project</p>
                <div className="mt-5 space-y-4">
                  <Line className="h-6 w-[40%]" />
                  <div className="grid grid-cols-3 gap-4">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="rounded-[18px] bg-white/76 p-4">
                        <Line className="h-4 w-[74%]" />
                        <Line className="mt-4 h-10 w-[56%]" />
                      </div>
                    ))}
                  </div>
                  <div className="h-24 rounded-[20px] bg-white/72" />
                </div>
              </Window>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-black/6 py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
              Everywhere in the workflow
            </p>
            <h3 className="mt-4 text-balance text-[clamp(2.1rem,4.4vw,4rem)] font-medium leading-[1] tracking-[-0.06em] text-foreground">
              Four operating layers, four different screens.
            </h3>
            <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-foreground/56">
              This section should scan fast. Less editorial, more like a clean product
              surface map.
            </p>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-4">
            <SurfaceCard
              title="Tasks & calendar"
              body="Keep team execution visible inside the same project flow."
              accent="Show timeline"
              path="/public/landing/tasks-calendar.png"
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
              path="/public/landing/shopping-budget.png"
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
              path="/public/landing/client-portal.png"
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
              path="/public/landing/product-library.png"
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

        <section id="client-collaboration" className="border-t border-black/6 py-12 lg:py-16">
          <div className="max-w-4xl">
            <h3 className="text-balance text-[clamp(2.1rem,4.5vw,4rem)] font-medium leading-[1] tracking-[-0.06em] text-foreground">
              Built for real project delivery.
            </h3>
            <p className="mt-3 max-w-3xl text-[clamp(1.25rem,2.3vw,2.05rem)] leading-[1.18] tracking-[-0.04em] text-foreground/56">
              Estimates, approvals, reporting, and client review should feel like real
              product capabilities, not supporting footnotes.
            </p>
          </div>

          <div className="mt-12 grid gap-4 xl:grid-cols-3">
            <ProofCard
              title="Estimates & payments"
              body="Connect commercial decisions directly to the same project context."
              path="/public/landing/estimations-payments.png"
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
              path="/public/landing/surveys.png"
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
              path="/public/landing/reports.png"
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

        <section
          id="resources"
          className="grid items-start gap-10 border-t border-black/6 py-12 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12 lg:py-16"
        >
          <div className="max-w-[28rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
              Studio memory
            </p>
            <h3 className="mt-7 max-w-[9ch] text-balance text-[clamp(2.2rem,4.2vw,3.8rem)] font-medium leading-[0.98] tracking-[-0.06em] text-foreground">
              Reuse approved products instead of rebuilding every choice.
            </h3>
            <p className="mt-7 max-w-lg text-[1rem] leading-8 text-foreground/56">
              End on a quieter operational note. This makes the page feel broader and more
              credible than an AI-only narrative.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Chip>Product library</Chip>
              <Chip>Reports</Chip>
              <Chip>/public/landing/product-library.png</Chip>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] bg-[linear-gradient(180deg,#e8e2d6_0%,#d8cfbf_100%)] p-4">
              <Window title="Library" className="">
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="rounded-[16px] bg-white/74 p-3">
                      <div className="h-14 rounded-[12px] bg-stone-200/72" />
                      <Line className="mt-3 h-4 w-[78%]" />
                    </div>
                  ))}
                </div>
              </Window>
            </div>

            <div className="rounded-[28px] bg-[linear-gradient(180deg,#e6dfd4_0%,#d7cebe_100%)] p-4">
              <Window title="Reports" className="">
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="grid grid-cols-[1.1fr_0.45fr] gap-3 rounded-[16px] bg-white/74 p-3">
                      <Line className="h-4 w-full" />
                      <Line className="h-4 w-[72%]" />
                    </div>
                  ))}
                </div>
              </Window>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-6 border-t border-black/6 pt-10 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
              Next step
            </p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/54">
              Podmieniamy placeholdery na realne screeny, a potem dopinamy cropy i spacing
              pod finalny materiał.
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
