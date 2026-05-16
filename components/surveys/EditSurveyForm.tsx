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
import { useI18n } from "@/lib/i18n";

interface Question {
  _id?: Id<"surveyQuestions">;
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  isRequired: boolean;
  options: string[];
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

export function EditSurveyForm({ survey }: EditSurveyFormProps) {
  const { t } = useI18n();
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
          options:
            q.options && q.options.length >= 2
              ? q.options
              : createDefaultQuestionBuilderFields().options,
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
      ...createDefaultQuestionBuilderFields(),
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
    if (!title.trim()) {
      toast.error(t("surveys", "surveyTitleRequired"));
      return;
    }
    if (validQuestions.length === 0) {
      toast.error(t("surveys", "addAtLeastOneBeforeSaving"));
      return;
    }

    const invalidChoiceQuestion = validQuestions.find(
      (question) =>
        usesChoiceOptions(question.questionType) &&
        normalizeChoiceOptions(question.options).length < 2,
    );

    if (invalidChoiceQuestion) {
      toast.error(t("surveys", "choiceNeedsTwoOptions"));
      return;
    }

    setLoading(true);

    try {
      await updateSurvey({
        surveyId: survey._id,
        title: title.trim(),
        description: description.trim() || undefined,
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
        const usesRating = usesRatingScale(question.questionType);
        const questionPayload = {
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          isRequired: question.isRequired,
          options: usesOptions
            ? normalizeChoiceOptions(question.options)
            : undefined,
          order: index + 1,
          ratingScale: usesRating
            ? {
                min: Math.min(question.ratingMin, question.ratingMax),
                max: Math.max(question.ratingMin, question.ratingMax),
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

      toast.success(t("surveys", "saveChanges"));
      router.push(`/organisation/projects/${project.slug}/surveys`);
    } catch (error) {
      toast.error(t("surveys", "unableUpdateSurvey"), {
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
        t("surveys", "deleteSurveyConfirm").replace("{title}", title),
      )
    ) {
      setLoading(true);
      try {
        await deleteSurvey({ surveyId: survey._id });
        toast.success(t("surveys", "surveyDeleted"));
        router.push(`/organisation/projects/${project.slug}/surveys`);
      } catch (error) {
        toast.error(t("surveys", "unableDeleteSurvey"), {
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
      toast.success(t("surveys", "surveySavedToLibrary"));
    } catch (error) {
      toast.error(t("surveys", "couldNotSaveToLibrary"), {
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
        title={t("surveys", "editSurvey")}
        icon={<Save className="h-8 w-8 text-primary" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft data-icon="inline-start" />
            {t("surveys", "back")}
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
                  <CardTitle className="text-xl">{t("surveys", "basicInformation")}</CardTitle>
                  <CardDescription>
                    {t("surveys", "editBasicInformation")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Label htmlFor="title" className="text-sm font-semibold">
                  {t("surveys", "surveyTitle")}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("surveys", "enterSurveyTitle")}
                  required
                  className="h-11 text-base"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Label htmlFor="description" className="text-sm font-semibold">
                  {t("surveys", "descriptionOptional")}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("surveys", "enterSurveyDescription")}
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
                    <CardTitle className="text-xl">{t("surveys", "questions")}</CardTitle>
                    <CardDescription>
                      {t("surveys", "editQuestionsDescription")}
                    </CardDescription>
                  </div>
                </div>
                <Button type="button" onClick={addNewQuestion}>
                  <Plus data-icon="inline-start" />
                  {t("surveys", "addQuestion")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <EmptyState
                  className="border border-border bg-card"
                  icon={Plus}
                  title={t("surveys", "noQuestions")}
                  description={t("surveys", "noQuestionsDescription")}
                  action={{
                    label: t("surveys", "addFirstQuestion"),
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
                    const usesRating = usesRatingScale(question.questionType);

                    return (
                      <Card key={question.id}>
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-5">
                            {/* Question Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">
                                  {t("surveys", "question").replace("{number}", String(index + 1))}
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
                                  {t("surveys", "questionContent")}
                                </Label>
                                <Textarea
                                  value={question.questionText}
                                  onChange={(e) =>
                                    updateQuestionLocal(question.id, {
                                      questionText: e.target.value,
                                    })
                                  }
                                  placeholder={t("surveys", "enterQuestionContent")}
                                  required
                                  rows={3}
                                  className="resize-none text-base"
                                />
                              </div>
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  {t("surveys", "questionType")}
                                </Label>
                                <Select
                                  value={question.questionType}
                                  onValueChange={(value: SurveyQuestionType) =>
                                    updateQuestionLocal(question.id, {
                                      questionType: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder={t("surveys", "selectQuestionType")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {surveyQuestionTypes.map((type) => (
                                      <SelectItem
                                        key={type.value}
                                        value={type.value}
                                      >
                                        {t("surveys", type.labelKey)}
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
                                  updateQuestionLocal(question.id, { options })
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
                                  updateQuestionLocal(question.id, {
                                    ratingMin: ratingScale.min,
                                    ratingMax: ratingScale.max,
                                    ratingMinLabel: ratingScale.minLabel,
                                    ratingMaxLabel: ratingScale.maxLabel,
                                  })
                                }
                              />
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
                                    {t("surveys", "requiredQuestion")}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {t("surveys", "requiredQuestionDescriptionAlt")}
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
              {t("surveys", "cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[160px]">
              <Save data-icon="inline-start" />
              {loading ? t("surveys", "saving") : t("surveys", "saveChanges")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={loading || savingAsTemplate}
            >
              <Plus data-icon="inline-start" />
              {savingAsTemplate ? t("surveys", "saving") : t("surveys", "saveAsTemplate")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSurvey}
              disabled={loading}
            >
              <Trash2 data-icon="inline-start" />
              {t("surveys", "deleteSurvey")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
