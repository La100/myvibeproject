"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Contact, Package } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const libraryItems = [
  {
    titleKey: "teamContacts",
    descriptionKey: "teamContactsDescription",
    href: "/organisation/contacts",
    icon: Contact,
  },
  {
    titleKey: "productLibrary",
    descriptionKey: "productLibraryDescription",
    href: "/organisation/product-library",
    icon: Package,
  },
  {
    titleKey: "surveyLibrary",
    descriptionKey: "surveyLibraryDescription",
    href: "/organisation/survey-library",
    icon: ClipboardList,
  },
];

export default function LibrariesPage() {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur md:px-7">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[2rem] leading-none tracking-[-0.04em] text-foreground">
            {t("librariesPage", "title")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("librariesPage", "description")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-6 md:grid-cols-2 md:px-7 xl:grid-cols-3">
        {libraryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-3xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-sm"
          >
            <div className="flex h-full min-h-44 flex-col justify-between gap-6">
              <div>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-secondary/70 text-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">
                  {t("librariesPage", item.titleKey)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("librariesPage", item.descriptionKey)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{t("librariesPage", "openLibrary")}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
