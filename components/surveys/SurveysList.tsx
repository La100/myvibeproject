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
  MessageSquareText,
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
            <Card
              key={survey._id}
              className="group overflow-hidden rounded-[28px] border-border/70 bg-card/92 py-0 shadow-[0_24px_70px_-54px_rgba(24,20,16,0.42)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/12 hover:shadow-[0_34px_90px_-58px_rgba(24,20,16,0.5)]"
            >
              <CardHeader className="gap-5 px-5 pb-0 pt-5">
                {survey.isRequired || survey.allowMultipleResponses ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {survey.isRequired ? (
                      <Badge
                        variant="secondary"
                        className="border-border/60 bg-[#f7eadf] px-3 py-1.5 text-[11px] text-[#7a3f1d]"
                      >
                        {t("surveys", "required")}
                      </Badge>
                    ) : null}
                    {survey.allowMultipleResponses ? (
                      <Badge
                        variant="outline"
                        className="border-border/70 bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
                      >
                        {t("surveys", "repeatSubmissions")}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}

                <div className="min-h-[116px]">
                  <CardTitle className="clean-title line-clamp-2 text-[1.55rem] font-medium leading-[1.04] tracking-[-0.025em] text-foreground">
                    {survey.title}
                  </CardTitle>
                  {survey.description && (
                    <CardDescription className="mt-4 line-clamp-2 max-w-[34ch] text-[14px] leading-6 text-muted-foreground">
                      {survey.description}
                    </CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 px-5 pb-5 pt-2">
                <div className="vibe-row grid grid-cols-2 gap-0 overflow-hidden rounded-[20px] border-border/70 bg-secondary/58 text-xs shadow-none">
                  <div className="flex min-w-0 flex-col gap-1.5 border-r border-border/70 px-4 py-3.5">
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <ClipboardList className="size-3.5 shrink-0" />
                      {t("surveys", "questions")}
                    </span>
                    <span className="font-serif text-[1.6rem] font-medium leading-none tracking-[-0.04em] text-foreground">
                      {survey.questionCount ?? 0}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5">
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <MessageSquareText className="size-3.5 shrink-0" />
                      {t("surveys", "responses")}
                    </span>
                    <span className="font-serif text-[1.6rem] font-medium leading-none tracking-[-0.04em] text-foreground">
                      {survey.responseCount ?? 0}
                    </span>
                  </div>
                </div>

                <div
                  className={
                    canEdit ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"
                  }
                >
                  {canEdit && (
                    <Button
                      asChild
                      size="sm"
                      className="col-span-2 h-10 rounded-full px-4 shadow-[0_16px_34px_-24px_rgba(24,20,16,0.7)]"
                    >
                      <Link
                        href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}
                      >
                        <BarChart3 data-icon="inline-start" />
                        {t("surveys", "responses")}
                      </Link>
                    </Button>
                  )}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-10 min-w-0 rounded-full border-border/70 bg-card px-4 shadow-none"
                  >
                    <Link
                      href={`/organisation/projects/${projectSlug}/surveys/${survey._id}`}
                    >
                      <Eye data-icon="inline-start" />
                      {t("surveys", "view")}
                    </Link>
                  </Button>
                  {canEdit ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-10 min-w-0 rounded-full border-border/70 bg-card px-4 shadow-none"
                    >
                      <Link
                        href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}
                      >
                        <Edit data-icon="inline-start" />
                        {t("surveys", "editSurvey")}
                      </Link>
                    </Button>
                  ) : null}
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
