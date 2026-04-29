"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

type QuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file";

interface Question {
  _id?: Id<"surveyQuestions">;
  id: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  options?: string[];
  optionsText: string;
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
  order?: number;
  ratingMin: number;
  ratingMax: number;
  ratingMinLabel: string;
  ratingMaxLabel: string;
}

interface Survey {
  _id: Id<"surveys">;
  title: string;
  description?: string;
  questions?: Question[];
}

interface EditSurveyFormProps {
  survey: Survey;
}

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: "text_short", label: "Short Text" },
  { value: "text_long", label: "Long Text" },
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "rating", label: "Rating Scale" },
  { value: "yes_no", label: "Yes/No" },
  { value: "number", label: "Number" },
  { value: "file", label: "File Upload" },
];

function normalizeOptions(optionsText: string) {
  return optionsText
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
}

function usesChoiceOptions(questionType: QuestionType) {
  return questionType === "single_choice" || questionType === "multiple_choice";
}

export function EditSurveyForm({ survey }: EditSurveyFormProps) {
  const router = useRouter();
  const { project } = useProject();
  const updateSurvey = useMutation(apiAny.surveys.updateSurvey);
  const addQuestion = useMutation(apiAny.surveys.addQuestion);
  const updateQuestion = useMutation(apiAny.surveys.updateQuestion);
  const deleteQuestion = useMutation(apiAny.surveys.deleteQuestion);
  const deleteSurvey = useMutation(apiAny.surveys.deleteSurvey);
  const saveSurveyAsTemplate = useMutation(
    apiAny.surveyTemplates.saveSurveyAsTemplate,
  );

  const surveyQuestions = useQuery(apiAny.surveys.getSurvey, {
    surveyId: survey._id,
  });

  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);

  useEffect(() => {
    if (surveyQuestions?.questions) {
      setQuestions(
        surveyQuestions.questions.map((q) => ({
          _id: q._id,
          id: String(q._id),
          questionText: q.questionText,
          questionType: q.questionType as Question["questionType"],
          isRequired: q.isRequired,
          options: q.options,
          optionsText: (q.options ?? []).join("\n"),
          ratingScale: q.ratingScale,
          order: q.order,
          ratingMin: q.ratingScale?.min ?? 1,
          ratingMax: q.ratingScale?.max ?? 5,
          ratingMinLabel: q.ratingScale?.minLabel ?? "",
          ratingMaxLabel: q.ratingScale?.maxLabel ?? "",
        })) as Question[],
      );
    }
  }, [surveyQuestions]);

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: "",
      questionType: "text_long",
      isRequired: true,
      optionsText: "",
      ratingMin: 1,
      ratingMax: 5,
      ratingMinLabel: "",
      ratingMaxLabel: "",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestionLocal = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validQuestions = questions.filter((question) =>
      question.questionText.trim(),
    );
    const invalidChoiceQuestion = validQuestions.find(
      (question) =>
        usesChoiceOptions(question.questionType) &&
        normalizeOptions(question.optionsText).length < 2,
    );

    if (invalidChoiceQuestion) {
      toast.error("Choice questions need at least two options");
      return;
    }

    setLoading(true);

    try {
      await updateSurvey({
        surveyId: survey._id,
        title: title,
        description: description || undefined,
      });

      const retainedQuestionIds = new Set(
        validQuestions
          .map((question) => question._id)
          .filter(Boolean)
          .map(String),
      );
      const originalQuestionIds = (surveyQuestions?.questions ?? []).map(
        (question) => String(question._id),
      );

      for (const originalQuestionId of originalQuestionIds) {
        if (!retainedQuestionIds.has(originalQuestionId)) {
          await deleteQuestion({
            questionId: originalQuestionId as Id<"surveyQuestions">,
          });
        }
      }

      // Handle questions
      for (let index = 0; index < validQuestions.length; index += 1) {
        const question = validQuestions[index];
        const usesOptions = usesChoiceOptions(question.questionType);
        const usesRating = question.questionType === "rating";
        const questionPayload = {
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          isRequired: question.isRequired,
          options: usesOptions
            ? normalizeOptions(question.optionsText)
            : undefined,
          order: index + 1,
          ratingScale: usesRating
            ? {
                min: question.ratingMin,
                max: question.ratingMax,
                minLabel: question.ratingMinLabel.trim() || undefined,
                maxLabel: question.ratingMaxLabel.trim() || undefined,
              }
            : undefined,
        };

        if (question._id) {
          // Update existing question
          await updateQuestion({
            questionId: question._id,
            ...questionPayload,
          });
        } else {
          // Add new question
          await addQuestion({
            surveyId: survey._id,
            ...questionPayload,
          });
        }
      }

      toast.success("Survey has been updated");
      router.push(`/organisation/projects/${project.slug}/surveys`);
    } catch (error) {
      toast.error("Error updating survey", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (
      confirm(
        `Are you sure you want to delete the survey "${title}"? This action cannot be undone.`,
      )
    ) {
      setLoading(true);
      try {
        await deleteSurvey({ surveyId: survey._id });
        toast.success("Survey has been deleted");
        router.push(`/organisation/projects/${project.slug}/surveys`);
      } catch (error) {
        toast.error("Error deleting survey", {
          description: toUserFacingErrorMessage(error),
        });
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveAsTemplate = async () => {
    setSavingAsTemplate(true);
    try {
      await saveSurveyAsTemplate({
        surveyId: survey._id,
        title: title.trim() || survey.title,
        description: description.trim() || undefined,
      });
      toast.success("Survey saved to library");
    } catch (error) {
      toast.error("Could not save survey to library", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setSavingAsTemplate(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ProjectPageHeader
        title="Edit Survey"
        icon={<Save className="h-8 w-8 text-primary" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                <Save className="h-5 w-5 text-foreground" />
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription>
                    Edit basic information about the survey
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Label htmlFor="title" className="text-sm font-semibold">
                  Survey Title *
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter survey title"
                  required
                  className="h-11 text-base"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Label htmlFor="description" className="text-sm font-semibold">
                  Description (optional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter survey description"
                  rows={4}
                  className="resize-none text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Questions Section */}
          <Card>
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-foreground" />
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">Questions</CardTitle>
                    <CardDescription>
                      Edit questions in the survey
                    </CardDescription>
                  </div>
                </div>
                <Button type="button" onClick={addNewQuestion}>
                  <Plus data-icon="inline-start" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <EmptyState
                  className="border border-border bg-card"
                  icon={Plus}
                  title="No Questions"
                  description='Click "Add Question" to add a new question.'
                  action={{
                    label: "Add First Question",
                    onClick: addNewQuestion,
                    icon: Plus,
                  }}
                />
              ) : (
                <div className="flex flex-col gap-6">
                  {questions.map((question, index) => {
                    const usesOptions = usesChoiceOptions(
                      question.questionType,
                    );
                    const usesRating = question.questionType === "rating";

                    return (
                      <Card key={question.id}>
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-5">
                            {/* Question Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">
                                  Question {index + 1}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeQuestion(question.id)}
                              >
                                <Trash2 data-icon="inline-start" />
                              </Button>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  Question Content *
                                </Label>
                                <Textarea
                                  value={question.questionText}
                                  onChange={(e) =>
                                    updateQuestionLocal(question.id, {
                                      questionText: e.target.value,
                                    })
                                  }
                                  placeholder="Enter question content"
                                  required
                                  rows={3}
                                  className="resize-none text-base"
                                />
                              </div>
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  Question Type
                                </Label>
                                <Select
                                  value={question.questionType}
                                  onValueChange={(value: QuestionType) =>
                                    updateQuestionLocal(question.id, {
                                      questionType: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select question type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {questionTypes.map((type) => (
                                      <SelectItem
                                        key={type.value}
                                        value={type.value}
                                      >
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {usesOptions ? (
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  Options
                                </Label>
                                <Textarea
                                  value={question.optionsText}
                                  onChange={(e) =>
                                    updateQuestionLocal(question.id, {
                                      optionsText: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    "One option per line\nOption A\nOption B"
                                  }
                                  rows={4}
                                  className="resize-none text-base"
                                />
                              </div>
                            ) : null}

                            {usesRating ? (
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-semibold">
                                    Min
                                  </Label>
                                  <Input
                                    type="number"
                                    value={question.ratingMin}
                                    onChange={(e) =>
                                      updateQuestionLocal(question.id, {
                                        ratingMin: Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-semibold">
                                    Max
                                  </Label>
                                  <Input
                                    type="number"
                                    value={question.ratingMax}
                                    onChange={(e) =>
                                      updateQuestionLocal(question.id, {
                                        ratingMax: Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-semibold">
                                    Min Label
                                  </Label>
                                  <Input
                                    value={question.ratingMinLabel}
                                    onChange={(e) =>
                                      updateQuestionLocal(question.id, {
                                        ratingMinLabel: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Label className="text-sm font-semibold">
                                    Max Label
                                  </Label>
                                  <Input
                                    value={question.ratingMaxLabel}
                                    onChange={(e) =>
                                      updateQuestionLocal(question.id, {
                                        ratingMaxLabel: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={question.isRequired}
                                  onCheckedChange={(checked) =>
                                    updateQuestionLocal(question.id, {
                                      isRequired: checked,
                                    })
                                  }
                                />
                                <div className="flex flex-col gap-1">
                                  <Label className="text-sm font-medium">
                                    Required Question
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Respondents will have to answer this
                                    question
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="min-w-[120px]"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[160px]">
              <Save data-icon="inline-start" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={loading || savingAsTemplate}
            >
              <Plus data-icon="inline-start" />
              {savingAsTemplate ? "Saving..." : "Save as Template"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSurvey}
              disabled={loading}
            >
              <Trash2 data-icon="inline-start" />
              Delete Survey
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
