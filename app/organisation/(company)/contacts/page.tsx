"use client";

import { Suspense } from "react";
import { ContactsView } from "./components/ContactsView";
import { useI18n } from "@/lib/i18n";

export default function ContactsPage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("contactsPage", "title")}</h1>
      </div>
      
      <Suspense fallback={<div>{t("contactsPage", "loading")}</div>}>
        <ContactsView />
      </Suspense>
    </div>
  );
}
