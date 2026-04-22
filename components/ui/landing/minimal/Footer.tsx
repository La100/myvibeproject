import Link from "next/link";
import Logo from "../Logo";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/#product" },
      { label: "Workflow", href: "/#workflow" },
      { label: "Client Portal", href: "/#client-collaboration" },
    ],
  },
  {
    title: "Resources",
    links: [{ label: "Studio Memory", href: "/#resources" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
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
              Run architectural projects with AI-powered workflows.
            </p>
          </div>

          {footerLinks.map((column) => (
            <div key={column.title} className="md:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-5">
                {column.title}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Myvibe project Inc. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
