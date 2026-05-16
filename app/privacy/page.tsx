"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"

const LAST_UPDATED = "February 20, 2026"

export default function PrivacyPolicyPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl">
            {t("publicPages", "privacyTitle")}
          </CardTitle>
          <CardDescription>
            {t("publicPages", "lastUpdated", { date: LAST_UPDATED })}
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground">
          <p>{t("publicPages", "privacyIntro")}</p>

          <h2>{t("publicPages", "privacyDataTitle")}</h2>
          <p>{t("publicPages", "privacyDataIntro")}</p>
          <ul>
            <li>{t("publicPages", "privacyDataAuth")}</li>
            <li>{t("publicPages", "privacyDataMetadata")}</li>
            <li>{t("publicPages", "privacyDataProduct")}</li>
            <li>{t("publicPages", "privacyDataSignals")}</li>
          </ul>

          <h2>{t("publicPages", "privacyUseTitle")}</h2>
          <p>{t("publicPages", "privacyUseIntro")}</p>
          <ul>
            <li>{t("publicPages", "privacyUseAuth")}</li>
            <li>{t("publicPages", "privacyUseDisplay")}</li>
            <li>{t("publicPages", "privacyUseCreate")}</li>
            <li>{t("publicPages", "privacyUseReliability")}</li>
          </ul>

          <h2>{t("publicPages", "privacyStorageTitle")}</h2>
          <p>{t("publicPages", "privacyStorageBody")}</p>

          <h2>{t("publicPages", "privacySharingTitle")}</h2>
          <p>{t("publicPages", "privacySharingBody")}</p>

          <h2>{t("publicPages", "privacyRetentionTitle")}</h2>
          <p>{t("publicPages", "privacyRetentionBody")}</p>

          <h2>{t("publicPages", "privacySecurityTitle")}</h2>
          <p>{t("publicPages", "privacySecurityBody")}</p>

          <h2>{t("publicPages", "privacyChoicesTitle")}</h2>
          <ul>
            <li>{t("publicPages", "privacyChoicesSignOut")}</li>
            <li>{t("publicPages", "privacyChoicesReview")}</li>
            <li>{t("publicPages", "privacyChoicesContact")}</li>
          </ul>

          <h2>{t("publicPages", "privacyContactTitle")}</h2>
          <p>
            {t("publicPages", "privacyContactBody")}{" "}
            <a href="mailto:privacy@myvibeproject.com">privacy@myvibeproject.com</a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
