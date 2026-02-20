"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { EditSurveyForm } from "@/components/surveys/EditSurveyForm";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = params.surveyId as Id<"surveys">;

  const survey = useQuery(apiAny.surveys.getSurvey, { surveyId });

  if (!survey) {
    return <div>Ładowanie...</div>;
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
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Edytuj ankietę</h1>
        <EditSurveyForm survey={transformedSurvey} />
      </div>
    </ProjectPageLayout>
  );
}