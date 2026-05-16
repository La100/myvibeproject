import { Suspense } from "react";
import { apiAny } from "@/lib/convexApiAny";
import { preloadQuery } from "convex/nextjs";
import { SurveyForm } from "@/components/surveys/SurveyForm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { getLocaleFromAcceptLanguage, type Locale } from "@/lib/i18nConfig";

interface NewSurveyPageProps {
  params: Promise<{
    projectSlug: string;
  }>;
}

const serverCopy = {
  en: {
    organizationRequired: "Organization required",
    organizationRequiredDescription:
      "You need to be part of an organization to create surveys.",
    projectNotFound: "Project not found",
    projectNotFoundDescription: "We couldn't find a project with that name.",
  },
  pl: {
    organizationRequired: "Wymagana organizacja",
    organizationRequiredDescription:
      "Musisz należeć do organizacji, aby tworzyć ankiety.",
    projectNotFound: "Nie znaleziono projektu",
    projectNotFoundDescription: "Nie znaleźliśmy projektu o tej nazwie.",
  },
} satisfies Record<Locale, Record<string, string>>;

async function getRequestLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get("myvibe.locale")?.value;
  if (cookieLocale === "en" || cookieLocale === "pl") {
    return cookieLocale;
  }
  return getLocaleFromAcceptLanguage((await headers()).get("accept-language"));
}

export default async function NewSurveyPage({ params }: NewSurveyPageProps) {
  const { projectSlug } = await params;
  const { orgId } = await auth();
  const locale = await getRequestLocale();

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
        locale={locale}
      />
    </Suspense>
  );
}

async function NewSurveyContent({
  preloadedProject,
  projectSlug,
  locale,
}: {
  preloadedProject: ReturnType<typeof preloadQuery> | null;
  projectSlug: string;
  locale: Locale;
}) {
  const copy = serverCopy[locale];

  if (!preloadedProject) {
    return (
      <ProjectPageLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>{copy.organizationRequired}</CardTitle>
              <CardDescription>
                {copy.organizationRequiredDescription}
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
              <CardTitle>{copy.projectNotFound}</CardTitle>
              <CardDescription>
                {copy.projectNotFoundDescription}
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
