"use client";

import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

const buildTaskStatusSettingsSchema = (t: ReturnType<typeof useI18n>["t"]) => z.object({
  statuses: z.object({
    todo: z.object({
      name: z.string().min(1, t("projectSettingsExtra", "nameRequired")),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t("projectSettingsExtra", "mustBeValidHexColor")),
    }),
    in_progress: z.object({
      name: z.string().min(1, t("projectSettingsExtra", "nameRequired")),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t("projectSettingsExtra", "mustBeValidHexColor")),
    }),
    review: z.object({
      name: z.string().min(1, t("projectSettingsExtra", "nameRequired")),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t("projectSettingsExtra", "mustBeValidHexColor")),
    }),
    done: z.object({
      name: z.string().min(1, t("projectSettingsExtra", "nameRequired")),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t("projectSettingsExtra", "mustBeValidHexColor")),
    }),
  }),
});

type TaskStatusSettingsFormValues = z.infer<ReturnType<typeof buildTaskStatusSettingsSchema>>;

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

const STATUS_META_KEYS: Record<StatusKey, { titleKey: "statusTodo" | "statusInProgress" | "statusReview" | "statusDone"; descriptionKey: "tasksNotStarted" | "tasksInProgress" | "tasksAwaitingReview" | "completedAndClosedWork" }> = {
  todo: {
    titleKey: "statusTodo",
    descriptionKey: "tasksNotStarted",
  },
  in_progress: {
    titleKey: "statusInProgress",
    descriptionKey: "tasksInProgress",
  },
  review: {
    titleKey: "statusReview",
    descriptionKey: "tasksAwaitingReview",
  },
  done: {
    titleKey: "statusDone",
    descriptionKey: "completedAndClosedWork",
  },
};

export default function TaskStatusSettings({ projectId, initialSettings }: TaskStatusSettingsProps) {
  const { t } = useI18n();
  const updateSettings = useMutation(apiAny.projects.updateProjectTaskStatusSettings);
  const taskStatusSettingsSchema = buildTaskStatusSettingsSchema(t);

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
      toast.success(t("projectSettingsExtra", "statusSettingsSaved"));
    } catch (error) {
      console.error("Failed to update task status settings:", error);
      toast.error(t("projectSettingsExtra", "failedToUpdateSettings"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-border/70 pb-5">
        <h3 className="text-lg font-semibold text-foreground">{t("projectSettingsExtra", "taskStatusSettings")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("projectSettingsExtra", "customTaskWorkflowDescription")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {statusKeys.map((key) => {
                const statusMeta = STATUS_META_KEYS[key];
                const previewName = watchedStatuses?.[key]?.name || t("projectSettingsExtra", statusMeta.titleKey);
                const previewColor = watchedStatuses?.[key]?.color || "#6B7280";

                return (
                  <div
                    key={key}
                    className="rounded-2xl bg-secondary/70 p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {t("projectSettingsExtra", statusMeta.titleKey)}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("projectSettingsExtra", statusMeta.descriptionKey)}
                        </p>
                      </div>

                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
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
                            <FormLabel>{t("projectSettingsExtra", "statusName")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                            <FormLabel>{t("projectSettingsExtra", "statusColor")}</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  {...field}
                                  className="h-10 w-14 p-1"
                                />
                                <Input
                                  {...field}
                                  placeholder={t("projectSettingsExtra", "hexColorPlaceholder")}
                                  className="flex-1"
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

            <div className="flex flex-col-reverse gap-3 rounded-xl bg-secondary/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t("projectSettingsExtra", "updatedLabelsDescription")}
              </p>
              <Button type="submit" disabled={form.formState.isSubmitting} className="sm:min-w-[120px]">
                {form.formState.isSubmitting ? t("projectSettingsExtra", "saving") : t("projectSettingsExtra", "save")}
              </Button>
            </div>
          </form>
        </Form>
    </div>
  );
}
