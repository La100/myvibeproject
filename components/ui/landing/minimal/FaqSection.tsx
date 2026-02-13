"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do the AI assistants actually work?",
    answer:
      "Assistants use project context like tasks, files, notes, and previous chats to generate actionable outputs. They can draft updates, create work items, and help with planning inside the same workspace.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Yes. Workspace data is access-controlled by organization and project permissions. We never sell your data, and you can manage or remove stored content at any time.",
  },
  {
    question: "Can I switch AI assistants or use multiple at once?",
    answer:
      "Yes. Depending on your plan, you can run multiple assistant presets and use them per project based on the type of work you need.",
  },
  {
    question: "Can I generate images and keep them in project context?",
    answer:
      "Yes. Image generation is integrated with the same chat UI and project history, so visuals, prompts, and follow-up edits stay in one thread flow.",
  },
  {
    question: "Can clients or limited members access only selected projects?",
    answer:
      "Yes. You can configure membership roles and project-level access so each person sees only what they should.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can change or cancel your plan at any time.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-28 px-6 relative">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(124,92,224,0.04)_0%,transparent_60%)]" />

      <div className="relative container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Questions & Answers
          </span>
          <h2 className="mt-6 font-[var(--font-display-serif)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-tight">
            Everything you
            <br />
            want to <span className="gradient-text-animated">know</span>.
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <AccordionItem
                value={`faq-${index}`}
                className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm px-6 overflow-hidden transition-all duration-300 hover:border-border hover:shadow-[0_8px_25px_rgba(0,0,0,0.04)] data-[state=open]:shadow-[0_12px_30px_rgba(0,0,0,0.06)] data-[state=open]:border-border"
              >
                <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
