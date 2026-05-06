"use client";

import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Chrome,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  ImageIcon,
  ListChecks,
  MessageSquare,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { BillingPlanCard } from "@/components/billing/BillingPlanCard";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS } from "@/lib/billingPlans";

type LandingIcon = ComponentType<{ className?: string }>;

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

const landingProducts = [
  {
    name: "Barcelona chair",
    category: "Lounge",
    status: "Client approved",
    price: "EUR 4,280",
    src: "/landing/generated/barcelona-chair-main.png",
  },
  {
    name: "Green zellige tile",
    category: "Wall finish",
    status: "Sample ordered",
    price: "EUR 118 / m2",
    src: "/landing/generated/green-zellige-interior.png",
  },
  {
    name: "Red travertine table",
    category: "Furniture",
    status: "Quote requested",
    price: "EUR 1,240",
    src: "/landing/generated/red-travertine-side-table.png",
  },
  {
    name: "Cream boucle swivel",
    category: "Seating",
    status: "Alt option",
    price: "EUR 2,180",
    src: "/landing/generated/cream-boucle-swivel-chair.png",
  },
  {
    name: "Walnut fluted cabinet",
    category: "Storage",
    status: "Supplier saved",
    price: "EUR 2,460",
    src: "/landing/generated/walnut-fluted-cabinet.png",
  },
  {
    name: "Alabaster pendant",
    category: "Lighting",
    status: "Approved",
    price: "EUR 1,340",
    src: "/landing/generated/alabaster-pendant-light.png",
  },
  {
    name: "Smoked glass table",
    category: "Coffee table",
    status: "Reusable",
    price: "EUR 1,590",
    src: "/landing/generated/smoked-glass-coffee-table.png",
  },
  {
    name: "Terracotta floor tile",
    category: "Floor finish",
    status: "Client review",
    price: "EUR 92 / m2",
    src: "/landing/generated/terracotta-tile-hallway.png",
  },
  {
    name: "Nickel wall sconce",
    category: "Lighting",
    status: "Supplier saved",
    price: "EUR 640",
    src: "/landing/generated/brushed-nickel-wall-sconce.png",
  },
  {
    name: "Oat wool grid rug",
    category: "Textile",
    status: "Approved",
    price: "EUR 1,760",
    src: "/landing/generated/oat-wool-grid-rug.png",
  },
];

const conceptProducts = [landingProducts[2], landingProducts[5]];
const shoppingProducts = landingProducts.slice(0, 4);
const reviewProducts = [landingProducts[4], landingProducts[7], landingProducts[8]];
const projectSystemProducts = [
  landingProducts[1],
  landingProducts[5],
  landingProducts[7],
  landingProducts[9],
];
const libraryProducts = [
  landingProducts[0],
  landingProducts[3],
  landingProducts[4],
  landingProducts[6],
  landingProducts[8],
  landingProducts[9],
];

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/myvibeproject-web-clipper/nklbcopiimkboameblhnmdookkelncih";

const projectTasks = [
  { title: "Confirm tile grout tone", meta: "Client review", status: "Review" },
  { title: "Send chair lead time to supplier", meta: "Sourcing", status: "Today" },
  { title: "Update lounge budget estimate", meta: "Budget", status: "Done" },
];

const workspaceNavItems: { label: string; icon: LandingIcon }[] = [
  { label: "Overview", icon: CheckCircle2 },
  { label: "Moodboard", icon: ImageIcon },
  { label: "Shopping list", icon: ShoppingCart },
  { label: "Tasks", icon: ListChecks },
];

const reviewDecisions = [
  { label: "Walnut cabinet", status: "Approved" },
  { label: "Terracotta floor", status: "Needs revision" },
  { label: "Nickel wall sconce", status: "Approved" },
];

const estimateRows = [
  { item: "Concept package", status: "Approved", amount: "EUR 9,226" },
  { item: "Paid deposit", status: "Received", amount: "EUR 2,750" },
  { item: "Supplier quotes", status: "Pending", amount: "EUR 1,120" },
];

const reportMetrics = [
  { label: "Budget locked", value: "72%" },
  { label: "Pending approvals", value: "2" },
  { label: "Products reused", value: "4" },
];

