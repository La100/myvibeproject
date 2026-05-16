"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  FileText,
  HelpCircle,
  GripVertical,
} from "lucide-react";
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
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  isRequired: boolean;
  options: string[];
  ratingMin: number;
  ratingMax: number;
  ratingMinLabel: string;
  ratingMaxLabel: string;
}

interface SurveyFormProps {
  projectSlug: string;
}

export function SurveyForm({ projectSlug }: SurveyFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { project } = useProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSurvey = useMutation(apiAny.surveys.createSurvey);
  const addQuestion = useMutation(apiAny.surveys.addQuestion);

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

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validQuestions = questions.filter((question) =>
      question.questionText.trim(),
    );
    if (validQuestions.length === 0) {
      toast.error(t("surveys", "addAtLeastOneBeforeCreating"));
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

    setIsSubmitting(true);

    try {
      const surveyId = await createSurvey({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: project._id as Id<"projects">,
        isRequired: false,
        allowMultipleResponses: false,
      });

      // Add questions
      for (const question of validQuestions) {
        const usesOptions = usesChoiceOptions(question.questionType);
        const usesRating = usesRatingScale(question.questionType);

        await addQuestion({
          surveyId,
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          isRequired: question.isRequired,
          options: usesOptions
            ? normalizeChoiceOptions(question.options)
            : undefined,
          ratingScale: usesRating
            ? {
                min: Math.min(question.ratingMin, question.ratingMax),
                max: Math.max(question.ratingMin, question.ratingMax),
                minLabel: question.ratingMinLabel.trim() || undefined,
                maxLabel: question.ratingMaxLabel.trim() || undefined,
              }
            : undefined,
        });
      }

      toast.success(t("surveys", "surveyCreated"));
      router.push(`/organisation/projects/${projectSlug}/surveys`);
    } catch (error) {
      toast.error(t("surveys", "unableCreateSurvey"), {
        description: toUserFacingErrorMessage(error),
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "text_long":
        return <FileText className="h-4 w-4" />;
      case "yes_no":
        return <HelpCircle className="h-4 w-4" />;
      case "single_choice":
      case "multiple_choice":
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "text_long":
        return t("surveys", "text");
      case "yes_no":
        return t("surveys", "yesNo");
      case "single_choice":
        return t("surveys", "singleChoice");
      case "multiple_choice":
        return t("surveys", "multipleChoice");
      case "text_short":
        return t("surveys", "shortText");
      case "rating":
        return t("surveys", "ratingScale");
      case "number":
        return t("surveys", "number");
      case "file":
        return t("surveys", "fileUpload");
      default:
        return t("surveys", "text");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ProjectPageHeader
        title={t("surveys", "newSurvey")}
        icon={<FileText className="h-8 w-8 text-primary" />}
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
                <FileText className="h-5 w-5 text-foreground" />
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl">{t("surveys", "basicInformation")}</CardTitle>
                  <CardDescription>
                    {t("surveys", "provideBasicInformation")}
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
                  <HelpCircle className="h-5 w-5 text-foreground" />
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">{t("surveys", "questions")}</CardTitle>
                    <CardDescription>
                      {t("surveys", "questions")}
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
                  icon={HelpCircle}
                  title={t("surveys", "noQuestions")}
                  description={t("surveys", "noQuestionsSurveyDescription")}
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
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <Badge variant="outline">
                                  {t("surveys", "question").replace("{number}", String(index + 1))}
                                </Badge>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {getQuestionTypeIcon(question.questionType)}
                                  <span>
                                    {getQuestionTypeLabel(
                                      question.questionType,
                                    )}
                                  </span>
                                </div>
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

                            {/* Question Content */}
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                              <div className="flex flex-col gap-3">
                                <Label className="text-sm font-semibold">
                                  {t("surveys", "questionContent")}
                                </Label>
                                <Textarea
                                  value={question.questionText}
                                  onChange={(e) =>
                                    updateQuestion(question.id, {
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
                                    updateQuestion(question.id, {
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
                                  updateQuestion(question.id, { options })
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
                                  updateQuestion(question.id, {
                                    ratingMin: ratingScale.min,
                                    ratingMax: ratingScale.max,
                                    ratingMinLabel: ratingScale.minLabel,
                                    ratingMaxLabel: ratingScale.maxLabel,
                                  })
                                }
                              />
                            ) : null}

                            {/* Required toggle */}
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={question.isRequired}
                                  onCheckedChange={(checked) =>
                                    updateQuestion(question.id, {
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

          {/* Submit Actions */}
          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="min-w-[120px]"
            >
              {t("surveys", "cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="min-w-[160px]"
            >
              <Save data-icon="inline-start" />
              {isSubmitting ? t("surveys", "creating") : t("surveys", "createSurvey")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
