"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganization } from "@clerk/nextjs";
import { z } from "zod";
import { toast } from "sonner";
import { type LucideIcon, AlertTriangle, ImagePlus, Settings, Shield, Sparkles, Users } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import AISettings from "./AISettings";
import ProjectMembers from "./ProjectMembers";
import TaskStatusSettings from "./TaskStatusSettings";

const settingsFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  coverImageUrl: z.string().optional().or(z.literal("")),
  responsibleClerkUserId: z.string().optional(),
  customer: z.string().optional(),
  budget: z.coerce.number().positive("Budget must be positive").optional().or(z.literal("")),
  location: z.string().optional(),
  status: z
    .enum(["planning", "active", "on_hold", "completed", "cancelled"])
    .optional(),
  currency: z
    .enum([
      "USD",
      "EUR",
      "PLN",
      "GBP",
      "CAD",
      "AUD",
      "JPY",
      "CHF",
      "SEK",
      "NOK",
      "DKK",
      "CZK",
      "HUF",
      "CNY",
      "INR",
      "BRL",
      "MXN",
      "KRW",
      "SGD",
      "HKD",
    ])
    .optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z
    .union([
      z.coerce
        .number()
        .min(0, "Tax rate must be at least 0")
        .max(100, "Tax rate cannot exceed 100"),
      z.literal(""),
    ])
    .optional(),
});

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please enter the project name to confirm deletion"),
});

type SettingsTabValue = "general" | "members" | "taskstatus" | "ai" | "advanced";

interface SettingsTabConfig {
  value: SettingsTabValue;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    value: "general",
    label: "General",
    description: "Project identity and business details",
    icon: Settings,
  },
  {
    value: "members",
    label: "Members",
    description: "Who can access and collaborate",
    icon: Users,
  },
  {
    value: "taskstatus",
    label: "Task Status",
    description: "Workflow naming and colors",
    icon: Shield,
  },
  {
    value: "ai",
    label: "AI",
    description: "Assistant behavior and integrations",
    icon: Sparkles,
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Destructive and irreversible actions",
    icon: AlertTriangle,
  },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "PLN", label: "PLN (zł)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "CHF", label: "CHF" },
  { value: "SEK", label: "SEK" },
  { value: "NOK", label: "NOK" },
  { value: "DKK", label: "DKK" },
  { value: "CZK", label: "CZK" },
  { value: "HUF", label: "HUF" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "INR", label: "INR (₹)" },
  { value: "BRL", label: "BRL (R$)" },
  { value: "MXN", label: "MXN ($)" },
  { value: "KRW", label: "KRW (₩)" },
  { value: "SGD", label: "SGD (S$)" },
  { value: "HKD", label: "HKD (HK$)" },
] as const;

function normalizeCoverImageUrl(rawUrl?: string) {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return encodeURI(trimmed);
    } catch {
      return null;
    }
  }
}

function ProjectSettingsSkeleton() {
  return <Spinner className="pb-8" />;
}

function SettingsTabSkeleton() {
  return (
    <Card className="clean-surface">
      <CardContent className="p-6 md:p-8">
        <Spinner fullHeight={false} />
      </CardContent>
    </Card>
  );
}

