"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Edit, BarChart3 } from "lucide-react";
import Link from "next/link";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project } = useProject();
  const router = useRouter();

  const surveys = useQuery(apiAny.surveys.getSurveysByProject, {
    projectId: project._id,
  });

  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember, {
    teamId: project.teamId
  });

  const isAdmin = currentUserMember?.role === "admin";
  const isMember = currentUserMember?.role === "member";
  const canEdit = isAdmin || isMember;


  return (
    <div className="flex flex-col gap-6">
      <ProjectPageHeader
        title="Surveys"
        icon={<BarChart3 className="h-8 w-8 text-primary" />}
        actions={
          canEdit ? (
            <Button asChild>
              <Link href={`/organisation/projects/${projectSlug}/surveys/new`}>
                <Plus data-icon="inline-start" />
                New Survey
              </Link>
            </Button>
          ) : undefined
        }
      />

      {surveys?.length === 0 ? (
        <EmptyState
          className="border border-border bg-card"
          icon={BarChart3}
          title="No Surveys"
          description="You don't have any surveys yet. Create your first survey to start collecting feedback."
          action={canEdit ? {
            label: "Create First Survey",
            onClick: () => router.push(`/organisation/projects/${projectSlug}/surveys/new`),
            icon: Plus,
          } : undefined}
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
                  {canEdit && (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}>
                          <Edit data-icon="inline-start" />
                          Edit
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}>
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
    </div>
  );
}
