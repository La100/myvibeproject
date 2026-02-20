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

  // Get current user role to customize view
  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember,
    routeParams && survey && survey.teamId ? { teamId: survey.teamId } : "skip"
  );

  const isClient = currentUserMember?.role === "customer";

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

  return (
    <ProjectPageLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/organisation/projects/${routeParams.projectSlug}/surveys`)}
            className="shrink-0 bg-black text-white border-black hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to surveys
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {isClient ? "My response" : "Survey responses"}
            </h1>
            <p className="text-muted-foreground mt-1">{survey.title}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-black" />
                {isClient ? "Status" : "Responses"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isClient ? (responses?.length ?? 0 > 0 ? "Submitted" : "None") : (responses?.length ?? 0)}
              </div>
              <p className="text-sm text-gray-600">
                {isClient ? "Your response" : "Total responses"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-black" />
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {survey.questions ? survey.questions.length : 0}
              </div>
              <p className="text-sm text-gray-600">Number of questions</p>
            </CardContent>
          </Card>
        </div>

        {((responses?.length ?? 0) === 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>{isClient ? "No response yet" : "No responses"}</CardTitle>
              <CardDescription>
                {isClient
                  ? "You have not filled out this survey yet."
                  : "No one has responded to this survey yet."
                }
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {responses?.map((response, responseIndex) => (
              <Card key={response._id} className="border border-gray-200 shadow-sm bg-gray-50/50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        {getUserName(response.respondentId)}
                      </CardTitle>
                      <CardDescription>
                        Submitted: {new Date(response.submittedAt || 0).toLocaleString()}
                      </CardDescription>
                    </div>
                    <span className="inline-block border border-black text-black bg-transparent rounded px-2 py-1 text-xs font-semibold">
                      Response #{responseIndex + 1}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {survey.questions.map((question, questionIndex) => {
                      const answer = response.answers.find(a => a.questionId === question._id);
                      return (
                        <Card key={question._id} className="border border-gray-200 shadow-sm bg-white">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="inline-block border border-black text-black bg-transparent rounded px-2 py-1 text-xs font-semibold">
                                Question {questionIndex + 1}
                              </span>
                            </div>
                            <div className="font-medium mb-2">{question.questionText}</div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              {answer ? getAnswerDisplay(answer) : (
                                <span className="text-gray-500 italic">No answer</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProjectPageLayout>
  );
}