function ProjectSettingsContent() {
  const params = useParams<{ projectSlug: string }>();
  const router = useRouter();
  const { organization } = useOrganization();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabValue>("general");

  const project = useQuery(
    apiAny.projects.getProjectBySlugInClerkOrg,
    organization?.id
      ? { clerkOrgId: organization.id, projectSlug: params.projectSlug }
      : "skip"
  );

  const teamMember = useQuery(
    apiAny.teams.getCurrentUserTeamMember,
    project ? { teamId: project.teamId } : "skip"
  );
  const teamMembers = useQuery(
    apiAny.teams.getTeamMembers,
    project ? { teamId: project.teamId } : "skip"
  );

  const updateProject = useMutation(apiAny.projects.updateProject);
  const deleteProject = useMutation(apiAny.projects.deleteProject);

  const settingsForm = useForm<z.infer<typeof settingsFormSchema>>({
    resolver: zodResolver(settingsFormSchema),
    values: project
      ? {
          name: project.name,
          description: project.description || "",
          coverImageUrl: project.coverImageUrl || "",
          responsibleClerkUserId:
            ((project as { responsibleClerkUserId?: string }).responsibleClerkUserId ||
              project.createdBy) ??
            "",
          customer: project.customer || "",
          budget: project.budget || "",
          location: project.location || "",
          status: project.status || "planning",
          currency: project.currency || "PLN",
          taxEnabled: project.taxEnabled || false,
          taxRate: project.taxRate ?? 23,
        }
      : {
          name: "",
          description: "",
          coverImageUrl: "",
          responsibleClerkUserId: "",
          customer: "",
          budget: "",
          location: "",
          status: "planning",
          currency: "PLN",
          taxEnabled: false,
          taxRate: 23,
        },
  });

  const responsibleOptions = useMemo(() => {
    if (!teamMembers) {
      return [];
    }

    return teamMembers
      .filter(
        (member) =>
          member.isActive &&
          (member.role === "admin" || member.role === "member")
      )
      .map((member) => ({
        clerkUserId: member.clerkUserId,
        label: member.name || member.email || member.clerkUserId,
        email: member.email || "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teamMembers]);

  useEffect(() => {
    if (!project || responsibleOptions.length === 0) {
      return;
    }

    const currentValue = settingsForm.getValues("responsibleClerkUserId");
    const isCurrentValid = responsibleOptions.some(
      (option) => option.clerkUserId === currentValue
    );
    if (isCurrentValid) {
      return;
    }

    const creatorOption = responsibleOptions.find(
      (option) => option.clerkUserId === project.createdBy
    );
    settingsForm.setValue(
      "responsibleClerkUserId",
      creatorOption?.clerkUserId || responsibleOptions[0].clerkUserId,
      { shouldDirty: false, shouldTouch: false }
    );
  }, [project, responsibleOptions, settingsForm]);

  const deleteForm = useForm<z.infer<typeof deleteFormSchema>>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: { confirmName: "" },
  });

  if (!project || !teamMember || teamMembers === undefined) {
    return null;
  }

  const canEdit = teamMember.role === "admin" || teamMember.role === "member";

  if (!canEdit) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold text-orange-600">Read Only</h1>
        <p className="text-muted-foreground">
          You can view this project but cannot modify its settings.
        </p>
      </div>
    );
  }

  async function onSettingsSubmit(values: z.infer<typeof settingsFormSchema>) {
    const normalizedBudget =
      values.budget === "" || values.budget === undefined ? undefined : Number(values.budget);
    const normalizedCoverUrl = normalizeCoverImageUrl(values.coverImageUrl);
    const normalizedTaxRate =
      values.taxRate === "" || values.taxRate === undefined ? undefined : Number(values.taxRate);

    try {
      const validResponsibleIds = new Set(
        responsibleOptions.map((option) => option.clerkUserId)
      );
      const resolvedResponsibleClerkUserId =
        (values.responsibleClerkUserId &&
          validResponsibleIds.has(values.responsibleClerkUserId)
          ? values.responsibleClerkUserId
          : undefined) ||
        (validResponsibleIds.has(project.createdBy)
          ? project.createdBy
          : responsibleOptions[0]?.clerkUserId) ||
        project.createdBy;

      const result = await updateProject({
        projectId: project._id,
        name: values.name,
        description: values.description || undefined,
        coverImageUrl: normalizedCoverUrl ?? values.coverImageUrl?.trim() ?? "",
        customer: values.customer || undefined,
        budget: normalizedBudget,
        location: values.location || undefined,
        status: values.status,
        currency: values.currency,
        taxEnabled: values.taxEnabled || false,
        taxRate: values.taxEnabled ? normalizedTaxRate ?? 23 : undefined,
        responsibleClerkUserId: resolvedResponsibleClerkUserId,
      });
      toast.success("Project settings updated");

      if (result?.slug && result.slug !== params.projectSlug) {
        router.push(`/organisation/projects/${result.slug}/settings`);
      }
    } catch (error) {
      toast.error("Error updating project settings", {
        description:
          (error as Error).message ||
          "There was a problem updating the project settings.",
      });
    }
  }

  async function onDeleteSubmit(values: z.infer<typeof deleteFormSchema>) {
    if (values.confirmName !== project.name) {
      deleteForm.setError("confirmName", {
        message: "Project name doesn't match. Please type the exact project name.",
      });
      return;
    }

    try {
      await deleteProject({ projectId: project._id });
      toast.success("Project deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/organisation");
    } catch (error) {
      toast.error("Error deleting project", {
        description:
          (error as Error).message || "There was a problem deleting the project.",
      });
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <ProjectPageHeader
        title="Project Settings"
        icon={<Settings className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
        subtitle="Manage your project configuration and access."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTabValue)}
        className="w-full"
      >
        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <div className="space-y-3 self-start lg:sticky lg:top-6">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-1.5 rounded-[22px] border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)]/90 p-2">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-auto w-full flex-none justify-start rounded-xl border border-transparent px-3 py-2.5 text-left data-[state=active]:border-[var(--ui-border-soft)] data-[state=active]:bg-[var(--ui-surface-soft)] data-[state=active]:shadow-[0_14px_26px_-24px_rgba(0,0,0,0.62)]"
                  >
                    <span className="flex w-full items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)]">
                        <Icon className="h-3.5 w-3.5 text-[var(--ui-text-muted)]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--ui-text-main)]">
                          {tab.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--ui-text-muted)]">
                          {tab.description}
                        </span>
                      </span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <p className="rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/70 px-3 py-2 text-xs text-[var(--ui-text-muted)]">
              Changes are saved per section. Keep this page open while editing to avoid losing form state.
            </p>
          </div>

          <div className="min-w-0">
            <TabsContent value="general" className="mt-0">
              <GeneralTab
                projectId={project._id}
                responsibleOptions={responsibleOptions}
                settingsForm={settingsForm}
                onSettingsSubmit={onSettingsSubmit}
              />
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              <Suspense fallback={<SettingsTabSkeleton />}>
                <MembersTab project={project} />
              </Suspense>
            </TabsContent>

            <TabsContent value="taskstatus" className="mt-0">
              <Suspense fallback={<SettingsTabSkeleton />}>
                <TaskStatusTab project={project} />
              </Suspense>
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <Suspense fallback={<SettingsTabSkeleton />}>
                <AISettings projectId={project._id} />
              </Suspense>
            </TabsContent>

            <TabsContent value="advanced" className="mt-0">
              <AdvancedTab
                project={project}
                deleteForm={deleteForm}
                deleteDialogOpen={deleteDialogOpen}
                setDeleteDialogOpen={setDeleteDialogOpen}
                onDeleteSubmit={onDeleteSubmit}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

