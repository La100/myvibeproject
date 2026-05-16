"use client";

import Link from "next/link";
import { Instagram } from "lucide-react";
import Logo from "../Logo";
import { useI18n } from "@/lib/i18n";

const footerLinks = [
  {
    titleKey: "product",
    links: [
      { labelKey: "overview", href: "/#product" },
      { labelKey: "workflow", href: "/#workflow" },
      { labelKey: "webClipper", href: "/#web-clipper" },
      { labelKey: "clientPortal", href: "/#client-collaboration" },
    ],
  },
  {
    titleKey: "resources",
    links: [
      { labelKey: "studioMemory", href: "/#resources" },
      { labelKey: "pricing", href: "/#pricing" },
      { labelKey: "faq", href: "/#faq" },
    ],
  },
  {
    titleKey: "legal",
    links: [
      { labelKey: "privacy", href: "/privacy" },
      { labelKey: "terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/40 pt-16 pb-10 px-6">
      <div className="mx-auto max-w-[1440px] sm:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
          <div className="md:col-span-1">
            <div className="mb-5">
              <Logo
                className="size-12 sm:size-14"
                showWordmark
                wordmarkClassName="text-[1.45rem] sm:text-[1.8rem]"
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("landingFooter", "tagline")}
            </p>
          </div>

          {footerLinks.map((column) => (
            <div key={column.titleKey} className="md:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-5">
                {t("landingFooter", column.titleKey)}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {t("landingFooter", link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 md:flex-row justify-between items-center pt-6 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            {t("landingFooter", "copyright", { year: new Date().getFullYear() })}
          </p>
          <Link
            href="https://www.instagram.com/myvibeproject/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Myvibe project on Instagram"
            className="inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            <Instagram className="size-4" aria-hidden="true" />
            Instagram
          </Link>
        </div>
      </div>
    </footer>
  );
}
