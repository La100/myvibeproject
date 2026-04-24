"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowUp, Check, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
const INITIAL_PROMPT =
  "Create the concept pack with blueprint, room visuals, materials, and review notes.";
const FOLLOW_UP_PROMPT =
  "Keep the oak palette, open shelving, and a softer sofa option for the client review.";
const DEMO_PACE_MULTIPLIER = 1.35;
const STAGE_DURATIONS = [1800, 1000, 1300, 1700, 1100, 1400, 1600, 3200].map(
  (duration) => Math.round(duration * DEMO_PACE_MULTIPLIER),
);

const generatedOutputs = [
  {
    title: "Blueprint view",
    src: "/samplevisuals/sample1-hero.jpg",
  },
  {
    title: "Room direction",
    src: "/landing/generated/barcelona-chair-room.jpg",
  },
  {
    title: "Material palette",
    src: "/landing/generated/barcelona-chair-materials.jpg",
  },
];

type ThreadStatus = "done" | "active" | "idle";
type ActionState = "done" | "active" | "idle";

function getDemoThreads(stage: number) {
  return [
    {
      title: "Lounge refresh",
      meta:
        stage >= 7
          ? "Pack delivered"
          : stage >= 5
            ? "Exporting now"
            : stage >= 1
              ? "Live planning"
              : "Queued",
      status: (stage >= 7 ? "done" : "active") as ThreadStatus,
    },
    {
      title: "Kitchen revision",
      meta: "Draft ready",
      status: "done" as ThreadStatus,
    },
    {
      title: "Material shortlist",
      meta: "3 mins ago",
      status: "idle" as ThreadStatus,
    },
  ];
}

function getDemoActions(stage: number) {
  return [
    {
      title: "Reading design brief",
      detail: "scope + priorities",
      state: (stage >= 2 ? "done" : "active") as ActionState,
      progress: stage >= 2 ? 100 : stage >= 1 ? 74 : 38,
    },
    {
      title: "Generating visual options",
      detail: "layout + elevations",
      state: (stage >= 5 ? "done" : stage >= 2 ? "active" : "idle") as ActionState,
      progress: stage >= 5 ? 100 : stage === 4 ? 84 : stage === 3 ? 61 : stage === 2 ? 28 : 0,
    },
    {
      title: "Building client pack",
      detail: "blueprint + materials",
      state: (stage >= 7 ? "done" : stage >= 5 ? "active" : "idle") as ActionState,
      progress: stage >= 7 ? 100 : stage === 6 ? 82 : stage === 5 ? 44 : 0,
    },
  ];
}

