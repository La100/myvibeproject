"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Edit,
  Eye,
  FileText,
  HelpCircle,
  Paperclip,
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

function getRatingValues(question: {
  ratingScale?: { min?: number; max?: number };
}) {
  const min = question.ratingScale?.min ?? 1;
  const max = question.ratingScale?.max ?? 5;
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
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
                Clients can submit another response whenever needed.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Survey Questions</CardTitle>
                <CardDescription>
                  Read-only preview of the structure clients will answer.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {requiredQuestionCount} required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {survey.questions.length === 0 ? (
              <div className="m-5 rounded-xl border border-border bg-secondary/60 p-6 text-sm text-muted-foreground">
                This survey has no questions yet.
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {survey.questions.map((question, index) => (
                  <div
                    key={question._id}
                    className="grid gap-5 p-5 md:grid-cols-[220px_1fr]"
                  >
                    <div>
                      <Badge variant="outline" className="rounded-full">
                        Question {index + 1}
                      </Badge>
                      <Badge variant="secondary" className="mt-2 block w-fit">
                        {getQuestionTypeLabel(question.questionType)}
                      </Badge>
                      {question.isRequired ? (
                        <Badge variant="outline" className="mt-2 block w-fit">
                          <CheckCircle2 data-icon="inline-start" />
                          Required
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold leading-7">
                        {question.questionText}
                      </h2>

                      {questionNeedsOptions(question.questionType) ? (
                        (question.options?.length ?? 0) > 0 ? (
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {question.options?.map((option, optionIndex) => (
                              <div
                                key={`${question._id}-${optionIndex}`}
                                className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm"
                              >
                                <span className="h-4 w-4 rounded-full border border-primary/50 bg-card" />
                                {option}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">
                            No options configured.
                          </p>
                        )
                      ) : null}

                      {question.questionType === "rating" ? (
                        <div className="mt-4 max-w-lg">
                          {(question.ratingScale?.minLabel ||
                            question.ratingScale?.maxLabel) ? (
                            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                              <span className="min-w-0 truncate">
                                {question.ratingScale?.minLabel ||
                                  question.ratingScale?.min ||
                                  1}
                              </span>
                              <span className="min-w-0 truncate text-right">
                                {question.ratingScale?.maxLabel ||
                                  question.ratingScale?.max ||
                                  5}
                              </span>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-5 gap-2">
                            {getRatingValues(question).map((value) => (
                              <div
                                key={value}
                                className="flex h-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-sm font-semibold"
                              >
                                {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {question.questionType === "file" ? (
                        <div className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-dashed border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            File upload field
                          </span>
                        </div>
                      ) : null}
                    </div>
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