const faqItems = [
  {
    category: "Product scope",
    question: "What is Myvibe built to manage?",
    answer:
      "Myvibe is a workspace for architecture and interior studios that need project delivery, visual exploration, client collaboration, sourcing, files, reports, and AI support in one place. It connects the creative side of a project with the operational work that follows.",
  },
  {
    category: "Organization workspace",
    question: "What lives at the organization level?",
    answer:
      "The organization workspace brings together projects, team notifications, the global calendar, AI visualizations, product and survey libraries, team contacts, reports, tax settings, billing settings, team members, and subscription management.",
  },
  {
    category: "Project workspace",
    question: "What can a studio manage inside one project?",
    answer:
      "Each project has an overview, client portal, notifications, tasks, moodboard, notes, contacts, calendar, payments, surveys, files, shopping list, labor tracking, estimations, settings, and an AI assistant that works with the project context.",
  },
  {
    category: "AI assistant",
    question: "What can the AI assistant actually do inside a project?",
    answer:
      "The project assistant can load project context, search project items, summarize status, suggest next steps, review budget signals, scrape product data for sourcing, and work with tasks, notes, contacts, payments, shopping lists, labor, surveys, moodboard sections, and project settings when the user enables change mode.",
  },
  {
    category: "AI safety",
    question: "Can the assistant change project data automatically?",
    answer:
      "By default the assistant runs in read-only mode. Write tools are blocked until the user explicitly enables the setting that allows changes, and AI output still needs human review before it is used for client, budget, procurement, construction, legal, or compliance decisions.",
  },
  {
    category: "AI attachments",
    question: "Can the assistant work with uploaded files?",
    answer:
      "The assistant composer supports image and PDF attachments up to 32 MB, with up to 5 attachments in a message. Project PDFs can also be added to AI knowledge from the Files area so the assistant can search indexed document content during project conversations.",
  },
  {
    category: "Visualizations",
    question: "What is the visualizations workspace for?",
    answer:
      "The visualizations area gives the team a dedicated AI surface for creating project imagery from prompts and reference files. It is useful for concept directions, material studies, room moods, product context, and fast visual exploration before a decision becomes part of the project.",
  },
  {
    category: "Sourcing",
    question: "How do shopping lists and product libraries work together?",
    answer:
      "Shopping lists track products, finishes, suppliers, costs, statuses, sections, and project-specific decisions. Approved or reusable items can move into the product library so future projects can start from known products instead of rebuilding every selection from scratch.",
  },
  {
    category: "Client collaboration",
    question: "What can clients review without entering the full workspace?",
    answer:
      "The client portal and survey flows let clients review selected project information, respond to approvals, leave comments, and submit structured decisions. Client activity is surfaced back to the studio through project and organization notifications.",
  },
  {
    category: "Commercial workflow",
    question: "How does Myvibe handle budgets, labor, payments, and estimates?",
    answer:
      "Project delivery can include shopping totals, labor items, payment tracking, tax settings, estimates, invoice defaults, and budget reporting. These tools keep commercial decisions close to the design context instead of splitting them into separate spreadsheets.",
  },
  {
    category: "Files and exports",
    question: "What happens to project files and generated documents?",
    answer:
      "Files are stored inside the project with folders, breadcrumbs, previews, downloads, and deletion controls. Teams can upload images, videos, PDFs, DWG/DXF files, Office documents, and other project assets, then decide which files are visible in the client portal and which PDFs should be indexed for AI knowledge.",
  },
  {
    category: "Generated documents",
    question: "Which workflows create documents or exports?",
    answer:
      "Myvibe supports exports and generated documents across shopping lists, labor documentation, company reports, project books, estimates, invoices, and client-facing survey file responses. These artifacts stay connected to the project instead of living only in external folders.",
  },
  {
    category: "Planning",
    question: "How are tasks, calendars, contacts, and notes connected?",
    answer:
      "Tasks, due dates, calendar views, project contacts, notes, and notifications are part of the same project record. The organization calendar rolls work up across projects, while each project keeps its own operational context.",
  },
  {
    category: "Team and access",
    question: "How does team access work?",
    answer:
      "A studio works inside an organization with internal team members, role-aware navigation, shared libraries, organization settings, and subscription limits. Clients are handled through client-facing workflows rather than being dropped into the full internal workspace.",
  },
  {
    category: "Web clipper",
    question: "What does the MyVibeProject Web Clipper do?",
    answer:
      "The optional browser extension helps signed-in users capture product information from merchant or product pages and save it into Myvibe shopping lists, including visible product details such as title, price, URL, image, and related product metadata when the user launches the clipper.",
  },
  {
    category: "Plans",
    question: "What is included in the paid plans?",
    answer:
      "AI Pro is built for weekly assistant and visualization workflows with 20 active projects, 2 team members, and 50 GB storage. AI Scale increases the workspace capacity to 75 active projects, 100 team members, 250 GB storage, and higher monthly AI volume.",
  },
];

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/7 bg-white/72 px-2.5 py-1 text-[10px] font-medium text-foreground/48">
      {children}
    </span>
  );
}

