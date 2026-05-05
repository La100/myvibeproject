import { Suspense } from "react";
import { apiAny } from "@/lib/convexApiAny";
import { preloadQuery } from "convex/nextjs";
import { SurveyForm } from "@/components/surveys/SurveyForm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@clerk/nextjs/server";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

interface NewSurveyPageProps {
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function NewSurveyPage({ params }: NewSurveyPageProps) {
  const { projectSlug } = await params;
  const { orgId } = await auth();

  const preloadedProject = orgId
    ? preloadQuery(apiAny.projects.getProjectBySlugInClerkOrg, {
      clerkOrgId: orgId,
      projectSlug,
    })
    : null;

  return (
    <Suspense fallback={<NewSurveyLoading />}>
      <NewSurveyContent
        preloadedProject={preloadedProject}
        projectSlug={projectSlug}
      />
    </Suspense>
  );
}

async function NewSurveyContent({
  preloadedProject,
  projectSlug
}: {
  preloadedProject: ReturnType<typeof preloadQuery> | null;
  projectSlug: string;
}) {
  if (!preloadedProject) {
    return (
      <ProjectPageLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization required</CardTitle>
              <CardDescription>
                You need to be part of an organization to create surveys.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProjectPageLayout>
    );
  }

  const project = await preloadedProject;

  if (!project) {
    return (
      <ProjectPageLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Project not found</CardTitle>
              <CardDescription>
                We couldn't find a project with that name.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProjectPageLayout>
    );
  }

  return (
    <ProjectPageLayout>
      <SurveyForm projectSlug={projectSlug} />
    </ProjectPageLayout>
  );
}

function NewSurveyLoading() {
  return <Spinner className="container mx-auto max-w-4xl p-6" />;
}
