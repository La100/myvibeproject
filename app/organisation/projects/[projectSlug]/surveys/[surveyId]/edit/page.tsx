"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { EditSurveyForm } from "@/components/surveys/EditSurveyForm";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { AppLoadingState } from "@/components/ui/loading-state";
import { useI18n } from "@/lib/i18n";

export default function EditSurveyPage() {
  const { t } = useI18n();
  const params = useParams();
  const surveyId = params.surveyId as Id<"surveys">;

  const survey = useQuery(apiAny.surveys.getSurvey, { surveyId });

  if (!survey) {
    return (
      <AppLoadingState
        variant="section"
        title={t("surveyPages", "loadingSurvey")}
        description={t("surveyPages", "preparingEditor")}
      />
    );
  }

  // Transform the survey data to match the expected format
  const transformedSurvey = {
    ...survey,
    questions: survey.questions?.map(question => ({
      ...question,
      id: question._id.toString(), // Map _id to string id
    })) || []
  };

  return (
    <ProjectPageLayout>
      <div>
        <EditSurveyForm survey={transformedSurvey} />
      </div>
    </ProjectPageLayout>
  );
}
