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
import { AppLoadingState } from "@/components/ui/loading-state";
import { useI18n } from "@/lib/i18n";

type QuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file";

const questionTypeLabelKeys: Record<QuestionType, string> = {
  text_short: "shortText",
  text_long: "longText",
  multiple_choice: "multipleChoice",
  single_choice: "singleChoice",
  rating: "ratingScale",
  yes_no: "yesNo",
  number: "number",
  file: "fileUpload",
};

function getQuestionTypeLabel(
  questionType: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  return t("surveys", questionTypeLabelKeys[questionType as QuestionType] ?? "questionFallback");
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
  const { t } = useI18n();
  const params = useParams<{
    projectSlug: string;
    surveyId: string;
  }>();
  const surveyId = params.surveyId as Id<"surveys">;
  const projectSlug = params.projectSlug;

  const survey = useQuery(apiAny.surveys.getSurvey, { surveyId });

  if (!survey) {
    return (
      <AppLoadingState
        variant="section"
        title={t("surveys", "loadingSurvey")}
        description={t("surveys", "preparingSurveyDetails")}
      />
    );
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
          subtitle={survey.description || t("surveys", "surveyPreview")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft data-icon="inline-start" />
                {t("surveys", "back")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}
                >
                  <Edit data-icon="inline-start" />
                  {t("surveys", "editSurvey")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}
                >
                  <BarChart3 data-icon="inline-start" />
                  {t("surveys", "responses")}
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
                {t("surveys", "questions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{questionCount}</div>
              <p className="text-sm text-muted-foreground">
                {t("surveys", "questionsInSurvey", {
                  questionLabel:
                    questionCount === 1
                      ? t("surveys", "questionCountSingular")
                      : t("surveys", "questionCountPlural"),
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HelpCircle className="h-5 w-5 text-foreground" />
                {t("surveys", "required")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requiredQuestionCount}</div>
              <p className="text-sm text-muted-foreground">
                {t("surveys", "requiredQuestionsDescription")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-foreground" />
                {t("surveys", "status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize">
                {t("surveys", `status${survey.status.charAt(0).toUpperCase()}${survey.status.slice(1)}`)}
              </Badge>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("surveys", "clientsCanSubmitAnother")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{t("surveys", "surveyQuestions")}</CardTitle>
                <CardDescription>
                  {t("surveys", "readOnlyPreviewDescription")}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {t("surveys", "requiredCount", { count: requiredQuestionCount })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {survey.questions.length === 0 ? (
              <div className="m-5 rounded-xl border border-border bg-secondary/60 p-6 text-sm text-muted-foreground">
                {t("surveys", "surveyHasNoQuestions")}
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
                        {t("surveys", "question", { number: index + 1 })}
                      </Badge>
                      <Badge variant="secondary" className="mt-2 block w-fit">
                        {getQuestionTypeLabel(question.questionType, t)}
                      </Badge>
                      {question.isRequired ? (
                        <Badge variant="outline" className="mt-2 block w-fit">
                          <CheckCircle2 data-icon="inline-start" />
                          {t("surveys", "required")}
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
                            {t("surveys", "noOptionsConfigured")}
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
                            {t("surveys", "fileUploadField")}
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
