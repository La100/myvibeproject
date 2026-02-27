"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, BarChart3 } from "lucide-react";
import Link from "next/link";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project } = useProject();

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
    <div className="space-y-6">
      <ProjectPageHeader
        title="Surveys"
        icon={<BarChart3 className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        subtitle={`Manage surveys for ${project.name}`}
        actions={
          canEdit ? (
            <Link href={`/organisation/projects/${projectSlug}/surveys/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Survey
              </Button>
            </Link>
          ) : undefined
        }
      />

      {surveys?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Surveys</CardTitle>
            <CardDescription>
              You don't have any surveys yet. Create your first survey to start collecting feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit && (
              <Link href={`/organisation/projects/${projectSlug}/surveys/new`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Survey
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {surveys?.map((survey) => (
            <Card key={survey._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{survey.title}</CardTitle>
                {survey.description && (
                  <CardDescription className="line-clamp-2">
                    {survey.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex gap-2 flex-wrap">
                  {canEdit && (
                    <>
                      <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      </Link>
                      <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="mr-1 h-3 w-3" />
                          Responses
                        </Button>
                      </Link>
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
