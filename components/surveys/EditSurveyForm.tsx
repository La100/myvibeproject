"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

interface Question {
  _id?: Id<"surveyQuestions">;
  id: string;
  questionText: string;
  questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file";
  isRequired: boolean;
  options?: string[];
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
  order?: number;
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
  const router = useRouter();
  const { project } = useProject();
  const updateSurvey = useMutation(apiAny.surveys.updateSurvey);
  const addQuestion = useMutation(apiAny.surveys.addQuestion);
  const updateQuestion = useMutation(apiAny.surveys.updateQuestion);
  
  const deleteSurvey = useMutation(apiAny.surveys.deleteSurvey);

  const surveyQuestions = useQuery(apiAny.surveys.getSurvey, { surveyId: survey._id });

  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

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
          ratingScale: q.ratingScale,
          order: q.order,
        })) as Question[]
      );
    }
  }, [surveyQuestions]);

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: "",
      questionType: "text_long",
      isRequired: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestionLocal = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateSurvey({
        surveyId: survey._id,
        title: title,
        description: description || undefined,
      });

      // Handle questions
      for (const question of questions) {
        if (question.questionText.trim()) {
          if (question._id) {
            // Update existing question
            await updateQuestion({
              questionId: question._id,
              questionText: question.questionText.trim(),
              questionType: question.questionType,
              isRequired: question.isRequired,
            });
          } else {
            // Add new question
            await addQuestion({
              surveyId: survey._id,
              questionText: question.questionText.trim(),
              questionType: question.questionType,
              isRequired: question.isRequired,
            });
          }
        }
      }

      toast.success("Survey has been updated");
      router.push(`/organisation/projects/${project.slug}/surveys`);
    } catch (error) {
      toast.error("Error updating survey");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (confirm(`Are you sure you want to delete the survey "${title}"? This action cannot be undone.`)) {
      setLoading(true);
      try {
        await deleteSurvey({ surveyId: survey._id });
        toast.success("Survey has been deleted");
        router.push(`/organisation/projects/${project.slug}/surveys`);
      } catch (error) {
        toast.error("Error deleting survey");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ProjectPageHeader
        title="Edit Survey"
        icon={<Save className="h-8 w-8 text-primary" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
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
                  <CardDescription>Edit basic information about the survey</CardDescription>
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
                    <CardDescription>Edit questions in the survey</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={addNewQuestion}
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
                  {questions.map((question, index) => (
                    <Card key={question.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-5">
                          {/* Question Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">Question {index + 1}</Badge>
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
                                onChange={(e) => updateQuestionLocal(question.id, { questionText: e.target.value })}
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
                                onValueChange={(value: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file") => updateQuestionLocal(question.id, { questionType: value })}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select question type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text_short">Short Text</SelectItem>
                                  <SelectItem value="text_long">Long Text</SelectItem>
                                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                  <SelectItem value="single_choice">Single Choice</SelectItem>
                                  <SelectItem value="rating">Rating Scale</SelectItem>
                                  <SelectItem value="yes_no">Yes/No</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="file">File Upload</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={question.isRequired}
                                onCheckedChange={(checked) => updateQuestionLocal(question.id, { isRequired: checked })}
                              />
                              <div className="flex flex-col gap-1">
                                <Label className="text-sm font-medium">Required Question</Label>
                                <p className="text-xs text-muted-foreground">
                                  Respondents will have to answer this question
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[160px]"
            >
              <Save data-icon="inline-start" />
              {loading ? "Saving..." : "Save Changes"}
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
