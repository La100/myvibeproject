"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { ClipboardList, Edit, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type SurveyTemplateSummary = {
  _id: Id<"surveyTemplates">;
  title: string;
  description?: string;
  questionCount: number;
  updatedAt: number;
};

export function SurveyLibraryView() {
  const { t } = useI18n();
  const router = useRouter();
  const { organization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<Id<"surveyTemplates"> | null>(
    null,
  );

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const templates = useQuery(
    apiAny.surveyTemplates.listTemplates,
    team ? { teamId: team._id } : "skip",
  ) as SurveyTemplateSummary[] | undefined;
  const deleteTemplate = useMutation(apiAny.surveyTemplates.deleteTemplate);

  const filteredTemplates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return templates ?? [];
    }

    return (templates ?? []).filter((template) =>
      [template.title, template.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [searchTerm, templates]);

  const handleDelete = async (template: SurveyTemplateSummary) => {
    if (
      !confirm(
        t("surveys", "deleteTemplateConfirm").replace(
          "{title}",
          template.title,
        ),
      )
    ) {
      return;
    }

    setDeletingId(template._id);
    try {
      await deleteTemplate({ templateId: template._id });
      toast.success(t("surveys", "surveyTemplateDeleted"));
    } catch (error) {
      toast.error(t("surveys", "couldNotDeleteTemplate"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur md:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-[2rem] leading-none tracking-[-0.04em] text-foreground">
              {t("surveys", "surveyLibrary")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("surveys", "saveReusableTemplates")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="relative min-w-[220px] flex-1 xl:w-[320px] xl:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("surveys", "searchTemplates")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 rounded-2xl border-border/70 bg-card pl-10 shadow-none"
              />
            </div>
            <Button asChild className="h-10 rounded-2xl px-4">
              <Link href="/organisation/survey-library/new">
                <Plus data-icon="inline-start" />
                {t("surveys", "newTemplate")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-6 md:px-7">
        {filteredTemplates.length === 0 ? (
          <EmptyState
            title={t("surveys", "createFirstTemplate")}
            description={t("surveys", "saveReusableTemplatesEmpty")}
            action={{
              label: t("surveys", "newTemplate"),
              onClick: () => router.push("/organisation/survey-library/new"),
              icon: Plus,
            }}
            className="border-0 bg-card"
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card key={template._id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList data-icon="inline-start" />
                      <Badge variant="secondary">
                        {template.questionCount}{" "}
                        {template.questionCount === 1
                          ? t("surveys", "questionCountSingular")
                          : t("surveys", "questionCountPlural")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={`/organisation/survey-library/${template._id}/edit`}
                        >
                          <Edit />
                          <span className="sr-only">{t("surveys", "editTemplate")}</span>
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === template._id}
                        onClick={() => handleDelete(template)}
                      >
                        <Trash2 />
                        <span className="sr-only">{t("surveys", "deleteTemplate")}</span>
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{template.title}</CardTitle>
                  {template.description ? (
                    <CardDescription className="line-clamp-2">
                      {template.description}
                    </CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
