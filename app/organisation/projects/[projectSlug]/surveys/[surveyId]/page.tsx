"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

interface SurveyResponsePageProps {
  params: Promise<{
    projectSlug: string;
    surveyId: string;
  }>;
}

export default function SurveyResponsePage({ params }: SurveyResponsePageProps) {
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

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<Id<"surveyResponses"> | null>(null);

  const survey = useQuery(apiAny.surveys.getSurvey,
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const userResponse = useQuery(apiAny.surveys.getUserSurveyResponse,
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const project = useQuery(apiAny.projects.getProject,
    survey?.projectId ? { projectId: survey.projectId } : "skip"
  );
  const team = useQuery(apiAny.teams.getTeam,
    project?.teamId ? { teamId: project.teamId } : "skip"
  );

  const startResponse = useMutation(apiAny.surveys.startSurveyResponse);
  const saveAnswer = useMutation(apiAny.surveys.saveAnswer);
  const submitResponse = useMutation(apiAny.surveys.submitSurveyResponse);
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  useEffect(() => {
    if (userResponse && !userResponse.isComplete) {
      setCurrentResponseId(userResponse._id);
      // Load existing answers
      const existingAnswers: Record<string, unknown> = {};
      userResponse.answers.forEach((answer) => {
        const questionId = answer.questionId;
        switch (answer.answerType) {
          case "text":
            existingAnswers[questionId] = answer.textAnswer;
            break;
          case "choice":
            existingAnswers[questionId] = answer.choiceAnswers;
            break;
          case "rating":
            existingAnswers[questionId] = answer.ratingAnswer;
            break;
          case "number":
            existingAnswers[questionId] = answer.numberAnswer;
            break;
          case "boolean":
            existingAnswers[questionId] = answer.booleanAnswer;
            break;
          case "file":
            existingAnswers[questionId] = answer.fileAnswer;
            break;
        }
      });
      setAnswers(existingAnswers);
    }
  }, [userResponse]);

  const handleStartResponse = async () => {
    if (!routeParams) return;
    try {
      const response = await startResponse({ surveyId: routeParams.surveyId });
      if (response) {
        setCurrentResponseId(response._id);
        toast.success("Survey started");
      }
    } catch (error) {
      toast.error("Could not start survey");
      console.error(error);
    }
  };

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    if (!project || !team) return;

    try {
      // Generate upload URL
      const uploadData = await generateUploadUrl({
        projectId: project._id,
        fileName: file.name,
        fileSize: file.size,
      });

      // Upload file to R2
      const response = await fetch(uploadData.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Add file to database
      const fileRecord = await addFile({
        projectId: project._id,
        fileKey: uploadData.key,
        fileName: file.name,
        fileType: getFileType(file.type),
        fileSize: file.size,
      });

      // Save file info as answer
      const fileAnswer = {
        fileId: fileRecord,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };

      handleAnswerChange(questionId, fileAnswer);
      toast.success("File uploaded");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error uploading file");
    }
  };

  const getFileType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
    return 'other';
  };

  const handleSubmit = async () => {
    if (!currentResponseId || !routeParams) return;

    const requiredQuestions = survey?.questions.filter(q => q.isRequired) || [];
    const missingAnswers = requiredQuestions.filter(q => {
      const answer = answers[q._id];
      // For yes/no questions, false is a valid answer
      if (q.questionType === "yes_no") {
        return answer !== true && answer !== false;
      }
      // For file questions, check if file exists
      if (q.questionType === "file") {
        return !answer || !(answer as { fileId: unknown }).fileId;
      }
      return answer === undefined || answer === null || answer === "";
    });

    if (missingAnswers.length > 0) {
      toast.error("Please answer all required questions");
      return;
    }

    setIsSubmitting(true);

    try {
      // Save all answers first
      for (const [questionId, value] of Object.entries(answers)) {
        const question = survey?.questions.find(q => q._id === questionId);
        if (question) {
          // For boolean questions, false is a valid answer
          // For file questions, check if file exists
          const isValidAnswer = question.questionType === "yes_no"
            ? (value === true || value === false)
            : question.questionType === "file"
              ? (value && (value as { fileId: unknown }).fileId)
              : (value !== undefined && value !== null && value !== "");

          if (isValidAnswer) {
            const baseAnswerData = {
              responseId: currentResponseId,
              questionId: questionId as Id<"surveyQuestions">,
              answerType: getAnswerType(question.questionType) as "text" | "choice" | "rating" | "number" | "boolean",
            };

            switch (getAnswerType(question.questionType)) {
              case "text":
                await saveAnswer({
                  ...baseAnswerData,
                  textAnswer: value as string,
                });
                break;
              case "choice":
                await saveAnswer({
                  ...baseAnswerData,
                  choiceAnswers: Array.isArray(value) ? value as string[] : [value as string],
                });
                break;
              case "rating":
                await saveAnswer({
                  ...baseAnswerData,
                  ratingAnswer: value as number,
                });
                break;
              case "number":
                await saveAnswer({
                  ...baseAnswerData,
                  numberAnswer: value as number,
                });
                break;
              case "boolean":
                await saveAnswer({
                  ...baseAnswerData,
                  booleanAnswer: value as boolean,
                });
                break;
              case "file":
                await saveAnswer({
                  ...baseAnswerData,
                  fileAnswer: value as { fileId: Id<"files">; fileName: string; fileSize: number; fileType: string },
                });
                break;
            }
          }
        }
      }

      // Then submit the response
      await submitResponse({ responseId: currentResponseId });
      toast.success("Survey submitted!");
      router.push(`/organisation/projects/${routeParams.projectSlug}/surveys`);
    } catch (error) {
      toast.error("Error submitting survey");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAnswerType = (questionType: string) => {
    switch (questionType) {
      case "text_short":
      case "text_long":
        return "text";
      case "multiple_choice":
      case "single_choice":
        return "choice";
      case "rating":
        return "rating";
      case "yes_no":
        return "boolean";
      case "number":
        return "number";
      case "file":
        return "file";
      default:
        return "text";
    }
  };

  if (!survey || !routeParams) {
    return <div>Loading...</div>;
  }

  const isResponseComplete = userResponse?.isComplete;
  const hasStarted = currentResponseId !== null;

  if (isResponseComplete) {
    return (
      <ProjectPageLayout>
        <div className="flex flex-col gap-6">
          <ProjectPageHeader
            title={survey.title}
            icon={<Send className="h-8 w-8 text-primary" />}
            subtitle="Survey completed"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-2 h-5 w-5 stroke-[2.4]" />
                Back
              </Button>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Survey completed</CardTitle>
              <CardDescription>
                Thank you for completing "{survey.title}". Your response has been saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Submitted: {new Date(userResponse?.submittedAt || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      </ProjectPageLayout>
    );
  }

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-6">
        <ProjectPageHeader
          title={survey.title}
          icon={<Send className="h-8 w-8 text-primary" />}
          subtitle={survey.description}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-5 w-5 stroke-[2.4]" />
              Back
              </Button>
            }
          />

        {!hasStarted ? (
          <Card>
            <CardHeader>
              <CardTitle>Fill out the survey</CardTitle>
              <CardDescription>
                Click below to start answering the survey.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartResponse}>
                Start survey
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {survey.questions.map((question, index) => (
              <Card key={question._id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Question {index + 1}</Badge>
                    {question.isRequired && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{question.questionText}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(question.questionType === "text_short" || question.questionType === "text_long") && (
                    <Input
                      value={String(answers[question._id] || "")}
                      onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                      placeholder="Your answer"
                    />
                  )}

                  {question.questionType === "single_choice" && (
                    <RadioGroup
                      value={String(answers[question._id] || "")}
                      onValueChange={(value) => handleAnswerChange(question._id, value)}
                    >
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <RadioGroupItem value={option} id={`${question._id}-${optionIndex}`} />
                          <Label htmlFor={`${question._id}-${optionIndex}`}>{option}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.questionType === "multiple_choice" && (
                    <div className="flex flex-col gap-2">
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <Checkbox
                            id={`${question._id}-${optionIndex}`}
                            checked={Array.isArray(answers[question._id]) && (answers[question._id] as string[]).includes(option)}
                            onCheckedChange={(checked) => {
                              const currentAnswers = Array.isArray(answers[question._id]) ? answers[question._id] as string[] : [];
                              const newAnswers = checked
                                ? [...currentAnswers, option]
                                : currentAnswers.filter((a: string) => a !== option);
                              handleAnswerChange(question._id, newAnswers);
                            }}
                          />
                          <Label htmlFor={`${question._id}-${optionIndex}`}>{option}</Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.questionType === "rating" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{question.ratingScale?.minLabel || question.ratingScale?.min}</span>
                        <span>{question.ratingScale?.maxLabel || question.ratingScale?.max}</span>
                      </div>
                      <RadioGroup
                        value={answers[question._id]?.toString() || ""}
                        onValueChange={(value) => handleAnswerChange(question._id, parseInt(value))}
                      >
                        <div className="flex items-center justify-between">
                          {Array.from(
                            { length: (question.ratingScale?.max || 5) - (question.ratingScale?.min || 1) + 1 },
                            (_, i) => (question.ratingScale?.min || 1) + i
                          ).map((value) => (
                            <div key={value} className="flex flex-col items-center">
                              <RadioGroupItem value={value.toString()} id={`${question._id}-${value}`} />
                              <Label htmlFor={`${question._id}-${value}`} className="text-sm">
                                {value}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {question.questionType === "yes_no" && (
                    <RadioGroup
                      value={answers[question._id]?.toString() || ""}
                      onValueChange={(value) => handleAnswerChange(question._id, value === "true")}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="true" id={`${question._id}-yes`} />
                        <Label htmlFor={`${question._id}-yes`}>Yes</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="false" id={`${question._id}-no`} />
                        <Label htmlFor={`${question._id}-no`}>No</Label>
                      </div>
                    </RadioGroup>
                  )}

                  {question.questionType === "file" && (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
                        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <div className="mb-2 text-lg font-medium text-foreground">
                          Upload a file
                        </div>
                        <p className="mb-4 text-sm text-muted-foreground">
                          Click to choose a file or drag and drop it here
                        </p>
                        <input
                          type="file"
                          id={`file-${question._id}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(question._id, file);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById(`file-${question._id}`)?.click()}
                        >
                          Choose file
                        </Button>
                      </div>
                      {(answers[question._id] as { fileName?: string })?.fileName && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <div className="flex items-center text-primary">
                            <Upload className="h-4 w-4 mr-2" />
                            <span className="text-sm font-medium">
                              Uploaded: {(answers[question._id] as { fileName: string })?.fileName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {question.questionType === "number" && (
                    <Input
                      type="number"
                      value={String(answers[question._id] || "")}
                      onChange={(e) => handleAnswerChange(question._id, parseFloat(e.target.value))}
                      placeholder="Enter a number"
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Submitting..." : "Submit survey"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ProjectPageLayout>
  );
}
