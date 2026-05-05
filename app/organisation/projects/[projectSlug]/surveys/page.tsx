import { Suspense } from "react";
import { apiAny } from "@/lib/convexApiAny";
import { preloadQuery } from "convex/nextjs";
import { SurveysList } from "@/components/surveys/SurveysList";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@clerk/nextjs/server";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

interface SurveysPageProps {
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function SurveysPage({ params }: SurveysPageProps) {
  const { projectSlug } = await params;
  const { orgId } = await auth();

  const preloadedProject = orgId
    ? preloadQuery(apiAny.projects.getProjectBySlugInClerkOrg, {
      clerkOrgId: orgId,
      projectSlug,
    })
    : null;

  return (
    <Suspense fallback={<SurveysLoading />}>
      <SurveysContent preloadedProject={preloadedProject} projectSlug={projectSlug} />
    </Suspense>
  );
}

async function SurveysContent({ preloadedProject, projectSlug }: { preloadedProject: ReturnType<typeof preloadQuery> | null; projectSlug: string }) {
  if (!preloadedProject) {
    return (
      <ProjectPageLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization required</CardTitle>
              <CardDescription>
                You need to be part of an organization to access surveys.
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
      <SurveysList projectSlug={projectSlug} />
    </ProjectPageLayout>
  );
}

function SurveysLoading() {
  return <Spinner className="container mx-auto p-6" />;
}
