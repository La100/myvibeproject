"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, FileText } from "lucide-react";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SurveyResponsesPageProps {
  params: Promise<{
    projectSlug: string;
    surveyId: string;
  }>;
}

export default function SurveyResponsesPage({ params }: SurveyResponsesPageProps) {
  const router = useRouter();
  const [routeParams, setRouteParams] = useState<{
    surveyId: Id<"surveys">;
    projectSlug: string;
  } | null>(null);
  const [expandedResponseId, setExpandedResponseId] = useState<string>("");

  useEffect(() => {
    params.then(p => {
      setRouteParams({
        surveyId: p.surveyId as Id<"surveys">,
        projectSlug: p.projectSlug,
      });
    });
  }, [params]);

  const survey = useQuery(apiAny.surveys.getSurvey,
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const responses = useQuery(apiAny.surveys.getSurveyResponses,
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );

  // Get user info for each response
  const userIds = responses?.map(r => r.respondentId).filter(Boolean) || [];
  const users = useQuery(apiAny.users.getByClerkIds,
    userIds.length > 0 ? { clerkUserIds: userIds } : "skip"
  );

  if (!survey || !routeParams) {
    return <div>Loading...</div>;
  }

  const getAnswerDisplay = (answer: {
    answerType: string;
    textAnswer?: string;
    booleanAnswer?: boolean;
  }) => {
    switch (answer.answerType) {
      case "text":
        return answer.textAnswer || "-";
      case "boolean":
        return answer.booleanAnswer ? "Yes" : "No";
      default:
        return "-";
    }
  };


  const getUserName = (respondentId: string) => {
    const user = users?.find(u => u.clerkUserId === respondentId);
    return user?.name || user?.email || "Unknown user";
  };

  const sortedResponses = [...(responses || [])].sort(
    (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)
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
              onClick={() => router.push(`/organisation/projects/${routeParams.projectSlug}/surveys`)}
              className="shrink-0 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
            >
              <ArrowLeft className="mr-2 h-5 w-5 stroke-[2.4]" />
              Back to surveys
            </Button>
          }
        />

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-foreground" />
                Responses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {responses?.length ?? 0}
              </div>
              <p className="text-sm text-muted-foreground">Total responses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-foreground" />
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {survey.questions ? survey.questions.length : 0}
              </div>
              <p className="text-sm text-muted-foreground">Number of questions</p>
            </CardContent>
          </Card>
        </div>

        {((responses?.length ?? 0) === 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>No responses</CardTitle>
              <CardDescription>No one has responded to this survey yet.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Responses list</CardTitle>
                <CardDescription>
                  Select a response to expand details.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {sortedResponses.map((response, responseIndex) => {
                  const responseId = String(response._id);
                  return (
                    <button
                      key={responseId}
                      type="button"
                      onClick={() =>
                        setExpandedResponseId((current) =>
                          current === responseId ? "" : responseId
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {response.respondentName || getUserName(response.respondentId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(response.submittedAt || 0).toLocaleString()}
                        </p>
                      </div>
                      <span className="ml-4 inline-block rounded border border-border px-2 py-1 text-xs font-semibold">
                        #{responseIndex + 1}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Accordion
              type="single"
              collapsible
              value={expandedResponseId}
              onValueChange={setExpandedResponseId}
              className="rounded-xl border border-border bg-muted/30 px-4"
            >
              {sortedResponses.map((response, responseIndex) => {
                const responseId = String(response._id);
                return (
                  <AccordionItem key={responseId} value={responseId} className="border-b border-border last:border-b-0">
                    <AccordionTrigger className="py-5 hover:no-underline">
                      <div className="flex w-full items-start justify-between pr-3 text-left">
                        <div>
                          <p className="text-xl font-bold">
                            {response.respondentName || getUserName(response.respondentId)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Submitted: {new Date(response.submittedAt || 0).toLocaleString()}
                          </p>
                        </div>
                        <span className="inline-block rounded border border-border bg-transparent px-2 py-1 text-xs font-semibold">
                          Response #{responseIndex + 1}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-6 pb-6">
                        {survey.questions.map((question, questionIndex) => {
                          const answer = response.answers.find(a => a.questionId === question._id);
                          return (
                            <Card key={question._id} className="border border-border/80 bg-card shadow-sm">
                              <CardContent className="p-6">
                                <div className="mb-2 flex items-center gap-3">
                                  <span className="inline-block border border-border text-foreground bg-transparent rounded px-2 py-1 text-xs font-semibold">
                                    Question {questionIndex + 1}
                                  </span>
                                </div>
                                <div className="mb-2 font-medium">{question.questionText}</div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  {answer ? getAnswerDisplay(answer) : (
                                    <span className="italic text-muted-foreground">No answer</span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </ProjectPageLayout>
  );
}