export default function ProjectSettings() {
  return (
    <Suspense fallback={<ProjectSettingsSkeleton />}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

function GeneralTab({
  projectId,
  responsibleOptions,
  settingsForm,
  onSettingsSubmit,
}: {
  projectId: Id<"projects">;
  responsibleOptions: Array<{ clerkUserId: string; label: string; email: string }>;
  settingsForm: UseFormReturn<z.infer<typeof settingsFormSchema>>;
  onSettingsSubmit: (values: z.infer<typeof settingsFormSchema>) => void;
}) {
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [coverPreviewStatus, setCoverPreviewStatus] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverPreviewUrl = settingsForm.watch("coverImageUrl");
  const normalizedCoverPreviewUrl = normalizeCoverImageUrl(coverPreviewUrl);
  const hasUnsavedChanges = settingsForm.formState.isDirty;
  const hasCoverPreview = coverPreviewStatus === "ready";

  useEffect(() => {
    if (!normalizedCoverPreviewUrl) {
      setCoverPreviewStatus("empty");
      return;
    }

    let cancelled = false;
    setCoverPreviewStatus("loading");

    const imageProbe = new window.Image();
    imageProbe.onload = () => {
      if (!cancelled) {
        setCoverPreviewStatus("ready");
      }
    };
    imageProbe.onerror = () => {
      if (!cancelled) {
        setCoverPreviewStatus("error");
      }
    };
    imageProbe.src = normalizedCoverPreviewUrl;

    return () => {
      cancelled = true;
      imageProbe.onload = null;
      imageProbe.onerror = null;
    };
  }, [normalizedCoverPreviewUrl]);

  const handleCoverImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingCoverImage(true);
    try {
      const uploadData = await generateUploadUrl({
        projectId,
        fileName: file.name,
        fileSize: file.size,
      });

      const uploadResponse = await fetch(uploadData.url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Cover upload failed (${uploadResponse.status})`);
      }

      await addFile({
        projectId,
        folderId: undefined,
        fileKey: uploadData.key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        origin: "general",
      });

      if (!uploadData.publicUrl) {
        throw new Error("Missing public URL for uploaded cover image");
      }

      settingsForm.setValue("coverImageUrl", uploadData.publicUrl, {
        shouldDirty: true,
        shouldTouch: true,
      });
      toast.success("Cover image uploaded. Save changes to apply.");
    } catch (error) {
      toast.error("Failed to upload cover image", {
        description: (error as Error).message,
      });
    } finally {
      setUploadingCoverImage(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className="clean-panel overflow-hidden">
      <CardHeader className="border-b border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/45 pb-5">
        <CardTitle className="text-lg lg:text-xl">General Settings</CardTitle>
        <CardDescription className="text-sm">
          Update the project identity, cover image, and operational details visible across the workspace.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 p-4 md:p-6">
        <Form {...settingsForm}>
          <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
            <section className="rounded-2xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 md:p-5">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-[var(--ui-text-main)]">Identity</h3>
                <p className="text-xs text-[var(--ui-text-muted)]">
                  This information appears in dashboards, lists, and notifications.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={settingsForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Project Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Project name"
                          {...field}
                          className="h-10 w-full bg-[var(--ui-surface-base)]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Project Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full bg-[var(--ui-surface-base)]">
                            <SelectValue placeholder="Select project status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={settingsForm.control}
                name="responsibleClerkUserId"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel className="text-sm font-medium">
                      Project Owner (Email Notifications)
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={responsibleOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-full bg-[var(--ui-surface-base)]">
                          <SelectValue placeholder="Select team member responsible for this project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {responsibleOptions.map((option) => (
                          <SelectItem key={option.clerkUserId} value={option.clerkUserId}>
                            {option.label}
                            {option.email ? ` (${option.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[var(--ui-text-muted)]">
                      Client portal response emails are sent to this person. Default is the project creator.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingsForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel className="text-sm font-medium">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What is this project about?"
                        {...field}
                        className="min-h-[110px] w-full resize-none bg-[var(--ui-surface-base)]"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="rounded-2xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 md:p-5">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-[var(--ui-text-main)]">Cover Image</h3>
                <p className="text-xs text-[var(--ui-text-muted)]">
                  Paste an image URL or upload directly to your project files.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-3">
                  <FormField
                    control={settingsForm.control}
                    name="coverImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Cover Image URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/project-cover.jpg"
                            {...field}
                            className="h-10 w-full bg-[var(--ui-surface-base)]"
                            onBlur={(event) => {
                              field.onBlur();
                              const normalizedUrl = normalizeCoverImageUrl(event.target.value);
                              if (normalizedUrl && normalizedUrl !== field.value) {
                                settingsForm.setValue("coverImageUrl", normalizedUrl, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverImageUpload}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={uploadingCoverImage}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {uploadingCoverImage ? "Uploading..." : "Upload image"}
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]">
                  {hasCoverPreview ? (
                    <img
                      src={normalizedCoverPreviewUrl ?? undefined}
                      alt="Project cover preview"
                      className="h-[184px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[184px] items-center justify-center px-4 text-center text-xs text-[var(--ui-text-muted)]">
                      {coverPreviewStatus === "loading"
                        ? "Loading preview..."
                        : coverPreviewStatus === "error"
                        ? "Could not load this image URL. Check filename characters and URL encoding."
                        : "Add a valid image URL or upload an image to preview it here."}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-base)] p-4 md:p-5">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold text-[var(--ui-text-main)]">Business Details</h3>
                <p className="text-xs text-[var(--ui-text-muted)]">
                  Optional project metadata for reporting and planning.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={settingsForm.control}
                  name="customer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Client</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Client name"
                          {...field}
                          className="h-10 w-full bg-[var(--ui-surface-base)]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Project location"
                          {...field}
                          className="h-10 w-full bg-[var(--ui-surface-base)]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Project budget"
                          {...field}
                          className="h-10 w-full bg-[var(--ui-surface-base)]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full bg-[var(--ui-surface-base)]">
                            <SelectValue placeholder="Select project currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="taxEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/60 p-4 md:col-span-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Include tax in project cost analysis
                        </FormLabel>
                        <p className="text-xs text-[var(--ui-text-muted)]">
                          Overview totals will show net, tax, and gross. Estimations will use this as the default VAT.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="23"
                          {...field}
                          value={field.value ?? ""}
                          disabled={!settingsForm.watch("taxEnabled")}
                          className="h-10 w-full bg-[var(--ui-surface-base)]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 rounded-xl border border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)]/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--ui-text-muted)]">
                {hasUnsavedChanges
                  ? "You have unsaved changes in this section."
                  : "Everything in this section is up to date."}
              </p>
              <Button
                type="submit"
                disabled={settingsForm.formState.isSubmitting}
                className="w-full text-sm font-medium sm:w-auto sm:min-w-[170px]"
              >
                {settingsForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function MembersTab({ project }: { project: { _id: Id<"projects">; teamId: Id<"teams">; name: string } }) {
  return <ProjectMembers project={project} />;
}

function TaskStatusTab({ project }: { project: { _id: string; taskStatusSettings?: unknown } }) {
  return (
    <div>
      {project && project.taskStatusSettings ? (
        <TaskStatusSettings
          projectId={project._id as Id<"projects">}
          initialSettings={project.taskStatusSettings as {
            todo: { name: string; color: string };
            in_progress: { name: string; color: string };
            review: { name: string; color: string };
            done: { name: string; color: string };
          }}
        />
      ) : (
        <Card className="clean-surface">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg lg:text-xl">Task Status Settings</CardTitle>
            <CardDescription className="text-sm">
              Configure custom task statuses for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 lg:px-6">
            <p className="text-sm text-muted-foreground">
              Task status settings will be available here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdvancedTab({
  project,
  deleteForm,
  deleteDialogOpen,
  setDeleteDialogOpen,
  onDeleteSubmit,
}: {
  project: { name: string };
  deleteForm: UseFormReturn<z.infer<typeof deleteFormSchema>>;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  onDeleteSubmit: (values: z.infer<typeof deleteFormSchema>) => void;
}) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <Card className="clean-surface">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg lg:text-xl">Advanced Settings</CardTitle>
          <CardDescription className="text-sm">
            Use advanced actions carefully. Some operations cannot be reversed.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <p className="text-sm text-muted-foreground">
            Future project-level controls will be added here.
          </p>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50/30 dark:border-red-900/70 dark:bg-red-950/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-red-600 lg:text-xl">Danger Zone</CardTitle>
          <CardDescription className="text-sm">
            Permanent actions that remove data for the whole team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 lg:px-6">
          <div className="rounded-xl border border-red-200/80 bg-background/80 p-4 dark:border-red-900/70">
            <h4 className="mb-2 text-sm font-medium text-red-600">Delete Project</h4>
            <p className="mb-4 text-sm text-muted-foreground">
              Deleting this project removes tasks, files, comments, and related history. This action is irreversible.
            </p>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Delete Project
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:max-w-[460px]">
                <DialogHeader>
                  <DialogTitle className="text-lg">Delete Project</DialogTitle>
                  <DialogDescription className="text-sm">
                    This action cannot be undone. Type the project name exactly to confirm permanent deletion.
                  </DialogDescription>
                </DialogHeader>
                <Form {...deleteForm}>
                  <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4 lg:space-y-6">
                    <FormField
                      control={deleteForm.control}
                      name="confirmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">
                            Type <span className="font-mono font-semibold">{project.name}</span> to confirm:
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={project.name}
                              {...field}
                              autoComplete="off"
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={deleteForm.formState.isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        {deleteForm.formState.isSubmitting ? "Deleting..." : "Delete Project"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
