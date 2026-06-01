import { Languages } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { Button } from "./button";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "pl" ? "en" : "pl";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold"
      onClick={() => setLocale(nextLocale)}
      title={t("switchLanguage")}
      aria-label={t("switchLanguage")}
    >
      <Languages className="h-3.5 w-3.5" />
      {nextLocale.toUpperCase()}
    </Button>
  );
}
