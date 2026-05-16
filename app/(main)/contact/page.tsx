"use client";

import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "./contact-form";
import { useI18n } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-[calc(100svh-6rem)] bg-background px-5 pb-12 pt-6 md:px-8">
      <section className="mx-auto flex w-full max-w-2xl justify-center">
        <Card className="w-full border-border/70">
          <CardHeader className="gap-3 pb-6 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-border/70 bg-card text-foreground">
              <Mail />
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle className="font-serif text-4xl font-medium leading-none">
                {t("publicPages", "contactTitle")}
              </CardTitle>
              <CardDescription>
                {t("publicPages", "contactDescription")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
