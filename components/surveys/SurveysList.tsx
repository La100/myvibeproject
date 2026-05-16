"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  BarChart3,
  ClipboardList,
  Library,
  Eye,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { useI18n } from "@/lib/i18n";

type SurveyTemplateSummary = {
  _id: Id<"surveyTemplates">;
  title: string;
  description?: string;
  questionCount: number;
};

type SurveySummary = {
  _id: Id<"surveys">;
  title: string;
  description?: string;
  status: "draft" | "active" | "closed";
  isRequired: boolean;
  allowMultipleResponses: boolean;
  questionCount?: number;
  requiredQuestionCount?: number;
  responseCount?: number;
};

interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project } = useProject();
  const { t } = useI18n();
  const router = useRouter();
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [creatingFromTemplateId, setCreatingFromTemplateId] =
    useState<Id<"surveyTemplates"> | null>(null);

  const surveys = useQuery(apiAny.surveys.getSurveysByProject, {
    projectId: project._id,
  }) as SurveySummary[] | undefined;
  const templates = useQuery(apiAny.surveyTemplates.listTemplates, {
    teamId: project.teamId,
  }) as SurveyTemplateSummary[] | undefined;

  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember, {
    teamId: project.teamId,
  });
  const createSurveyFromTemplate = useMutation(
    apiAny.surveyTemplates.createSurveyFromTemplate,
  );

  const isAdmin = currentUserMember?.role === "admin";
  const isMember = currentUserMember?.role === "member";
  const canEdit = isAdmin || isMember;

  const handleUseTemplate = async (template: SurveyTemplateSummary) => {
    setCreatingFromTemplateId(template._id);
    try {
      await createSurveyFromTemplate({
        projectId: project._id,
        templateId: template._id,
      });
      toast.success(t("surveys", "surveyCreatedFromTemplate"));
      setIsTemplateDialogOpen(false);
    } catch (error) {
      toast.error(t("surveys", "couldNotCreateFromTemplate"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setCreatingFromTemplateId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProjectPageHeader
        title={t("surveys", "surveys")}
        icon={<BarChart3 className="h-8 w-8 text-primary" />}
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTemplateDialogOpen(true)}
              >
                <Library data-icon="inline-start" />
                {t("surveys", "useTemplate")}
              </Button>
              <Button asChild>
                <Link
                  href={`/organisation/projects/${projectSlug}/surveys/new`}
                >
                  <Plus data-icon="inline-start" />
                  {t("surveys", "newSurvey")}
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {surveys?.length === 0 ? (
        <EmptyState
          className="border border-border bg-card"
          icon={BarChart3}
          title={t("surveys", "noSurveys")}
          description={t("surveys", "noSurveysDescription")}
          action={
            canEdit
              ? {
                  label: t("surveys", "createFirstSurvey"),
                  onClick: () =>
                    router.push(
                      `/organisation/projects/${projectSlug}/surveys/new`,
                    ),
                  icon: Plus,
                }
              : undefined
          }
          secondaryAction={
            canEdit
              ? {
                  label: t("surveys", "useTemplate"),
                  onClick: () => setIsTemplateDialogOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {surveys?.map((survey) => (
            <Card key={survey._id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {t("surveys", `status${survey.status.charAt(0).toUpperCase()}${survey.status.slice(1)}`)}
                  </Badge>
                  {survey.isRequired ? (
                    <Badge variant="secondary">{t("surveys", "required")}</Badge>
                  ) : null}
                  <Badge variant="outline">{t("surveys", "repeatSubmissions")}</Badge>
                </div>
                <CardTitle className="line-clamp-2 text-xl">
                  {survey.title}
                </CardTitle>
                {survey.description && (
                  <CardDescription className="line-clamp-2 leading-6">
                    {survey.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary/60 p-2 text-xs">
                  <div className="rounded-lg bg-card px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HelpCircle className="h-3.5 w-3.5" />
                      {t("surveys", "questions")}
                    </div>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {survey.questionCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("surveys", "required")}
                    </div>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {survey.requiredQuestionCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {t("surveys", "responses")}
                    </div>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {survey.responseCount ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link
                      href={`/organisation/projects/${projectSlug}/surveys/${survey._id}`}
                    >
                      <Eye data-icon="inline-start" />
                      {t("surveys", "view")}
                    </Link>
                  </Button>
                  {canEdit && (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}
                        >
                          <Edit data-icon="inline-start" />
                          {t("surveys", "editSurvey")}
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link
                          href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}
                        >
                          <BarChart3 data-icon="inline-start" />
                          {t("surveys", "responses")}
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("surveys", "useSurveyTemplate")}</DialogTitle>
            <DialogDescription>
              {t("surveys", "templateUseDescription")}
            </DialogDescription>
          </DialogHeader>

          {!templates || templates.length === 0 ? (
            <EmptyState
              className="border border-border bg-card py-12"
              icon={ClipboardList}
              title={t("surveys", "noSurveyTemplatesYet")}
              description={t("surveys", "noSurveyTemplatesDescription")}
              action={{
                label: t("surveys", "openSurveyLibrary"),
                onClick: () => router.push("/organisation/survey-library"),
                icon: Library,
              }}
            />
          ) : (
            <div className="grid max-h-[62vh] gap-4 overflow-auto pr-1 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template._id}>
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {template.questionCount}{" "}
                        {template.questionCount === 1
                          ? t("surveys", "questionCountSingular")
                          : t("surveys", "questionCountPlural")}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                    {template.description ? (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={creatingFromTemplateId === template._id}
                      onClick={() => handleUseTemplate(template)}
                    >
                      <ClipboardList data-icon="inline-start" />
                      {creatingFromTemplateId === template._id
                        ? t("surveys", "creating")
                        : t("surveys", "useTemplate")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
