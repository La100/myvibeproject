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
} from "lucide-react";
import Link from "next/link";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

type SurveyTemplateSummary = {
  _id: Id<"surveyTemplates">;
  title: string;
  description?: string;
  questionCount: number;
  isRequired?: boolean;
  allowMultipleResponses?: boolean;
};

interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project } = useProject();
  const router = useRouter();
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [creatingFromTemplateId, setCreatingFromTemplateId] =
    useState<Id<"surveyTemplates"> | null>(null);

  const surveys = useQuery(apiAny.surveys.getSurveysByProject, {
    projectId: project._id,
  });
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
      toast.success("Survey created from template");
      setIsTemplateDialogOpen(false);
    } catch (error) {
      toast.error("Could not create survey from template", {
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
        title="Surveys"
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
                Use Template
              </Button>
              <Button asChild>
                <Link
                  href={`/organisation/projects/${projectSlug}/surveys/new`}
                >
                  <Plus data-icon="inline-start" />
                  New Survey
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
          title="No Surveys"
          description="You don't have any surveys yet. Create your first survey to start collecting feedback."
          action={
            canEdit
              ? {
                  label: "Create First Survey",
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
                  label: "Use Template",
                  onClick: () => setIsTemplateDialogOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {surveys?.map((survey) => (
            <Card key={survey._id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{survey.title}</CardTitle>
                {survey.description && (
                  <CardDescription className="line-clamp-2">
                    {survey.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/organisation/projects/${projectSlug}/surveys/${survey._id}`}
                    >
                      <Eye data-icon="inline-start" />
                      View
                    </Link>
                  </Button>
                  {canEdit && (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}
                        >
                          <Edit data-icon="inline-start" />
                          Edit
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}
                        >
                          <BarChart3 data-icon="inline-start" />
                          Responses
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
            <DialogTitle>Use Survey Template</DialogTitle>
            <DialogDescription>
              Copy a reusable organization template into this project.
            </DialogDescription>
          </DialogHeader>

          {!templates || templates.length === 0 ? (
            <EmptyState
              className="border border-border bg-card py-12"
              icon={ClipboardList}
              title="No survey templates yet"
              description="Create templates in the organization survey library before using them in projects."
              action={{
                label: "Open Survey Library",
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
                          ? "question"
                          : "questions"}
                      </Badge>
                      {template.isRequired ? (
                        <Badge variant="outline">Required</Badge>
                      ) : null}
                      {template.allowMultipleResponses ? (
                        <Badge variant="outline">Multiple responses</Badge>
                      ) : null}
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
                        ? "Creating..."
                        : "Use Template"}
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
