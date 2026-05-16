"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

const LAST_UPDATED = "April 14, 2026";

const sectionKeyGroups = [
  ["scopeTitle", "scopeBody1", "scopeBody2", "scopeBody3", "scopeBody4"],
  ["eligibilityTitle", "eligibilityBody1", "eligibilityBody2", "eligibilityBody3"],
  ["serviceTitle", "serviceBody1", "serviceBody2", "serviceBody3", "serviceBody4", "serviceBody5"],
  ["billingTitle", "billingBody1", "billingBody2", "billingBody3", "billingBody4", "billingBody5"],
  ["dataTitle", "dataBody1", "dataBody2", "dataBody3", "dataBody4", "dataBody5"],
  ["aiTitle", "aiBody1", "aiBody2", "aiBody3", "aiBody4"],
  ["acceptableTitle", "acceptableBody1", "acceptableBody2", "acceptableBody3", "acceptableBody4"],
  ["thirdPartyTitle", "thirdPartyBody1", "thirdPartyBody2"],
  ["ipTitle", "ipBody1", "ipBody2", "ipBody3"],
  ["terminationTitle", "terminationBody1", "terminationBody2", "terminationBody3"],
  ["disclaimersTitle", "disclaimersBody1", "disclaimersBody2"],
  ["liabilityTitle", "liabilityBody1", "liabilityBody2", "liabilityBody3"],
  ["indemnityTitle", "indemnityBody1"],
  ["changesTitle", "changesBody1", "changesBody2"],
  ["lawTitle", "lawBody1", "lawBody2"],
  ["contactTitle", "contactBody1"],
] as const;

export default function TermsOfServicePage() {
  const { t } = useI18n();

  const sections = sectionKeyGroups.map(([titleKey, ...bodyKeys]) => ({
    title: t("termsSections", titleKey),
    body: bodyKeys.map((key) => t("termsSections", key)),
  }));

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl">
            {t("publicPages", "termsTitle")}
          </CardTitle>
          <CardDescription>
            {t("publicPages", "lastUpdated", { date: LAST_UPDATED })}
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground">
          <p>{t("publicPages", "termsIntro")}</p>

          {sections.map((section) => (
            <section key={section.title} className="mt-6">
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
