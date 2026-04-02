"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowLeft, Save, FileText, HelpCircle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";

interface Question {
  id: string;
  questionText: string;
  questionType: "text_long" | "yes_no";
  isRequired: boolean;
}

interface SurveyFormProps {
  projectSlug: string;
}

export function SurveyForm({ projectSlug }: SurveyFormProps) {
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
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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
      for (const question of questions) {
        if (question.questionText.trim()) {
          await addQuestion({
            surveyId,
            questionText: question.questionText.trim(),
            questionType: question.questionType,
            isRequired: question.isRequired,
          });
        }
      }

      toast.success("Survey has been created!");
      router.push(`/organisation/projects/${projectSlug}/surveys`);
    } catch (error) {
      toast.error("Error creating survey");
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
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "text_long":
        return "Text";
      case "yes_no":
        return "Yes/No";
      default:
        return "Text";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ProjectPageHeader
        title="New Survey"
        icon={<FileText className="h-8 w-8 text-primary" />}
        subtitle={`Create a survey for ${project.name}`}
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
                <FileText className="h-5 w-5 text-foreground" />
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription>Provide basic information about the survey</CardDescription>
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
                  <HelpCircle className="h-5 w-5 text-foreground" />
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl">Questions</CardTitle>
                    <CardDescription>Add questions to your survey</CardDescription>
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
                  icon={HelpCircle}
                  title="You don't have any questions yet"
                  description='Click "Add Question" to start creating your survey.'
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
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline">Question {index + 1}</Badge>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {getQuestionTypeIcon(question.questionType)}
                                <span>{getQuestionTypeLabel(question.questionType)}</span>
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
                                Question Content *
                              </Label>
                              <Textarea
                                value={question.questionText}
                                onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
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
                                onValueChange={(value: "text_long" | "yes_no") => updateQuestion(question.id, { questionType: value })}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select question type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text_long">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-foreground" />
                                      Text
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="yes_no">
                                    <div className="flex items-center gap-2">
                                      <HelpCircle className="h-4 w-4 text-foreground" />
                                      Yes/No
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Required toggle */}
                          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={question.isRequired}
                                onCheckedChange={(checked) => updateQuestion(question.id, { isRequired: checked })}
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

          {/* Submit Actions */}
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
              disabled={isSubmitting || !title.trim()}
              className="min-w-[160px]"
            >
              <Save data-icon="inline-start" />
              {isSubmitting ? "Creating..." : "Create Survey"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
