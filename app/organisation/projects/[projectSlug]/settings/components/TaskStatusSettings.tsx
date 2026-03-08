"use client";

import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const statusSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

const taskStatusSettingsSchema = z.object({
  statuses: z.object({
    todo: statusSchema,
    in_progress: statusSchema,
    review: statusSchema,
    done: statusSchema,
  }),
});

type TaskStatusSettingsFormValues = z.infer<typeof taskStatusSettingsSchema>;

type StatusKey = keyof TaskStatusSettingsFormValues["statuses"];

interface TaskStatusSettingsProps {
  projectId: Id<"projects">;
  initialSettings: {
    todo: { name: string; color: string };
    in_progress: { name: string; color: string };
    review: { name: string; color: string };
    done: { name: string; color: string };
  };
}

const STATUS_META: Record<StatusKey, { title: string; description: string }> = {
  todo: {
    title: "To do",
    description: "Backlog tasks that are not started yet.",
  },
  in_progress: {
    title: "In progress",
    description: "Tasks currently being worked on.",
  },
  review: {
    title: "Review",
    description: "Tasks awaiting approval or verification.",
  },
  done: {
    title: "Done",
    description: "Completed and closed work.",
  },
};

export default function TaskStatusSettings({ projectId, initialSettings }: TaskStatusSettingsProps) {
  const updateSettings = useMutation(apiAny.projects.updateProjectTaskStatusSettings);

  const form = useForm<TaskStatusSettingsFormValues>({
    resolver: zodResolver(taskStatusSettingsSchema),
    defaultValues: {
      statuses: initialSettings,
    },
  });

  const statusKeys = Object.keys(initialSettings) as StatusKey[];
  const watchedStatuses = form.watch("statuses");

  const onSubmit = async (values: TaskStatusSettingsFormValues) => {
    try {
      await updateSettings({
        projectId,
        settings: values.statuses,
      });
      toast.success("Task status settings updated successfully!");
    } catch (error) {
      console.error("Failed to update task status settings:", error);
      toast.error("Failed to update settings.");
    }
  };

  return (
    <Card className="clean-panel overflow-hidden">
      <CardHeader className="border-b border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/45 pb-5">
        <CardTitle>Task Status Settings</CardTitle>
        <CardDescription>
          Customize labels and colors for each stage in your task workflow.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-4 md:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {statusKeys.map((key) => {
                const statusMeta = STATUS_META[key];
                const previewName = watchedStatuses?.[key]?.name || statusMeta.title;
                const previewColor = watchedStatuses?.[key]?.color || "#6B7280";

                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--ui-text-main)]">
                          {statusMeta.title}
                        </h4>
                        <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                          {statusMeta.description}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--ui-text-main)]">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-black/10"
                          style={{ backgroundColor: previewColor }}
                        />
                        {previewName}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      <FormField
                        control={form.control}
                        name={`statuses.${key}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status Name</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-[var(--ui-surface-base)]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`statuses.${key}.color`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  {...field}
                                  className="h-10 w-14 border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-1"
                                />
                                <Input
                                  {...field}
                                  placeholder="#RRGGBB"
                                  className="flex-1 bg-[var(--ui-surface-base)]"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse gap-3 rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--ui-text-muted)]">
                Updated labels and colors are used across boards and task details.
              </p>
              <Button type="submit" disabled={form.formState.isSubmitting} className="sm:min-w-[190px]">
                {form.formState.isSubmitting ? "Saving..." : "Save Status Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
