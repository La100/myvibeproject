"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  FileText,
  RotateCcw,
} from "lucide-react";
import { defaultPrompt } from "@/convex/ai/prompt";

interface AISettingsProps {
  projectId: Id<"projects">;
}

export default function AISettings({ projectId }: AISettingsProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiAutoConfirmCrud, setAiAutoConfirmCrud] = useState(false);
  const [isSavingAiConfirmMode, setIsSavingAiConfirmMode] = useState(false);

  // Get project data
  const project = useQuery(apiAny.projects.getProject, projectId ? { projectId } : "skip");

  // Mutation to update project settings
  const updateProject = useMutation(apiAny.projects.updateProject);

  // Initialize custom prompt from project data
  useEffect(() => {
    if (!project) return;
    setCustomPrompt(project.customAiPrompt || "");
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setAiAutoConfirmCrud(Boolean((project as { aiAutoConfirmCrud?: boolean }).aiAutoConfirmCrud));
  }, [project]);

  const handleSaveCustomPrompt = async () => {
    if (!projectId) return;

    setIsSaving(true);
    try {
      // Save as additional instructions only when non-empty and different from default body
      const normalizedPrompt = customPrompt.trim();
      const promptToSave =
        normalizedPrompt === "" || normalizedPrompt === defaultPrompt.trim()
          ? undefined
          : normalizedPrompt;
      await updateProject({
        projectId,
        customAiPrompt: promptToSave,
      });
      toast.success("AI instructions saved");
    } catch (error) {
      console.error("Failed to save custom AI prompt:", error);
      toast.error("Failed to save AI instructions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomPrompt("");
  };

  const handleToggleAutoConfirmCrud = async (checked: boolean) => {
    if (!projectId) return;

    const previousValue = aiAutoConfirmCrud;
    setAiAutoConfirmCrud(checked);
    setIsSavingAiConfirmMode(true);
    try {
      await updateProject({
        projectId,
        aiAutoConfirmCrud: checked,
      });
      toast.success(
        checked
          ? "Auto-confirm for AI CRUD actions enabled"
          : "Manual confirmation for AI CRUD actions enabled"
      );
    } catch (error) {
      setAiAutoConfirmCrud(previousValue);
      console.error("Failed to update AI confirmation mode:", error);
      toast.error("Failed to save AI confirmation mode");
    } finally {
      setIsSavingAiConfirmMode(false);
    }
  };

  const isCustomPromptChanged = customPrompt !== (project?.customAiPrompt || "");

  return (
    <div className="space-y-6">
      {/* AI Overview Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">AI Assistant</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Manage AI assistant settings for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="font-medium">AI CRUD Action Confirmation</p>
              <p className="text-sm text-muted-foreground">
                When enabled, the assistant will automatically run create/edit/delete without manual approval.
              </p>
              <p className="text-xs text-muted-foreground">
                Current mode: {aiAutoConfirmCrud ? "Auto-confirm CRUD" : "Manual confirmation"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSavingAiConfirmMode && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={aiAutoConfirmCrud}
                onCheckedChange={handleToggleAutoConfirmCrud}
                disabled={isSavingAiConfirmMode}
                aria-label="Toggle CRUD auto-confirm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom AI Instructions Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">Custom AI Instructions</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Add project-specific instructions. These are appended to the default system prompt guardrails.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customPrompt" className="text-sm font-medium">
              Additional Instructions
            </Label>
            <Textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-none"
              placeholder="Example: Prefer concise answers. Always include a brief risk note for schedule or budget recommendations."
            />
            <p className="text-xs text-muted-foreground">
              {customPrompt.trim() === "" ? (
                <>Using only the default system prompt ({defaultPrompt.length} characters)</>
              ) : (
                <>Using default prompt + additional instructions ({customPrompt.length} characters)</>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleSaveCustomPrompt}
              disabled={isSaving || !isCustomPromptChanged}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save Instructions
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={customPrompt.trim() === ""}
              className="flex-1 sm:flex-initial"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Instructions
            </Button>
          </div>

          {customPrompt.trim() !== "" && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Additional instructions affect only new conversations. Existing conversations keep their previous system instructions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