function Line({ className }: { className: string }) {
  return <div className={`rounded-full bg-stone-300/88 ${className}`} />;
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
        unoptimized
        sizes={sizes}
      />
      {children}
    </div>
  );
}

function BrowserChrome({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-black/7 bg-[#f4f1eb]/92 px-4">
      <span className="h-2.5 w-2.5 rounded-full bg-black/16" />
      <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
      <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
      <div className="mx-auto hidden min-w-[14rem] rounded-full border border-black/7 bg-white/68 px-4 py-1 text-center text-[11px] font-medium text-foreground/42 sm:block">
        myvibe.app/{label}
      </div>
    </div>
  );
}

function ProductThumb({
  product,
  className = "",
}: {
  product: (typeof landingProducts)[number];
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[16px] border border-black/6 bg-white/76 ${className}`}>
      <div className="relative aspect-[1.15/1] bg-[#eee9df]">
        <Image
          src={product.src}
          alt={product.name}
          fill
          className="object-cover"
          sizes="240px"
          unoptimized
        />
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-[12px] font-medium tracking-[-0.02em] text-foreground/84">
          {product.name}
        </p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-foreground/42">
          <span>{product.category}</span>
          <span>{product.price}</span>
        </div>
      </div>
    </div>
  );
}

function ConceptWorkspaceMock() {
  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[22px] border border-white/58 bg-[rgba(253,251,247,0.94)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md sm:top-[7%] sm:rounded-[24px] lg:inset-x-[6%]">
      <BrowserChrome label="projects/lounge-refresh" />
      <div className="grid min-h-[18.25rem] bg-white/58 text-foreground md:min-h-[25rem] md:grid-cols-[0.9fr_1.35fr]">
        <aside className="hidden border-r border-black/7 bg-[#f8f6f1]/86 p-4 md:block">
          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/72">
            <Sparkles className="h-3.5 w-3.5 text-[#f06422]" />
            Lounge refresh
          </div>
          <div className="mt-6 space-y-2">
            {workspaceNavItems.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-[14px] px-3 py-2 text-[12px] ${
                  index === 1 ? "bg-white text-foreground shadow-[0_8px_18px_rgba(24,20,16,0.05)]" : "text-foreground/46"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[18px] border border-black/6 bg-white/62 p-3">
            <p className="text-[11px] font-medium text-foreground/50">AI note</p>
            <p className="mt-2 text-[12px] leading-5 text-foreground/64">
              Client prefers warm leather, red travertine, alabaster light, and softer seating.
            </p>
          </div>
        </aside>

        <div className="min-w-0 p-3 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
                Concept pack
              </p>
              <h4 className="mt-2 max-w-[12rem] text-[18px] font-medium leading-[1.12] tracking-[-0.04em] text-foreground sm:max-w-none sm:text-[20px]">
                Layered lounge direction
              </h4>
            </div>
            <span className="hidden sm:inline-flex">
              <StatusPill>Shared with client</StatusPill>
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="relative min-h-[9rem] overflow-hidden rounded-[18px] bg-[#e8e1d5] sm:min-h-[13.5rem] sm:rounded-[20px]">
              <Image
                src="/landing/generated/barcelona-chair-room.png"
                alt="Layered lounge interior direction"
                fill
                className="object-cover"
                sizes="520px"
                unoptimized
              />
              <div className="absolute left-3 top-3 rounded-full bg-white/76 px-3 py-1 text-[11px] font-medium text-foreground/62 backdrop-blur">
                Room visual
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-1">
              {conceptProducts.map((product) => (
                <ProductThumb key={product.name} product={product} />
              ))}
            </div>
          </div>

          <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-3">
            {["3 visuals", "4 products", "2 approvals"].map((item) => (
              <div key={item} className="rounded-[16px] border border-black/6 bg-white/72 px-3 py-3">
                <Line className="h-3 w-[52%]" />
                <p className="mt-2 text-[12px] font-medium text-foreground/68">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShoppingWorkspaceMock() {
  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="projects/lounge-refresh/shopping" />
      <div className="grid min-h-[24rem] bg-white/62 p-4 text-foreground lg:grid-cols-[minmax(0,1fr)_210px] lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
                Shopping list
              </p>
              <h4 className="mt-2 text-[20px] font-medium tracking-[-0.04em] text-foreground">
                Lounge package
              </h4>
            </div>
            <div className="flex gap-2">
              <StatusPill>EUR 9,226</StatusPill>
              <StatusPill>4 items</StatusPill>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[18px] border border-black/7 bg-white/78">
            {shoppingProducts.map((product, index) => (
              <div
                key={product.name}
                className={`grid grid-cols-[3.2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 ${
                  index > 0 ? "border-t border-black/6" : ""
                }`}
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-[12px] bg-[#ede8df]">
                  <Image
                    src={product.src}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium tracking-[-0.02em] text-foreground/82">
                    {product.name}
                  </p>
                  <p className="mt-1 text-[11px] text-foreground/42">
                    {product.category} / {product.status}
                  </p>
                </div>
                <p className="text-[12px] font-medium text-foreground/62">{product.price}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="mt-4 hidden rounded-[18px] border border-black/7 bg-[#f8f6f1]/86 p-4 lg:block">
          <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/66">
            <CircleDollarSign className="h-4 w-4 text-[#f06422]" />
            Budget impact
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-[11px] text-foreground/44">
                <span>Furniture</span>
                <span>72%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/7">
                <div className="h-full w-[72%] rounded-full bg-[#f06422]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-foreground/44">
                <span>Finishes</span>
                <span>28%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/7">
                <div className="h-full w-[28%] rounded-full bg-[#1f4f3b]" />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {projectTasks.map((task) => (
              <div key={task.title} className="rounded-[14px] bg-white/72 p-3">
                <div className="flex items-center gap-2 text-[11px] text-foreground/44">
                  <Clock3 className="h-3.5 w-3.5" />
                  {task.status}
                </div>
                <p className="mt-1 text-[12px] font-medium leading-5 text-foreground/72">
                  {task.title}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ClientReviewMock() {
  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="client-review/lounge-refresh" />
      <div className="grid min-h-[24rem] gap-4 bg-white/62 p-4 text-foreground md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="relative min-h-[11rem] overflow-hidden rounded-[20px] bg-[#e8e1d5]">
            <Image
              src="/landing/generated/walnut-fluted-cabinet.png"
              alt="Client review walnut storage direction"
              fill
              className="object-cover"
              sizes="440px"
              unoptimized
            />
            <div className="absolute left-3 top-3 rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-foreground/62 backdrop-blur">
              Room direction
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {reviewProducts.map((product) => (
              <div key={product.name} className="relative aspect-square overflow-hidden rounded-[14px] bg-[#eee9df]">
                <Image
                  src={product.src}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                <MessageSquare className="h-4 w-4 text-[#f06422]" />
                Client comments
              </div>
              <StatusPill>2 new</StatusPill>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                "Approve the walnut storage and wall sconce direction.",
                "Can we compare the terracotta floor against a quieter stone option?",
              ].map((comment) => (
                <div key={comment} className="rounded-[14px] bg-[#f8f6f1] p-3 text-[12px] leading-5 text-foreground/68">
                  {comment}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
              <FileCheck2 className="h-4 w-4 text-[#f06422]" />
              Decisions
            </div>
            <div className="mt-4 grid gap-2">
              {reviewDecisions.map((decision) => (
                <div
                  key={decision.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-[#f8f6f1] px-3 py-2.5"
                >
                  <span className="truncate text-[12px] font-medium text-foreground/70">
                    {decision.label}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      decision.status === "Approved"
                        ? "bg-[#eef4ef] text-[#42624b]"
                        : "bg-[#fff3eb] text-[#a35b2c]"
                    }`}
                  >
                    {decision.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommercialLayerSection() {
  return (
    <section className="grid items-center gap-10 border-t border-black/6 py-14 lg:grid-cols-[minmax(0,0.66fr)_0.34fr] lg:py-16">
      <div className="max-w-[30rem] lg:order-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          Commercial layer
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          Estimates, approvals, and reporting stay in the same project context.
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          Track what was approved, paid, and still waiting without rebuilding the story
          for every client update.
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/7 bg-[#e6ded1] p-3 shadow-[0_24px_70px_rgba(24,20,16,0.08)] lg:order-1">
        <div className="overflow-hidden rounded-[22px] border border-white/64 bg-[rgba(253,251,247,0.94)] shadow-[0_22px_60px_rgba(24,20,16,0.08)]">
          <BrowserChrome label="projects/lounge-refresh/commercial" />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(17rem,0.95fr)]">
            <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <CreditCard className="h-4 w-4 text-[#f06422]" />
                  Estimate table
                </div>
                <StatusPill>EUR 9,226</StatusPill>
              </div>
              <div className="mt-4 overflow-hidden rounded-[16px] border border-black/6 bg-[#f8f6f1]">
                {estimateRows.map((row, index) => (
                  <div
                    key={row.item}
                    className={`grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-3 px-3 py-3 ${
                      index > 0 ? "border-t border-black/6" : ""
                    }`}
                  >
                    <span className="truncate text-[12px] font-medium text-foreground/72">
                      {row.item}
                    </span>
                    <span className="text-[11px] text-foreground/42">{row.status}</span>
                    <span className="text-[12px] font-medium text-foreground/66">{row.amount}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[16px] bg-[#f8f6f1] p-3">
                  <p className="text-[11px] text-foreground/42">Paid deposit</p>
                  <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/82">
                    EUR 2,750
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f8f6f1] p-3">
                  <p className="text-[11px] text-foreground/42">Client review</p>
                  <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/82">
                    2 pending
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <FileCheck2 className="h-4 w-4 text-[#f06422]" />
                  Approval survey
                </div>
                <div className="mt-4 grid gap-2">
                  {["Chair selection", "Green tile grout", "Final package"].map((item, index) => (
                    <div key={item} className="rounded-[14px] bg-[#f8f6f1] p-3">
                      <div className="flex items-center justify-between text-[12px] font-medium text-foreground/70">
                        <span>{item}</span>
                        <span>{index === 1 ? "Pending" : "Approved"}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-black/7">
                        <div
                          className="h-full rounded-full bg-[#f06422]"
                          style={{ width: index === 1 ? "48%" : "100%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/6 bg-white/76 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <BarChart3 className="h-4 w-4 text-[#f06422]" />
                  Report summary
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {reportMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-[14px] bg-[#f8f6f1] p-3">
                      <p className="text-[17px] font-medium tracking-[-0.04em] text-foreground/82">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-foreground/42">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductLibraryMock() {
  return (
    <div className="absolute inset-x-[4%] top-[8%] overflow-hidden rounded-[24px] border border-white/58 bg-[rgba(253,251,247,0.95)] shadow-[0_30px_70px_rgba(28,22,16,0.18)] backdrop-blur-md lg:inset-x-[6%]">
      <BrowserChrome label="product-library/approved" />
      <div className="min-h-[24rem] bg-white/62 p-4 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/34">
              Approved library
            </p>
            <h4 className="mt-2 text-[20px] font-medium tracking-[-0.04em] text-foreground">
              Lounge decisions
            </h4>
          </div>
          <StatusPill>6 reusable products</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {libraryProducts.map((product, index) => (
            <div
              key={product.name}
              className="overflow-hidden rounded-[18px] border border-black/6 bg-white/76"
            >
              <div className="relative aspect-[1.35/1] bg-[#eee9df]">
                <Image
                  src={product.src}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="240px"
                  unoptimized
                />
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground/76">
                      {product.name}
                    </p>
                    <p className="mt-1 text-[10px] text-foreground/40">{product.category}</p>
                  </div>
                  <span className="rounded-full bg-[#f8f6f1] px-2 py-1 text-[10px] font-medium text-foreground/48">
                    {index === 1 ? "Supplier saved" : index === 3 ? "Reusable" : "Approved"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebClipperMock() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-[#efebe4] text-foreground sm:rounded-[28px]">
      <div className="absolute inset-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="relative min-w-0 overflow-hidden bg-[#f4f1eb]">
          <div className="flex h-10 items-center justify-center gap-5 border-b border-black/7 bg-white/64 px-4 text-[13px] font-semibold text-foreground/48 sm:h-12 sm:gap-10">
            <span className="font-serif text-[22px] font-normal tracking-[-0.05em] text-foreground/42 sm:text-[24px]">
              JAPANDI
            </span>
            <span className="hidden sm:inline">Lighting</span>
            <span className="hidden sm:inline">Home Decor</span>
            <span className="hidden sm:inline">Furniture</span>
          </div>
          <div className="grid min-h-full gap-6 p-3 opacity-52 sm:p-5 xl:grid-cols-[minmax(0,0.58fr)_minmax(20rem,0.42fr)] xl:pr-10">
            <div className="relative min-h-[14rem] overflow-hidden rounded-[18px] bg-white sm:min-h-[28rem] sm:rounded-[20px]">
              <Image
                src="/landing/generated/boucle-lounge-sofa.png"
                alt="Japandi rattan sofa product"
                fill
                className="object-cover object-center"
                sizes="620px"
                unoptimized
              />
            </div>
            <div className="hidden pt-8 xl:block">
              <h4 className="max-w-[12ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.05em] text-foreground">
                Japandi Rattan Sofa
              </h4>
              <p className="mt-5 text-[18px] text-foreground/72">$1,529.00</p>
              <div className="mt-6 border-t border-black/10 pt-6 text-[15px] leading-7 text-foreground/56">
                Introduce a touch of classic charm and modern design to your lounge package.
              </div>
              <div className="mt-10 rounded-full bg-[#8f8177] px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.06em] text-white">
                Shop at Chita Living
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-[#1f2428]/24" />

          <div className="absolute inset-x-3 bottom-3 z-10 rounded-[16px] border border-white/55 bg-white/88 p-3 shadow-[0_16px_40px_rgba(24,20,16,0.18)] backdrop-blur-md xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/40">
                  Captured product
                </p>
                <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-foreground/82">
                  Japandi Rattan Sofa
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f4f1eb] px-3 py-1 text-[11px] font-medium text-foreground/58">
                $1,529
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 rounded-[12px] border border-black/7 bg-white px-3 py-2 text-[11px] text-foreground/54">
                Richardson / Shopping list
              </div>
              <button className="inline-flex h-9 shrink-0 items-center justify-center rounded-[12px] bg-foreground px-3 text-[11px] font-medium text-background">
                Save
              </button>
            </div>
          </div>
        </div>

        <aside className="relative z-10 hidden border-l border-black/7 bg-[#f8f6f1] p-3 shadow-[-24px_0_70px_rgba(24,20,16,0.18)] xl:block">
          <div className="rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/38">
              Active project
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                  Richardson
                </p>
                <p className="mt-1 text-[11px] text-foreground/44">Sonia Projects</p>
              </div>
              <StatusPill>Live</StatusPill>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[13px] font-semibold text-foreground/86">Product image</p>
            <div className="relative mt-4 aspect-[1.55/1] overflow-hidden rounded-[16px] bg-[#eee9df]">
              <Image
                src="/landing/generated/boucle-lounge-sofa.png"
                alt="Captured sofa product"
                fill
                className="object-cover"
                sizes="320px"
                unoptimized
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[12px] bg-[#f4f1eb] text-[12px] font-medium text-foreground/72">
                <ImageIcon className="h-3.5 w-3.5" />
                Pick existing
              </button>
              <button className="inline-flex h-9 items-center justify-center gap-2 rounded-[12px] border border-black/7 bg-white text-[12px] font-medium text-foreground/72">
                <Camera className="h-3.5 w-3.5" />
                Capture area
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] border border-black/7 bg-white/86 p-4">
            <p className="text-[13px] font-semibold text-foreground/86">Product details</p>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-[11px] font-medium text-foreground/60">Product name *</p>
                <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                  Japandi Rattan Sofa
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-foreground/60">Price</p>
                  <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                    1529.00
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground/60">Quantity</p>
                  <div className="mt-1 rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/76">
                    1
                  </div>
                </div>
              </div>
              <div className="rounded-[12px] border border-black/8 bg-white px-3 py-2 text-[13px] text-foreground/68">
                Uncategorized (default)
              </div>
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-3 rounded-[18px] bg-white p-2 shadow-[0_-10px_24px_rgba(24,20,16,0.08)]">
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-foreground text-sm font-medium text-background">
              <ShoppingCart className="h-4 w-4" />
              Add to shopping list
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WebClipperSection() {
  return (
    <section
      id="web-clipper"
      className="grid max-w-full items-center gap-7 overflow-hidden border-t border-black/6 py-10 xl:grid-cols-[minmax(0,0.62fr)_minmax(20rem,0.38fr)] xl:gap-12 xl:py-16"
    >
      <div className="relative aspect-[1.48/1] min-h-0 w-full max-w-full overflow-hidden rounded-[22px] border border-black/6 bg-[#e8e4dc] shadow-[0_18px_42px_rgba(24,20,16,0.05)] sm:aspect-[1.42/1] sm:max-w-[860px] sm:rounded-[28px] sm:shadow-[0_22px_60px_rgba(24,20,16,0.05)] xl:aspect-[1.34/1]">
        <WebClipperMock />
      </div>

      <div className="w-full max-w-[34rem] xl:pl-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          Chrome web clipper
        </p>
        <h3 className="mt-4 text-balance text-[clamp(1.55rem,6vw,2.05rem)] font-medium leading-[1.08] tracking-[-0.03em] text-foreground xl:mt-5 xl:text-[clamp(1.75rem,2.4vw,2.35rem)]">
          Save product pages directly into the project shopping list.
        </h3>
        <p className="mt-3 text-pretty text-[1rem] leading-7 text-foreground/58 xl:text-[1.05rem] xl:leading-8">
          Capture the image, price, supplier link, and project section while you browse
          furniture, lighting, and finishes.
        </p>
        <Button
          asChild
          className="mt-6 h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Link href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
            <Chrome className="mr-2 h-4 w-4" />
            Chrome Web Store
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ShowcaseSection({
  id,
  visual,
  eyebrow,
  title,
  body,
  reverse = false,
  children,
}: {
  id: string;
  visual: (typeof conceptVisuals)[number];
  eyebrow: string;
  title: string;
  body: string;
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
        className={`aspect-[1.34/1] min-h-[300px] w-full max-w-[860px] sm:min-h-[340px] ${
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
      </div>
    </section>
  );
}

function ProjectSystemSection() {
  return (
    <section className="grid items-center gap-10 border-t border-black/6 py-14 lg:grid-cols-[minmax(0,0.66fr)_0.34fr] lg:py-16">
      <div className="max-w-[30rem] lg:order-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          Project operating system
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          Once the concept lands, the rest of the project keeps moving.
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          Myvibe turns the approved direction into tasks, budget movement, client approvals,
          and reusable product decisions without splitting the workspace.
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/7 bg-[#e6ded1] p-3 shadow-[0_24px_70px_rgba(24,20,16,0.08)] lg:order-1">
        <div className="overflow-hidden rounded-[22px] border border-white/64 bg-[rgba(253,251,247,0.94)] shadow-[0_22px_60px_rgba(24,20,16,0.08)]">
          <BrowserChrome label="projects/lounge-refresh/overview" />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]">
            <div className="grid gap-4">
              <div className="relative min-h-[18rem] overflow-hidden rounded-[20px] bg-[#e8e1d5]">
                <Image
                  src="/landing/generated/oat-wool-grid-rug.png"
                  alt="Approved rug and material direction"
                  fill
                  className="object-cover"
                  sizes="620px"
                  unoptimized
                />
                <div className="absolute inset-x-3 bottom-3 rounded-[18px] border border-white/52 bg-white/78 p-4 backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/38">
                        Approved direction
                      </p>
                      <p className="mt-1 text-[15px] font-medium tracking-[-0.03em] text-foreground/82">
                        Oat wool rug, green tile, alabaster lighting
                      </p>
                    </div>
                    <StatusPill>Client signed off</StatusPill>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Tasks", "8 open", "3 due this week"],
                  ["Budget", "EUR 9.2k", "72% furniture"],
                  ["Portal", "2 comments", "1 approval"],
                ].map(([title, value, meta]) => (
                  <div key={title} className="rounded-[18px] border border-black/6 bg-white/72 p-4">
                    <p className="text-[11px] font-medium text-foreground/42">{title}</p>
                    <p className="mt-2 text-[18px] font-medium tracking-[-0.04em] text-foreground/84">
                      {value}
                    </p>
                    <p className="mt-1 text-[11px] text-foreground/38">{meta}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] border border-black/6 bg-white/72 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                    <ListChecks className="h-4 w-4 text-[#f06422]" />
                    Next actions
                  </div>
                  <StatusPill>Live</StatusPill>
                </div>
                <div className="mt-4 grid gap-2">
                  {projectTasks.map((task) => (
                    <div
                      key={task.title}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[14px] bg-[#f8f6f1] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-foreground/72">
                          {task.title}
                        </p>
                        <p className="mt-1 text-[11px] text-foreground/38">{task.meta}</p>
                      </div>
                      <span className="text-[11px] font-medium text-foreground/44">{task.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] border border-black/6 bg-white/72 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/74">
                  <ShoppingCart className="h-4 w-4 text-[#f06422]" />
                  Reusable library
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {projectSystemProducts.map((product) => (
                    <div key={product.name} className="relative aspect-square overflow-hidden rounded-[12px] bg-[#eee9df]">
                      <Image
                        src={product.src}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[14px] bg-[#f8f6f1] p-3">
                  <div className="flex items-center justify-between text-[11px] text-foreground/44">
                    <span>Saved for next project</span>
                    <span>4 products</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-black/7">
                    <div className="h-full w-[64%] rounded-full bg-[#f06422]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section
      id="pricing"
      className="grid items-start gap-10 border-t border-black/6 py-14 lg:grid-cols-[0.34fr_minmax(0,0.66fr)] lg:py-16"
    >
      <div className="max-w-[30rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          Pricing
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          Start with the AI capacity your studio actually needs.
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          Choose a monthly plan for project workflows, visualizations, storage, and team
          collaboration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {BILLING_PLANS.map((plan) => (
          <BillingPlanCard
            key={plan.key}
            plan={plan}
            availabilityLabel={plan.key === "ai_scale" ? "Best value" : "Available"}
            availabilityVariant={plan.key === "ai_scale" ? "secondary" : "outline"}
            footer={
              <Button
                asChild
                className="w-full"
              >
                <Link href={isSignedIn ? "/organisation/subscription" : "/sign-up"}>
                  {isSignedIn ? "Open subscription" : "Start with Myvibe"}
                </Link>
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section
      id="faq"
      className="grid items-start gap-10 border-t border-black/6 py-14 lg:grid-cols-[0.34fr_minmax(0,0.66fr)] lg:py-16"
    >
      <div className="max-w-[30rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground/42">
          FAQ
        </p>
        <h3 className="mt-5 text-balance text-[clamp(1.85rem,2.7vw,2.7rem)] font-medium leading-[1.03] tracking-[-0.04em] text-foreground">
          Clear answers for studios evaluating the full Myvibe workspace.
        </h3>
        <p className="mt-4 text-pretty text-[1.05rem] leading-8 text-foreground/58">
          A practical overview of what the app covers, where each workflow lives,
          and how the pieces connect across the studio.
        </p>
      </div>

      <div className="divide-y divide-black/7 border-y border-black/7">
        {faqItems.map((item, index) => (
          <details key={item.question} className="group" open={index === 0}>
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5 text-left marker:hidden">
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/36">
                  {item.category}
                </span>
                <span className="mt-2 block text-[1.05rem] font-medium leading-7 tracking-[-0.02em] text-foreground/86">
                  {item.question}
                </span>
              </span>
              <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/7 bg-white/70 text-foreground/54 transition group-open:rotate-180">
                <ChevronDown className="h-4 w-4" />
              </span>
            </summary>
            <p className="max-w-3xl pb-6 pr-12 text-sm leading-7 text-foreground/56">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ProductSections() {
  const { isSignedIn } = useUser();

  return (
    <div className="overflow-x-hidden px-4 pb-14 sm:px-6 lg:px-10">
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
          title="Show the actual project, not an abstract dashboard."
          body="Use curated product data, visuals, and decisions so the landing page feels like a real studio workflow."
        >
          <ConceptWorkspaceMock />
        </ShowcaseSection>

        <ShowcaseSection
          id="workflow"
          visual={conceptVisuals[1]}
          eyebrow="Everywhere in the workflow"
          title="Turn aesthetic decisions into sourcing work."
          body="The shopping list keeps furniture, finishes, quotes, and next steps attached to the same visual direction."
          reverse
        >
          <ShoppingWorkspaceMock />
        </ShowcaseSection>

        <ProjectSystemSection />

        <ShowcaseSection
          id="client-collaboration"
          visual={conceptVisuals[2]}
          eyebrow="Client collaboration"
          title="Approvals stay attached to the direction they saw."
          body="Collect structured feedback, estimates, and reporting without splitting the conversation from the concept."
          reverse
        >
          <ClientReviewMock />
        </ShowcaseSection>

        <CommercialLayerSection />

        <ShowcaseSection
          id="resources"
          visual={conceptVisuals[3]}
          eyebrow="Studio memory"
          title="Reuse approved products instead of rebuilding every choice."
          body="Save the final direction, reports, and product decisions so the next project starts with context."
          reverse
        >
          <ProductLibraryMock />
        </ShowcaseSection>

        <WebClipperSection />

        <PricingSection isSignedIn={isSignedIn ?? false} />

        <FAQSection />

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
            <Link href={isSignedIn ? "/organisation" : "/sign-up"}>
              {isSignedIn ? "Open dashboard" : "Start with Myvibe"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
