"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  GripVertical,
  HelpCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceOptionsEditor,
  RatingScaleEditor,
  SurveyQuestionType,
  createDefaultQuestionBuilderFields,
  normalizeChoiceOptions,
  surveyQuestionTypes,
  usesChoiceOptions,
  usesRatingScale,
} from "@/components/surveys/QuestionBuilderFields";

type TemplateQuestion = {
  _id?: Id<"surveyTemplateQuestions">;
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  options: string[];
  isRequired: boolean;
  order?: number;
  ratingMin: number;
  ratingMax: number;
  ratingMinLabel: string;
  ratingMaxLabel: string;
};

type SurveyTemplateFormProps = {
  templateId?: Id<"surveyTemplates">;
};

function newQuestion(): TemplateQuestion {
  return {
    id: crypto.randomUUID(),
    questionText: "",
    questionType: "text_long",
    isRequired: true,
    ...createDefaultQuestionBuilderFields(),
  };
}

function toQuestionPayload(question: TemplateQuestion, index: number) {
  const usesOptions = usesChoiceOptions(question.questionType);
  const usesRating = usesRatingScale(question.questionType);

  return {
    questionText: question.questionText.trim(),
    questionType: question.questionType,
    isRequired: question.isRequired,
    order: index + 1,
    options: usesOptions ? normalizeChoiceOptions(question.options) : undefined,
    ratingScale: usesRating
      ? {
          min: question.ratingMin,
          max: question.ratingMax,
          minLabel: question.ratingMinLabel.trim() || undefined,
          maxLabel: question.ratingMaxLabel.trim() || undefined,
        }
      : undefined,
  };
}

