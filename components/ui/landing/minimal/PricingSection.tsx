"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Best for trying the workspace with a single-seat setup.",
    features: [
      "Up to 3 projects",
      "1 team member",
      "1 GB file storage",
      "Core project workspace",
      "No AI features",
    ],
    cta: "Start Free",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "AI Pro",
    price: "$39",
    cadence: "per month",
    description: "For teams running production projects with AI in daily workflows.",
    features: [
      "Up to 20 projects",
      "Up to 25 team members",
      "50 GB file storage",
      "5M AI tokens / month",
      "AI chat + image generation",
      "Advanced features enabled",
    ],
    cta: "Start AI Pro",
    href: "/sign-up",
    highlighted: true,
  },
  {
    name: "AI Scale",
    price: "$99",
    cadence: "per month",
    description: "For multi-project operations with heavy AI usage and higher limits.",
    features: [
      "Everything in AI Pro",
      "Up to 20 projects",
      "Up to 25 team members",
      "50 GB file storage",
      "25M AI tokens / month",
      "Higher throughput for AI workflows",
      "Priority support",
    ],
    cta: "Go AI Scale",
    href: "/sign-up",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-28 px-6 overflow-hidden">
      {/* Dark contrast background */}
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(192,106,61,0.08)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(124,92,224,0.06)_0%,transparent_60%)]" />

      <div className="relative container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
            <Sparkles className="h-3.5 w-3.5 text-[#C06A3D]" />
            Simple Pricing
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-primary-foreground leading-tight">
            Start free. Scale when
            <br />
            you&apos;re ready.
          </h2>
          <p className="mt-5 text-primary-foreground/60 text-lg max-w-xl mx-auto">
            Start free, unlock AI Pro for daily assistant workflows, and move to AI
            Scale when your team needs larger monthly token capacity.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`group relative flex flex-col rounded-[24px] p-8 transition-all duration-500 hover:-translate-y-2 ${
                plan.highlighted
                  ? "bg-primary-foreground text-primary shadow-[0_40px_100px_rgba(255,253,248,0.15)] hover:shadow-[0_50px_120px_rgba(255,253,248,0.2)]"
                  : "bg-primary-foreground/5 border border-primary-foreground/10 text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/8 hover:border-primary-foreground/15"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C06A3D] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-[0_8px_20px_rgba(192,106,61,0.3)]">
                  Most Popular
                </span>
              )}

              <div className="space-y-3">
                <h3
                  className={`font-[var(--font-display-serif)] text-xl font-medium ${
                    plan.highlighted ? "text-primary" : "text-primary-foreground"
                  }`}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-5xl font-[var(--font-display-serif)] font-normal ${
                      plan.highlighted
                        ? "text-primary"
                        : "text-primary-foreground"
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm ${
                      plan.highlighted
                        ? "text-primary/50"
                        : "text-primary-foreground/40"
                    }`}
                  >
                    {plan.cadence}
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    plan.highlighted
                      ? "text-primary/70"
                      : "text-primary-foreground/50"
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted
                          ? "bg-[#6D8B73]/15 text-[#6D8B73]"
                          : "bg-primary-foreground/10 text-[#6D8B73]"
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span
                      className={`text-sm ${
                        plan.highlighted
                          ? "text-primary/80"
                          : "text-primary-foreground/70"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  asChild
                  className={`w-full rounded-full h-12 text-sm font-medium transition-all duration-300 ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_30px_rgba(44,42,37,0.2)]"
                      : "bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 hover:bg-primary-foreground/15"
                  }`}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
