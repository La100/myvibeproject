"use client";

import { motion } from "framer-motion";
import {
  Target,
  BrainCircuit,
  TrendingUp,
  Bell,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  span: string;
}

const features: Feature[] = [
  {
    icon: Target,
    title: "Smart Project Planning",
    description:
      "Plan tasks, phases, and milestones with timeline-aware workflows built for real project delivery.",
    color: "#C06A3D",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    icon: BrainCircuit,
    title: "AI Project Assistant",
    description:
      "Generate tasks, rewrite specs, and summarize project context directly in your workspace.",
    color: "#002FA7",
    span: "md:col-span-1 md:row-span-2",
  },
  {
    icon: TrendingUp,
    title: "Progress & Cost Insights",
    description:
      "Track execution status and budget impact with clear operational visibility.",
    color: "#6D8B73",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    icon: Bell,
    title: "Deadline Awareness",
    description:
      "Stay aligned on due dates and dependencies with proactive reminders.",
    color: "#7C5CE0",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Coordinate members, clients, and stakeholders from one shared project source of truth.",
    color: "#C06A3D",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    icon: Workflow,
    title: "Unified Workflow",
    description:
      "Connect tasks, notes, files, calendar, and visualizations in a single operating system.",
    color: "#6D8B73",
    span: "md:col-span-2 md:row-span-1",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-28 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Everything You Need
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Built for projects that
            <br />
            actually <span className="gradient-text-animated">ship</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg max-w-xl mx-auto">
            AI, planning, files, and collaboration in one interface designed for
            calm execution.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`group relative rounded-[20px] border border-border/50 bg-card p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] overflow-hidden ${feature.span}`}
            >
              {/* Hover gradient accent */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(ellipse at 20% 50%, ${feature.color}08 0%, transparent 70%)`,
                }}
              />

              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/50 shadow-sm"
                  style={{ backgroundColor: `${feature.color}10` }}
                >
                  <feature.icon
                    className="h-5 w-5"
                    style={{ color: feature.color }}
                  />
                </motion.div>

                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
