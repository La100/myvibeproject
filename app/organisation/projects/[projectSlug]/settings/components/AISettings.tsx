"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
} from "lucide-react";

interface AISettingsProps {
  projectId: Id<"projects">;
}

export default function AISettings({ projectId }: AISettingsProps) {
  const [aiAutoConfirmCrud, setAiAutoConfirmCrud] = useState(false);
  const [isSavingAiConfirmMode, setIsSavingAiConfirmMode] = useState(false);

  // Get project data
  const project = useQuery(apiAny.projects.getProject, projectId ? { projectId } : "skip");

  // Mutation to update project settings
  const updateProject = useMutation(apiAny.projects.updateProject);

  useEffect(() => {
    if (!project) return;
    setAiAutoConfirmCrud(Boolean((project as { aiAutoConfirmCrud?: boolean }).aiAutoConfirmCrud));
  }, [project]);

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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">AI Actions</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Manage AI execution settings for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
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
    </div>
  );
}