export function SurveyTemplateForm({ templateId }: SurveyTemplateFormProps) {
  const router = useRouter();
  const { organization } = useOrganization();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<TemplateQuestion[]>([
    newQuestion(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip",
  );
  const template = useQuery(
    apiAny.surveyTemplates.getTemplate,
    templateId ? { templateId } : "skip",
  );

  const createTemplate = useMutation(apiAny.surveyTemplates.createTemplate);
  const updateTemplate = useMutation(apiAny.surveyTemplates.updateTemplate);
  const addQuestion = useMutation(apiAny.surveyTemplates.addQuestion);
  const updateQuestion = useMutation(apiAny.surveyTemplates.updateQuestion);
  const deleteQuestion = useMutation(apiAny.surveyTemplates.deleteQuestion);

  const existingQuestionIds = useMemo<Set<string>>(
    () =>
      new Set(
        (template?.questions ?? []).map(
          (question: { _id: Id<"surveyTemplateQuestions"> }) =>
            String(question._id),
        ),
      ),
    [template?.questions],
  );

  useEffect(() => {
    if (!templateId || !template) {
      return;
    }

    setTitle(template.title);
    setDescription(template.description || "");
    setQuestions(
      template.questions.length > 0
        ? template.questions.map(
            (question: {
              _id: Id<"surveyTemplateQuestions">;
              questionText: string;
              questionType: SurveyQuestionType;
              options?: string[];
              isRequired: boolean;
              order: number;
              ratingScale?: {
                min: number;
                max: number;
                minLabel?: string;
                maxLabel?: string;
              };
            }) => ({
              _id: question._id,
              id: String(question._id),
              questionText: question.questionText,
              questionType: question.questionType,
              options:
                question.options && question.options.length >= 2
                  ? question.options
                  : createDefaultQuestionBuilderFields().options,
              isRequired: question.isRequired,
              order: question.order,
              ratingMin: question.ratingScale?.min ?? 1,
              ratingMax: question.ratingScale?.max ?? 5,
              ratingMinLabel: question.ratingScale?.minLabel ?? "",
              ratingMaxLabel: question.ratingScale?.maxLabel ?? "",
            }),
          )
        : [newQuestion()],
    );
  }, [template, templateId]);

  const updateLocalQuestion = (
    id: string,
    updates: Partial<TemplateQuestion>,
  ) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...updates } : question,
      ),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!team || !title.trim()) {
      return;
    }

    const validQuestions = questions.filter((question) =>
      question.questionText.trim(),
    );
    const invalidChoiceQuestion = validQuestions.find((question) => {
      const needsOptions = usesChoiceOptions(question.questionType);
      return (
        needsOptions && normalizeChoiceOptions(question.options).length < 2
      );
    });

    if (invalidChoiceQuestion) {
      toast.error("Choice questions need at least two options");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!templateId) {
        await createTemplate({
          teamId: team._id,
          title: title.trim(),
          description: description.trim() || undefined,
          questions: validQuestions.map(toQuestionPayload),
        });
      } else {
        await updateTemplate({
          templateId,
          title: title.trim(),
          description: description.trim() || undefined,
        });

        const retainedExistingIds = new Set(
          validQuestions
            .map((question) => question._id)
            .filter(Boolean)
            .map(String),
        );

        for (const existingId of existingQuestionIds) {
          if (!retainedExistingIds.has(existingId)) {
            await deleteQuestion({
              questionId: existingId as Id<"surveyTemplateQuestions">,
            });
          }
        }

        for (let index = 0; index < validQuestions.length; index += 1) {
          const question = validQuestions[index];
          const payload = toQuestionPayload(question, index);
          if (question._id) {
            await updateQuestion({
              questionId: question._id,
              ...payload,
            });
          } else {
            await addQuestion({
              templateId,
              ...payload,
            });
          }
        }
      }

      toast.success(
        templateId ? "Survey template updated" : "Survey template created",
      );
      router.push("/organisation/survey-library");
    } catch (error) {
      toast.error("Could not save survey template", {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-5xl flex-col gap-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-serif text-[2rem] leading-none tracking-[-0.04em] text-foreground">
            {templateId ? "Edit Survey Template" : "New Survey Template"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build a reusable question set your team can copy into any project.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <ClipboardList data-icon="inline-start" />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">Template Details</CardTitle>
              <CardDescription>
                Name and reusable context for this question set.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="title" className="text-sm font-semibold">
              Template Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Client onboarding survey"
              required
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="description" className="text-sm font-semibold">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="When this template should be used"
              rows={4}
              className="resize-none text-base"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HelpCircle data-icon="inline-start" />
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl">Questions</CardTitle>
                <CardDescription>
                  Questions copied into a project survey.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              onClick={() =>
                setQuestions((current) => [...current, newQuestion()])
              }
            >
              <Plus data-icon="inline-start" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <EmptyState
              className="border border-border bg-card"
              icon={HelpCircle}
              title="No questions"
              description="Add at least one question before using this template."
              action={{
                label: "Add Question",
                onClick: () => setQuestions([newQuestion()]),
                icon: Plus,
              }}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {questions.map((question, index) => {
                const usesOptions = usesChoiceOptions(question.questionType);
                const usesRating = usesRatingScale(question.questionType);

                return (
                  <Card key={question.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <GripVertical className="text-muted-foreground" />
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
                            Remove
                          </Button>
                        </div>
                        <Separator />
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="flex flex-col gap-3">
                            <Label className="text-sm font-semibold">
                              Question Content *
                            </Label>
                            <Textarea
                              value={question.questionText}
                              onChange={(event) =>
                                updateLocalQuestion(question.id, {
                                  questionText: event.target.value,
                                })
                              }
                              placeholder="What should the client answer?"
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
                              onValueChange={(value: SurveyQuestionType) =>
                                updateLocalQuestion(question.id, {
                                  questionType: value,
                                })
                              }
                            >
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select question type" />
                              </SelectTrigger>
                              <SelectContent>
                                {surveyQuestionTypes.map((type) => (
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
                          <ChoiceOptionsEditor
                            options={question.options}
                            onChange={(options) =>
                              updateLocalQuestion(question.id, { options })
                            }
                          />
                        ) : null}

                        {usesRating ? (
                          <RatingScaleEditor
                            value={{
                              min: question.ratingMin,
                              max: question.ratingMax,
                              minLabel: question.ratingMinLabel,
                              maxLabel: question.ratingMaxLabel,
                            }}
                            onChange={(ratingScale) =>
                              updateLocalQuestion(question.id, {
                                ratingMin: ratingScale.min,
                                ratingMax: ratingScale.max,
                                ratingMinLabel: ratingScale.minLabel,
                                ratingMaxLabel: ratingScale.maxLabel,
                              })
                            }
                          />
                        ) : null}

                        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                          <div className="flex flex-col gap-1">
                            <Label className="text-sm font-medium">
                              Required Question
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Respondents have to answer this question.
                            </p>
                          </div>
                          <Switch
                            checked={question.isRequired}
                            onCheckedChange={(checked) =>
                              updateLocalQuestion(question.id, {
                                isRequired: checked,
                              })
                            }
                          />
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

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim()}>
          <Save data-icon="inline-start" />
          {isSubmitting ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </form>
  );
}
