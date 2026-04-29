"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BarChart3,
  Edit,
  Eye,
  FileText,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";

type QuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file";

const questionTypeLabels: Record<QuestionType, string> = {
  text_short: "Short Text",
  text_long: "Long Text",
  multiple_choice: "Multiple Choice",
  single_choice: "Single Choice",
  rating: "Rating Scale",
  yes_no: "Yes/No",
  number: "Number",
  file: "File Upload",
};

function getQuestionTypeLabel(questionType: string) {
  return questionTypeLabels[questionType as QuestionType] ?? "Question";
}

function questionNeedsOptions(questionType: string) {
  return questionType === "single_choice" || questionType === "multiple_choice";
}

export default function SurveyPreviewPage() {
  const router = useRouter();
  const params = useParams<{
    projectSlug: string;
    surveyId: string;
  }>();
  const surveyId = params.surveyId as Id<"surveys">;
  const projectSlug = params.projectSlug;

  const survey = useQuery(apiAny.surveys.getSurvey, { surveyId });

  if (!survey) {
    return <div>Loading...</div>;
  }

  const questionCount = survey.questions.length;
  const requiredQuestionCount = survey.questions.filter(
    (question) => question.isRequired,
  ).length;

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-6">
        <ProjectPageHeader
          title={survey.title}
          icon={<Eye className="h-8 w-8 text-primary" />}
          subtitle={survey.description || "Survey preview"}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
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
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-foreground" />
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{questionCount}</div>
              <p className="text-sm text-muted-foreground">
                {questionCount === 1 ? "Question" : "Questions"} in this survey
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="h-5 w-5 text-foreground" />
                Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requiredQuestionCount}</div>
              <p className="text-sm text-muted-foreground">
                Questions clients must answer
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-foreground" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">
                {survey.status}
              </Badge>
              <p className="mt-3 text-sm text-muted-foreground">
                {survey.allowMultipleResponses
                  ? "Multiple responses allowed"
                  : "One response per respondent"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Survey Questions</CardTitle>
            <CardDescription>
              Read-only structure of the survey shown to clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {survey.questions.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                This survey has no questions yet.
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {survey.questions.map((question, index) => (
                  <div
                    key={question._id}
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Question {index + 1}</Badge>
                      <Badge variant="secondary">
                        {getQuestionTypeLabel(question.questionType)}
                      </Badge>
                      {question.isRequired ? (
                        <Badge variant="destructive">Required</Badge>
                      ) : null}
                    </div>

                    <h2 className="mt-4 text-lg font-semibold">
                      {question.questionText}
                    </h2>

                    {questionNeedsOptions(question.questionType) ? (
                      <>
                        <Separator className="my-4" />
                        {(question.options?.length ?? 0) > 0 ? (
                          <div className="flex flex-col gap-2">
                            {question.options?.map((option, optionIndex) => (
                              <div
                                key={`${question._id}-${optionIndex}`}
                                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No options configured.
                          </p>
                        )}
                      </>
                    ) : null}

                    {question.questionType === "rating" ? (
                      <>
                        <Separator className="my-4" />
                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <div>
                            <span className="font-medium">Min:</span>{" "}
                            {question.ratingScale?.minLabel ||
                              question.ratingScale?.min ||
                              1}
                          </div>
                          <div>
                            <span className="font-medium">Max:</span>{" "}
                            {question.ratingScale?.maxLabel ||
                              question.ratingScale?.max ||
                              5}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectPageLayout>
  );
}