export function HeroSection() {
  const { isSignedIn } = useUser();
  const [stage, setStage] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [typedPrompt, setTypedPrompt] = useState("");
  const threadViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStage(0);

    let elapsed = 0;
    const timeouts: number[] = [];

    STAGE_DURATIONS.forEach((duration, index) => {
      elapsed += duration;

      if (index === STAGE_DURATIONS.length - 1) {
        timeouts.push(window.setTimeout(() => setCycle((value) => value + 1), elapsed));
        return;
      }

      timeouts.push(window.setTimeout(() => setStage(index + 1), elapsed));
    });

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [cycle]);

  useEffect(() => {
    let nextPrompt = "";
    let duration = 0;

    if (stage === 0) {
      nextPrompt = INITIAL_PROMPT;
      duration = STAGE_DURATIONS[0] - 280;
    } else if (stage === 3) {
      nextPrompt = FOLLOW_UP_PROMPT;
      duration = STAGE_DURATIONS[3] - 320;
    }

    if (!nextPrompt) {
      setTypedPrompt("");
      return;
    }

    setTypedPrompt("");

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedPrompt(nextPrompt.slice(0, index));

      if (index >= nextPrompt.length) {
        window.clearInterval(interval);
      }
    }, Math.max(16, Math.floor(duration / nextPrompt.length)));

    return () => window.clearInterval(interval);
  }, [cycle, stage]);

  useEffect(() => {
    const viewport = threadViewportRef.current;

    if (!viewport) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cycle, stage]);

  const demoThreads = getDemoThreads(stage);
  const demoActions = getDemoActions(stage);
  const composerText = stage === 0 || stage === 3 ? typedPrompt : "";
  const showReplyPlaceholder = stage >= 7 && !composerText;

  return (
    <section className="px-6 pb-10 pt-2 lg:px-10">
      <div className="mx-auto w-full max-w-[1520px]">
        <div className="max-w-[720px] pt-8 sm:max-w-[820px] sm:pt-10 md:max-w-[900px] lg:max-w-[760px] xl:max-w-[860px] 2xl:max-w-[620px]">
          <h1 className="text-balance text-[2.25rem] font-medium leading-[0.98] tracking-[-0.04em] text-foreground sm:text-[2.85rem] md:text-[3.35rem] lg:text-[2.6rem] xl:text-[3rem] 2xl:text-[2.35rem] 2xl:leading-[1.05]">
            For architects and interior designers,
            <br />
            Myvibe is the best way to run projects with AI.
          </h1>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-7">
          {!isSignedIn ? (
            <Button
              asChild
              className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/92"
            >
              <Link href="/sign-in">
                <Sparkles className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/92"
            >
              <Link href="/organisation">
                <Sparkles className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8 overflow-hidden rounded-[32px] border border-black/8 bg-background shadow-[0_20px_80px_rgba(20,20,20,0.08)]">
          <div className="relative min-h-[560px] overflow-hidden lg:h-[820px]">
            <Image
              src="/visualization-1773318760233.jpg"
              alt="Myvibe sign up visual"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1023px) 100vw, 1520px"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black/24 via-black/8 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />

            <div
              aria-hidden="true"
              className="absolute inset-x-3 bottom-3 top-3 sm:inset-x-6 sm:bottom-6 sm:top-6 lg:inset-x-8 lg:bottom-8 lg:top-8"
            >
              <div className="hero-chatkit-window h-full overflow-hidden rounded-[30px] border border-white/45 bg-[rgba(250,247,241,0.78)] shadow-[0_32px_80px_rgba(28,24,19,0.22)] backdrop-blur-xl">
                <div className="flex h-12 items-center justify-between border-b border-black/8 px-4 sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-black/18" />
                      <span className="h-2.5 w-2.5 rounded-full bg-black/12" />
                      <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
                    </div>
                    <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/80">
                      <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
                      Vibe assistant
                    </div>
                  </div>

                  <div className="hidden rounded-full border border-black/8 bg-white/70 px-3 py-1 text-[11px] font-medium text-foreground/72 sm:block">
                    Live planning
                  </div>
                </div>

                <div className="grid h-[calc(100%-3rem)] min-h-0 md:grid-cols-[188px_minmax(0,1fr)] xl:grid-cols-[188px_minmax(0,1fr)_240px]">
                  <aside className="hidden border-r border-black/8 bg-white/30 md:flex md:flex-col">
                    <div className="px-4 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/45">
                      Recent threads
                    </div>
                    <div className="space-y-2 px-3">
                      {demoThreads.map((thread) => (
                        <div
                          key={thread.title}
                          className={`rounded-2xl border px-3 py-3 shadow-[0_10px_24px_rgba(28,24,19,0.06)] transition-all duration-700 ${
                            thread.status === "active"
                              ? "border-black/10 bg-white/82"
                              : "border-black/6 bg-white/66"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1 h-2 w-2 rounded-full ${
                                thread.status === "done"
                                  ? "bg-emerald-500"
                                  : thread.status === "active"
                                    ? "hero-chatkit-pulse bg-amber-500"
                                    : "bg-black/18"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-foreground">
                                {thread.title}
                              </p>
                              <p className="mt-1 text-[11px] text-foreground/52">
                                {thread.meta}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <div className="flex min-h-0 flex-col xl:border-r xl:border-black/8">
                    <div className="flex flex-1 flex-col overflow-hidden p-4 sm:p-5">
                      <div
                        ref={threadViewportRef}
                        className="flex-1 space-y-3.5 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {stage >= 1 ? (
                          <div
                            key={`${cycle}-message-request`}
                            className="hero-chatkit-enter ml-auto max-w-[92%] rounded-[24px] border border-white/55 bg-white/88 px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_18px_40px_rgba(28,24,19,0.08)] backdrop-blur-sm sm:max-w-[70%]"
                          >
                            Build a concept package for the lounge refresh: room direction,
                            blueprint, materials, and selected furniture options.
                          </div>
                        ) : null}

                        {stage >= 2 ? (
                          <div
                            key={`${cycle}-message-brief`}
                            className="hero-chatkit-enter max-w-[94%] rounded-[26px] border border-black/8 bg-white/86 px-4 py-3 shadow-[0_18px_40px_rgba(28,24,19,0.08)] sm:max-w-[78%]"
                          >
                            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                              </span>
                              Reading the brief and mapping the first direction.
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[12px] text-foreground/52">
                              {stage >= 5 ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              {stage >= 5
                                ? "Layout direction locked. Preparing the client-facing export."
                                : "Collecting references, blueprint framing, and material notes."}
                            </div>
                          </div>
                        ) : null}

                        {stage >= 3 ? (
                          <div
                            key={`${cycle}-message-response-one`}
                            className="hero-chatkit-enter max-w-[90%] rounded-[24px] border border-black/8 bg-white/76 px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_16px_32px_rgba(28,24,19,0.06)] sm:max-w-[72%]"
                          >
                            I&apos;m combining the room direction, blueprint framing, and a
                            warm timber palette into one clean concept pack for review.
                          </div>
                        ) : null}

                        {stage >= 4 ? (
                          <div
                            key={`${cycle}-message-blueprint-preview`}
                            className="hero-chatkit-enter overflow-hidden rounded-2xl border border-black/8 bg-white/78 shadow-[0_14px_30px_rgba(28,24,19,0.06)] sm:max-w-[88%]"
                          >
                            <div className="relative aspect-[2.1/1]">
                              <Image
                                src={generatedOutputs[0].src}
                                alt={generatedOutputs[0].title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 1023px) 88vw, 620px"
                              />
                            </div>
                            <div className="border-t border-black/8 px-3 py-2 text-[11px] font-medium text-foreground/70">
                              {generatedOutputs[0].title}
                            </div>
                          </div>
                        ) : null}

                        {stage >= 4 ? (
                          <div
                            key={`${cycle}-message-revision`}
                            className="hero-chatkit-enter ml-auto max-w-[92%] rounded-[24px] border border-white/55 bg-white/88 px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_18px_40px_rgba(28,24,19,0.08)] backdrop-blur-sm sm:max-w-[72%]"
                          >
                            Keep the oak palette, open shelving, and add a softer sofa option
                            before you package it for the client.
                          </div>
                        ) : null}

                        {stage >= 5 ? (
                          <div
                            key={`${cycle}-message-response-two`}
                            className="hero-chatkit-enter max-w-[90%] rounded-[24px] border border-black/8 bg-white/76 px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_16px_32px_rgba(28,24,19,0.06)] sm:max-w-[72%]"
                          >
                            Noted. I&apos;m keeping the oak scheme, preserving the shelving, and
                            swapping in a softer seating direction before export.
                          </div>
                        ) : null}

                        {stage >= 6 ? (
                          <div
                            key={`${cycle}-message-outputs`}
                            className="hero-chatkit-enter grid gap-2 pt-1 sm:max-w-[88%] sm:grid-cols-2"
                          >
                            {generatedOutputs.slice(1).map((output) => (
                              <div
                                key={output.title}
                                className="overflow-hidden rounded-2xl border border-black/8 bg-white/78 shadow-[0_14px_30px_rgba(28,24,19,0.06)]"
                              >
                                <div className="relative aspect-[1.12/1]">
                                  <Image
                                    src={output.src}
                                    alt={output.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1023px) 44vw, 280px"
                                  />
                                </div>
                                <div className="border-t border-black/8 px-3 py-2 text-[11px] font-medium text-foreground/70">
                                  {output.title}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {stage >= 7 ? (
                          <div
                            key={`${cycle}-message-final`}
                            className="hero-chatkit-enter max-w-[94%] rounded-[26px] border border-emerald-200/70 bg-white/82 px-4 py-3 shadow-[0_18px_40px_rgba(28,24,19,0.08)] sm:max-w-[78%]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[13px] font-medium text-foreground">
                                Concept pack ready for client review.
                              </div>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="mt-2 text-[12px] leading-relaxed text-foreground/58">
                              Included the blueprint view, room direction, material palette,
                              and softer seating option for feedback.
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-black/8 bg-white/50 p-3 sm:p-4">
                      <div className="rounded-[24px] border border-black/8 bg-white/88 px-4 py-3 shadow-[0_18px_40px_rgba(28,24,19,0.08)]">
                        <div className="flex min-h-10 items-start gap-1 text-[13px] leading-relaxed text-foreground">
                          {composerText ? (
                            <>
                              <span className="inline-block">{composerText}</span>
                              <span className="animate-blink text-foreground/45">|</span>
                            </>
                          ) : showReplyPlaceholder ? (
                            <span className="text-foreground/34">
                              Reply with changes or approvals...
                            </span>
                          ) : (
                            <span className="text-transparent">.</span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="rounded-full border border-white/55 bg-white/88 px-3 py-1 text-[11px] font-medium text-foreground/62 backdrop-blur-sm">
                            design-brief.pdf
                          </div>
                          <div className="hidden rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-foreground/62 sm:block">
                            Can make changes
                          </div>
                          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-[0_10px_24px_rgba(28,24,19,0.16)]">
                            <ArrowUp className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="hidden bg-white/36 xl:flex xl:flex-col">
                    <div className="space-y-3 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/45">
                        Running now
                      </div>

                      {demoActions.map((action) => (
                        <div
                          key={action.title}
                          className={`rounded-2xl border px-4 py-3 shadow-[0_14px_30px_rgba(28,24,19,0.06)] transition-all duration-700 ${
                            action.state === "active"
                              ? "border-black/10 bg-white/82"
                              : "border-black/8 bg-white/74"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-medium text-foreground">
                                {action.title}
                              </p>
                              <p className="mt-1 text-[11px] text-foreground/52">
                                {action.detail}
                              </p>
                            </div>
                            {action.state === "done" ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : action.state === "active" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-foreground/55" />
                            ) : (
                              <span className="h-4 w-4 rounded-full border border-black/10 bg-white/80" />
                            )}
                          </div>

                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/6">
                            <div
                              className={`h-full origin-left rounded-full transition-[width] duration-1000 ${
                                action.state === "done"
                                  ? "bg-emerald-500/80"
                                  : action.state === "active"
                                    ? "bg-foreground/55"
                                    : "bg-black/10"
                              }`}
                              style={{ width: `${action.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
