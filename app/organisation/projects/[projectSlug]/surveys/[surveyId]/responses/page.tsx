"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ImageIcon,
  Users,
} from "lucide-react";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { cn } from "@/lib/utils";

interface SurveyResponsesPageProps {
  params: Promise<{
    projectSlug: string;
    surveyId: string;
  }>;
}

export default function SurveyResponsesPage({
  params,
}: SurveyResponsesPageProps) {
  const router = useRouter();
  const [routeParams, setRouteParams] = useState<{
    surveyId: Id<"surveys">;
    projectSlug: string;
  } | null>(null);
  const [expandedResponseId, setExpandedResponseId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setRouteParams({
        surveyId: p.surveyId as Id<"surveys">,
        projectSlug: p.projectSlug,
      });
    });
  }, [params]);

  const survey = useQuery(
    apiAny.surveys.getSurvey,
    routeParams ? { surveyId: routeParams.surveyId } : "skip",
  );
  const responses = useQuery(
    apiAny.surveys.getSurveyResponses,
    routeParams ? { surveyId: routeParams.surveyId } : "skip",
  );

  // Get user info for each response
  const userIds = responses?.map((r) => r.respondentId).filter(Boolean) || [];
  const users = useQuery(
    apiAny.users.getByClerkIds,
    userIds.length > 0 ? { clerkUserIds: userIds } : "skip",
  );

  if (!survey || !routeParams) {
    return <div>Loading...</div>;
  }

  const formatFileSize = (size?: number) => {
    if (typeof size !== "number") return null;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  };

  const renderAnswerDisplay = (answer: {
    answerType: string;
    textAnswer?: string;
    choiceAnswers?: string[];
    ratingAnswer?: number;
    numberAnswer?: number;
    booleanAnswer?: boolean;
    fileAnswer?: {
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      fileUrl?: string;
    };
  }) => {
    switch (answer.answerType) {
      case "text":
        return answer.textAnswer ? (
          <p className="whitespace-pre-wrap leading-6">{answer.textAnswer}</p>
        ) : (
          "-"
        );
      case "choice":
        return answer.choiceAnswers?.length ? (
          <div className="flex flex-wrap gap-2">
            {answer.choiceAnswers.map((choice) => (
              <Badge key={choice} variant="secondary" className="rounded-full">
                {choice}
              </Badge>
            ))}
          </div>
        ) : (
          "-"
        );
      case "rating":
        return typeof answer.ratingAnswer === "number" ? (
          <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
            {answer.ratingAnswer}
          </span>
        ) : (
          "-"
        );
      case "number":
        return typeof answer.numberAnswer === "number" ? (
          <span className="font-medium tabular-nums">{answer.numberAnswer}</span>
        ) : (
          "-"
        );
      case "boolean":
        return (
          <Badge variant={answer.booleanAnswer ? "secondary" : "outline"}>
            {answer.booleanAnswer ? "Yes" : "No"}
          </Badge>
        );
      case "file": {
        const file = answer.fileAnswer;
        if (!file?.fileName) return "-";

        const isImage = file.fileType?.startsWith("image/");
        const fileSize = formatFileSize(file.fileSize);
        if (isImage && file.fileUrl) {
          return (
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[16/9] max-h-72 bg-secondary">
                <img
                  src={file.fileUrl}
                  alt={file.fileName}
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.01]"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {file.fileName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fileSize || "Open"}
                </span>
              </div>
            </a>
          );
        }

        if (file.fileUrl) {
          return (
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{file.fileName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {fileSize || "Open"}
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>
          );
        }

        return (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{file.fileName}</span>
            </span>
            {fileSize ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {fileSize}
              </span>
            ) : null}
          </div>
        );
      }
      default:
        return "-";
    }
  };

  const getUserName = (respondentId: string) => {
    const user = users?.find((u) => u.clerkUserId === respondentId);
    return user?.name || user?.email || "Unknown user";
  };

  const sortedResponses = [...(responses || [])].sort(
    (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0),
  );
  const selectedResponseId =
    expandedResponseId || (sortedResponses[0]?._id ? String(sortedResponses[0]._id) : "");
  const selectedResponse = sortedResponses.find(
    (response) => String(response._id) === selectedResponseId,
  );

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-6">
        <ProjectPageHeader
          title="Survey Responses"
          icon={<Users className="h-8 w-8 text-primary" />}
          subtitle={survey.title}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/organisation/projects/${routeParams.projectSlug}/surveys`,
                )
              }
              className="shrink-0 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-5 w-5 stroke-[2.4]" />
              Back to surveys
            </Button>
          }
        />

        <div className="mb-2 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-foreground" />
                Responses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{responses?.length ?? 0}</div>
              <p className="text-sm text-muted-foreground">Total responses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-foreground" />
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {survey.questions ? survey.questions.length : 0}
              </div>
              <p className="text-sm text-muted-foreground">
                Number of questions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-foreground" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(responses || []).reduce(
                  (count, response) =>
                    count +
                    response.answers.filter(
                      (answer) => answer.answerType === "file",
                    ).length,
                  0,
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Uploaded with responses
              </p>
            </CardContent>
          </Card>
        </div>

        {(responses?.length ?? 0) === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No responses</CardTitle>
              <CardDescription>
                No one has responded to this survey yet.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Responses list</CardTitle>
                <CardDescription>
                  Select a response to review answers.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {sortedResponses.map((response, responseIndex) => {
                  const responseId = String(response._id);
                  const isSelected = responseId === selectedResponseId;
                  return (
                    <button
                      key={responseId}
                      type="button"
                      onClick={() => setExpandedResponseId(responseId)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-primary/25 bg-secondary"
                          : "border-border bg-card hover:bg-secondary/60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {response.respondentName ||
                            getUserName(response.respondentId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted:{" "}
                          {new Date(response.submittedAt || 0).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {response.answers.length} answer
                          {response.answers.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="ml-4 inline-block rounded-full border border-border bg-card px-2 py-1 text-xs font-semibold">
                        #{responseIndex + 1}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      {selectedResponse
                        ? selectedResponse.respondentName ||
                          getUserName(selectedResponse.respondentId)
                        : "Response"}
                    </CardTitle>
                    <CardDescription>
                      {selectedResponse?.submittedAt
                        ? `Submitted ${new Date(selectedResponse.submittedAt).toLocaleString()}`
                        : "No response selected"}
                    </CardDescription>
                  </div>
                  {selectedResponse ? (
                    <Badge variant="outline">
                      {selectedResponse.answers.length} answer
                      {selectedResponse.answers.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {selectedResponse ? (
                  <div className="divide-y divide-border/70">
                    {survey.questions.map((question, questionIndex) => {
                      const answer = selectedResponse.answers.find(
                        (entry) => entry.questionId === question._id,
                      );
                      return (
                        <section
                          key={question._id}
                          className="grid gap-4 p-5 md:grid-cols-[220px_1fr]"
                        >
                          <div>
                            <Badge variant="outline" className="rounded-full">
                              Question {questionIndex + 1}
                            </Badge>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {question.questionType.replace(/_/g, " ")}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-medium leading-6 text-foreground">
                              {question.questionText}
                            </h3>
                            <div className="mt-3 rounded-xl border border-border bg-secondary/60 p-3 text-sm">
                              {answer ? (
                                renderAnswerDisplay(answer)
                              ) : (
                                <span className="italic text-muted-foreground">
                                  No answer
                                </span>
                              )}
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    Select a response to view answers.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ProjectPageLayout>
  );
}
