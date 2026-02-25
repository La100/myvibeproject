"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowLeft, Save, FileText, HelpCircle, GripVertical } from "lucide-react";
import { toast } from "sonner";

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
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="shrink-0 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">New Survey</h1>
            <p className="text-muted-foreground mt-1">
              Create a survey for project <span className="font-medium text-foreground">{project.name}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="shadow-sm border-0 bg-card">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-foreground" />
                <div>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Provide basic information about the survey
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
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

              <div className="space-y-3">
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
          <Card className="shadow-sm border-0 bg-card">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-foreground" />
                  <div>
                    <CardTitle className="text-xl">Questions</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Add questions to your survey
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  type="button" 
                  onClick={addNewQuestion}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-gray-200">
                    <HelpCircle className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    You don't have any questions yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Click "Add Question" to start creating your survey
                  </p>
                  <Button 
                    type="button" 
                    onClick={addNewQuestion}
                    variant="outline"
                    className="border-border text-foreground hover:bg-accent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <Card key={question.id} className="border border-gray-200 shadow-sm bg-gray-50/50">
                      <CardContent className="p-6">
                        <div className="space-y-5">
                          {/* Question Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-gray-400" />
                                <Badge variant="secondary" className="border border-border text-foreground bg-transparent">
                                  Question {index + 1}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                {getQuestionTypeIcon(question.questionType)}
                                <span>{getQuestionTypeLabel(question.questionType)}</span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(question.id)}
                              className="text-foreground hover:text-primary-foreground hover:bg-primary"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <Separator className="bg-gray-200" />

                          {/* Question Content */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-3">
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

                            <div className="space-y-3">
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
                          <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={question.isRequired}
                                onCheckedChange={(checked) => updateQuestion(question.id, { isRequired: checked })}
                              />
                              <div>
                                <Label className="text-sm font-medium">Required Question</Label>
                                <p className="text-xs text-gray-500 mt-1">
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
              className="min-w-[120px] bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
              className="min-w-[160px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Creating..." : "Create Survey"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
