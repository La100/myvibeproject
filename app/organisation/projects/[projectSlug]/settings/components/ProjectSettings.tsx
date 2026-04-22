"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganization } from "@clerk/nextjs";
import { z } from "zod";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { type LucideIcon, AlertTriangle, CalendarRange, CheckCircle2, ImagePlus, Settings, Shield, Users, X } from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { optimizeCoverImageForUpload } from "@/lib/coverImageUpload";
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
import ProjectMembers from "./ProjectMembers";
import TaskStatusSettings from "./TaskStatusSettings";

const settingsFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  coverImageUrl: z.string().optional().or(z.literal("")),
  responsibleClerkUserId: z.string().optional(),
  clientPortalDigestRecipientClerkUserIds: z.array(z.string()).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  customer: z.string().optional(),
  budget: z.coerce.number().positive("Budget must be positive").optional().or(z.literal("")),
  location: z.string().optional(),
  status: z
    .enum(["planning", "active", "on_hold", "completed", "cancelled"])
    .optional(),
  measurements: z
    .enum(["metric", "imperial"])
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
});

const deleteFormSchema = z.object({
  confirmName: z.string().min(1, "Please enter the project name to confirm deletion"),
});

type SettingsTabValue = "general" | "members" | "taskstatus" | "advanced";

interface SettingsTabConfig {
  value: SettingsTabValue;
  label: string;
  icon: LucideIcon;
}

const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    value: "general",
    label: "General",
    icon: Settings,
  },
  {
    value: "members",
    label: "Members",
    icon: Users,
  },
  {
    value: "taskstatus",
    label: "Task Status",
    icon: Shield,
  },
  {
    value: "advanced",
    label: "Advanced",
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

function formatDateInputValue(timestamp?: number | null) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatSavedTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveClientPortalDigestRecipientIds(
  project:
    | ({
        createdBy: string;
        responsibleClerkUserId?: string;
        clientPortalNotificationSettings?: {
          sendToOwner?: boolean;
          sendToResponsible?: boolean;
          sendToAdmins?: boolean;
          recipientClerkUserIds?: string[];
        };
      } & Record<string, unknown>)
    | null
    | undefined,
  teamMembers:
    | Array<{
        clerkUserId: string;
        isActive: boolean;
        role: "admin" | "member";
      }>
    | undefined,
) {
  if (!project) {
    return [];
  }

  const configuredRecipientIds =
    project.clientPortalNotificationSettings?.recipientClerkUserIds ?? [];
  const normalizedConfiguredRecipientIds = Array.from(
    new Set(
      configuredRecipientIds
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (normalizedConfiguredRecipientIds.length > 0) {
    return normalizedConfiguredRecipientIds;
  }

  const activeMembers = (teamMembers ?? []).filter(
    (member) =>
      member.isActive &&
      (member.role === "admin" || member.role === "member"),
  );
  const legacyRecipientIds: string[] = [];

  if (project.clientPortalNotificationSettings?.sendToOwner ?? true) {
    legacyRecipientIds.push(project.createdBy);
  }
  if (project.clientPortalNotificationSettings?.sendToResponsible ?? true) {
    legacyRecipientIds.push(
      project.responsibleClerkUserId?.trim() || project.createdBy,
    );
  }
  if (project.clientPortalNotificationSettings?.sendToAdmins ?? false) {
    legacyRecipientIds.push(
      ...activeMembers
        .filter((member) => member.role === "admin")
        .map((member) => member.clerkUserId),
    );
  }

  return Array.from(
    new Set(
      legacyRecipientIds
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
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
          clientPortalDigestRecipientClerkUserIds:
            resolveClientPortalDigestRecipientIds(
              project as {
                createdBy: string;
                responsibleClerkUserId?: string;
                clientPortalNotificationSettings?: {
                  sendToOwner?: boolean;
                  sendToResponsible?: boolean;
                  sendToAdmins?: boolean;
                  recipientClerkUserIds?: string[];
                };
              },
              teamMembers,
            ),
          startDate: formatDateInputValue(project.startDate),
          endDate: formatDateInputValue(project.endDate),
          customer: project.customer || "",
          budget: project.budget || "",
          location: project.location || "",
          status: project.status || "planning",
          measurements: project.measurements || "metric",
          currency: project.currency || "PLN",
        }
      : {
          name: "",
          description: "",
          coverImageUrl: "",
          responsibleClerkUserId: "",
          clientPortalDigestRecipientClerkUserIds: [],
          startDate: "",
          endDate: "",
          customer: "",
          budget: "",
          location: "",
          status: "planning",
          measurements: "metric",
          currency: "PLN",
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

  const ownerOption = useMemo(
    () =>
      responsibleOptions.find((option) => option.clerkUserId === project?.createdBy) ?? null,
    [project?.createdBy, responsibleOptions],
  );

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

  const onSettingsSubmit = useCallback(async (
    values: z.infer<typeof settingsFormSchema>,
    options?: { silent?: boolean },
  ) => {
    if (!project) {
      return false;
    }

    const normalizedBudget =
      values.budget === "" || values.budget === undefined ? undefined : Number(values.budget);
    const normalizedCoverUrl = normalizeCoverImageUrl(values.coverImageUrl);
    const normalizedStartDate = values.startDate ? new Date(values.startDate).getTime() : undefined;
    const normalizedEndDate = values.endDate ? new Date(values.endDate).getTime() : undefined;

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
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        measurements: values.measurements,
        currency: values.currency,
        responsibleClerkUserId: resolvedResponsibleClerkUserId,
        clientPortalNotificationSettings: {
          recipientClerkUserIds:
            values.clientPortalDigestRecipientClerkUserIds ?? [],
        },
      });
      if (result?.slug && result.slug !== params.projectSlug) {
        router.push(`/organisation/projects/${result.slug}/settings`);
      }
      return true;
    } catch (error) {
      if (!options?.silent) {
        toast.error("Error updating project settings", {
          description:
            (error as Error).message ||
            "There was a problem updating the project settings.",
        });
      }
      return false;
    }
  }, [
    params.projectSlug,
    project,
    responsibleOptions,
    router,
    updateProject,
  ]);

  if (!project || !teamMember || teamMembers === undefined) {
    return null;
  }

  const canEdit = teamMember.role === "admin" || teamMember.role === "member";

  if (!canEdit) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold text-destructive">Read Only</h1>
        <p className="text-muted-foreground">
          You can view this project but cannot modify its settings.
        </p>
      </div>
    );
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
    <div className="flex flex-col gap-6 pb-10">
      <ProjectPageHeader
        title="Project Settings"
        icon={<Settings className="h-8 w-8 text-primary" />}
        subtitle="Manage your project configuration and access."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTabValue)}
        className="w-full"
      >
        <div className="flex flex-col gap-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[28px] border border-border/70 bg-card/95 p-3 shadow-[0_16px_40px_-34px_rgba(25,25,25,0.55)] md:grid-cols-4">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto w-full flex-none justify-start rounded-[22px] border border-transparent px-4 py-4 text-left transition-all hover:border-border/60 hover:bg-background data-[state=active]:border-border/80 data-[state=active]:bg-background data-[state=active]:shadow-[0_14px_30px_-26px_rgba(25,25,25,0.5)]"
                >
                  <span className="flex w-full items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 text-[1rem] font-medium text-foreground">
                      {tab.label}
                    </span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="min-w-0">
            <TabsContent value="general" className="mt-0">
              <GeneralTab
                projectId={project._id}
                projectOwnerClerkUserId={project.createdBy}
                projectCoverImageUrl={project.coverImageUrl}
                projectCoverImageDisplayUrl={
                  (project as { coverImageDisplayUrl?: string }).coverImageDisplayUrl
                }
                responsibleOptions={responsibleOptions}
                ownerOption={ownerOption}
                digestRecipientOptions={responsibleOptions}
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
  projectOwnerClerkUserId,
  projectCoverImageUrl,
  projectCoverImageDisplayUrl,
  responsibleOptions,
  ownerOption,
  digestRecipientOptions,
  settingsForm,
  onSettingsSubmit,
}: {
  projectId: Id<"projects">;
  projectOwnerClerkUserId: string;
  projectCoverImageUrl?: string;
  projectCoverImageDisplayUrl?: string;
  responsibleOptions: Array<{ clerkUserId: string; label: string; email: string }>;
  ownerOption: { clerkUserId: string; label: string; email: string } | null;
  digestRecipientOptions: Array<{ clerkUserId: string; label: string; email: string }>;
  settingsForm: UseFormReturn<z.infer<typeof settingsFormSchema>>;
  onSettingsSubmit: (
    values: z.infer<typeof settingsFormSchema>,
    options?: { silent?: boolean },
  ) => Promise<boolean>;
}) {
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [coverPreviewStatus, setCoverPreviewStatus] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const localCoverPreviewUrlRef = useRef<string | null>(null);
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = useState<string | null>(null);
  const [uploadedCoverPreviewUrl, setUploadedCoverPreviewUrl] = useState<string | null>(null);
  const [coverPreviewCandidateIndex, setCoverPreviewCandidateIndex] = useState(0);
  const [coverPreviewErrorMessage, setCoverPreviewErrorMessage] = useState<string | null>(null);
  const coverImageValue = settingsForm.watch("coverImageUrl")?.trim() ?? "";
  const normalizedCoverPreviewUrl = normalizeCoverImageUrl(coverImageValue);
  const persistedCoverPreviewUrl =
    normalizedCoverPreviewUrl ||
    (coverImageValue && coverImageValue === (projectCoverImageUrl?.trim() ?? "")
      ? projectCoverImageDisplayUrl || null
      : null);
  const coverPreviewCandidates = useMemo(() => {
    const candidates = [
      localCoverPreviewUrl,
      uploadedCoverPreviewUrl,
      persistedCoverPreviewUrl,
    ].filter((value): value is string => Boolean(value));

    return candidates.filter((value, index) => candidates.indexOf(value) === index);
  }, [localCoverPreviewUrl, persistedCoverPreviewUrl, uploadedCoverPreviewUrl]);
  const coverPreviewUrl = coverPreviewCandidates[coverPreviewCandidateIndex] ?? null;
  const hasCoverPreview = coverPreviewStatus === "ready";
  const selectedDigestRecipientIds =
    settingsForm.watch("clientPortalDigestRecipientClerkUserIds") ?? [];
  const selectedStatus = settingsForm.watch("status") ?? "planning";
  const selectedMeasurements = settingsForm.watch("measurements") ?? "metric";
  const watchedSettingsValues = useWatch({ control: settingsForm.control });
  const autosaveSnapshotRef = useRef<string | null>(null);
  const autosaveInitializedRef = useRef(false);
  const autosaveStatusTimeoutRef = useRef<number | null>(null);
  const autosaveRequestIdRef = useRef(0);
  const autosaveHandledRequestIdRef = useRef(0);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const replaceLocalCoverPreviewUrl = (nextUrl: string | null) => {
    if (localCoverPreviewUrlRef.current) {
      URL.revokeObjectURL(localCoverPreviewUrlRef.current);
    }
    localCoverPreviewUrlRef.current = nextUrl;
    setLocalCoverPreviewUrl(nextUrl);
  };

  useEffect(() => {
    return () => {
      if (localCoverPreviewUrlRef.current) {
        URL.revokeObjectURL(localCoverPreviewUrlRef.current);
      }
      if (autosaveStatusTimeoutRef.current) {
        clearTimeout(autosaveStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      localCoverPreviewUrlRef.current &&
      coverImageValue &&
      coverImageValue === (projectCoverImageUrl?.trim() ?? "")
    ) {
      replaceLocalCoverPreviewUrl(null);
    }
  }, [coverImageValue, projectCoverImageUrl]);

  useEffect(() => {
    setCoverPreviewCandidateIndex(0);
    setCoverPreviewErrorMessage(null);
  }, [coverPreviewCandidates]);

  useEffect(() => {
    if (!coverPreviewUrl) {
      setCoverPreviewStatus("empty");
      return;
    }

    let cancelled = false;
    setCoverPreviewStatus("loading");

    const imageProbe = new window.Image();
    imageProbe.onload = () => {
      if (!cancelled) {
        setCoverPreviewStatus("ready");
        setCoverPreviewErrorMessage(null);
      }
    };
    imageProbe.onerror = () => {
      if (!cancelled) {
        if (coverPreviewCandidateIndex < coverPreviewCandidates.length - 1) {
          setCoverPreviewCandidateIndex((current) => current + 1);
          return;
        }
        setCoverPreviewStatus("error");
      }
    };
    imageProbe.src = coverPreviewUrl;

    return () => {
      cancelled = true;
      imageProbe.onload = null;
      imageProbe.onerror = null;
    };
  }, [coverPreviewCandidateIndex, coverPreviewCandidates.length, coverPreviewUrl]);

  useEffect(() => {
    const serializedValues = JSON.stringify(watchedSettingsValues ?? {});

    if (!autosaveInitializedRef.current) {
      autosaveInitializedRef.current = true;
      autosaveSnapshotRef.current = serializedValues;
      return;
    }

    if (!settingsForm.formState.isDirty || settingsForm.formState.isSubmitting) {
      return;
    }

    if (serializedValues === autosaveSnapshotRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = autosaveRequestIdRef.current + 1;
      autosaveRequestIdRef.current = requestId;
      setAutosaveState("saving");

      void settingsForm.handleSubmit(
        async (values) => {
          const didSave = await onSettingsSubmit(values, { silent: true });

          if (requestId < autosaveHandledRequestIdRef.current) {
            return;
          }

          autosaveHandledRequestIdRef.current = requestId;

          if (!didSave) {
            setAutosaveState("error");
            return;
          }

          autosaveSnapshotRef.current = serializedValues;
          setAutosaveState("saved");
          setLastSavedAt(Date.now());

          if (autosaveStatusTimeoutRef.current) {
            clearTimeout(autosaveStatusTimeoutRef.current);
          }

          autosaveStatusTimeoutRef.current = window.setTimeout(() => {
            setAutosaveState("idle");
          }, 1800);
        },
        () => {
          setAutosaveState("error");
        },
      )();
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    onSettingsSubmit,
    settingsForm,
    settingsForm.formState.isDirty,
    settingsForm.formState.isSubmitting,
    watchedSettingsValues,
  ]);

  const handleCoverImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const normalizedFileName = file.name.toLowerCase();
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      normalizedFileName.endsWith(".heic") ||
      normalizedFileName.endsWith(".heif")
    ) {
      setCoverPreviewErrorMessage(
        "This HEIC/HEIF image may upload, but this browser cannot preview it reliably. Use JPG, PNG, or WebP for a visible cover."
      );
    } else {
      setCoverPreviewErrorMessage(null);
    }

    setUploadingCoverImage(true);
    try {
      const optimized = await optimizeCoverImageForUpload(file);
      const uploadFile = optimized.file;

      const uploadData = await generateUploadUrl({
        projectId,
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
      });

      const uploadResponse = await fetch(uploadData.url, {
        method: "PUT",
        body: uploadFile,
        headers: {
          "Content-Type": uploadFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Cover upload failed (${uploadResponse.status})`);
      }

      await addFile({
        projectId,
        folderId: undefined,
        fileKey: uploadData.key,
        fileName: uploadFile.name,
        fileType: uploadFile.type,
        fileSize: uploadFile.size,
        origin: "general",
      });

      replaceLocalCoverPreviewUrl(URL.createObjectURL(uploadFile));
      setUploadedCoverPreviewUrl(uploadData.publicUrl || null);
      settingsForm.setValue("coverImageUrl", uploadData.key, {
        shouldDirty: true,
        shouldTouch: true,
      });

      if (optimized.optimized) {
        const savedKb = Math.max(1, Math.round((optimized.originalSize - uploadFile.size) / 1024));
        toast.success("Cover image uploaded and optimized", {
          description: `Reduced by about ${savedKb} KB and queued for automatic save.`,
        });
      } else {
        toast.success("Cover image uploaded and queued for automatic save.");
      }
    } catch (error) {
      toast.error("Failed to upload cover image", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setUploadingCoverImage(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  const handleCoverImageRemove = () => {
    replaceLocalCoverPreviewUrl(null);
    setUploadedCoverPreviewUrl(null);
    setCoverPreviewErrorMessage(null);
    settingsForm.setValue("coverImageUrl", "", {
      shouldDirty: true,
      shouldTouch: true,
    });
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = "";
    }
  };

  return (
    <Card className="clean-panel overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-transparent pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              General
            </p>
            <CardTitle className="text-xl lg:text-2xl">Project identity and operating details</CardTitle>
            <CardDescription className="max-w-2xl text-sm">
              Keep the project profile, timeline, recipients, and financial defaults aligned with how the team actually runs the work.
            </CardDescription>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Status
              </p>
              <p className="mt-1 text-sm font-medium capitalize text-foreground">
                {selectedStatus.replace("_", " ")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Measurements
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {selectedMeasurements === "imperial" ? "Imperial" : "Metric"}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Changes in this section save automatically.
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {autosaveState === "saving"
              ? "Saving..."
              : autosaveState === "saved"
              ? `Saved ${lastSavedAt ? formatSavedTimeLabel(lastSavedAt) : ""}`.trim()
              : autosaveState === "error"
              ? "Save failed"
              : "Auto-save on"}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 p-4 md:p-6">
        <Form {...settingsForm}>
          <form
            onSubmit={settingsForm.handleSubmit((values) => onSettingsSubmit(values))}
            className="flex flex-col gap-6"
          >
            <section className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Identity</h3>
                <p className="text-xs text-muted-foreground">
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
                          className="h-10 w-full"
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
                          <SelectTrigger className="h-10 w-full">
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
                      Responsible Person
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={responsibleOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
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
                    <p className="text-xs text-muted-foreground">
                      This is the person operationally responsible for the project. They can also receive client portal digests.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">Project Owner</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ownerOption
                    ? `${ownerOption.label}${ownerOption.email ? ` (${ownerOption.email})` : ""}`
                    : projectOwnerClerkUserId}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The project owner is always the person who created the project.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="mb-3 flex flex-col gap-1">
                  <h4 className="text-sm font-medium text-foreground">Client Portal Digest Recipients</h4>
                  <p className="text-xs text-muted-foreground">
                    Choose which project people receive the hourly summary email for client portal updates.
                  </p>
                </div>

                <FormField
                  control={settingsForm.control}
                  name="clientPortalDigestRecipientClerkUserIds"
                  render={({ field }) => (
                    <FormItem className="grid gap-3">
                      {digestRecipientOptions.map((option) => {
                        const isChecked = selectedDigestRecipientIds.includes(
                          option.clerkUserId,
                        );
                        const isOwner = option.clerkUserId === projectOwnerClerkUserId;
                        const isResponsible =
                          option.clerkUserId ===
                          (settingsForm.watch("responsibleClerkUserId") ||
                            projectOwnerClerkUserId);

                        const descriptionParts = [
                          option.email,
                          isOwner ? "Project owner" : null,
                          isResponsible ? "Responsible person" : null,
                        ].filter(Boolean);

                        return (
                          <FormItem
                            key={option.clerkUserId}
                            className="flex flex-row items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3"
                          >
                            <FormControl>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const nextValue = Boolean(checked)
                                    ? Array.from(
                                        new Set([
                                          ...(field.value ?? []),
                                          option.clerkUserId,
                                        ]),
                                      )
                                    : (field.value ?? []).filter(
                                        (value) => value !== option.clerkUserId,
                                      );
                                  field.onChange(nextValue);
                                }}
                              />
                            </FormControl>
                            <div className="flex flex-col gap-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                {option.label}
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                {descriptionParts.join(" • ") || option.clerkUserId}
                              </p>
                            </div>
                          </FormItem>
                        );
                      })}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                          className="min-h-[110px] w-full resize-none"
                          rows={4}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
                <p className="text-xs text-muted-foreground">
                  Set the planned project window shown across calendars, reports, and operational views.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={settingsForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Start Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          className="h-10 w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={settingsForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">End Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          className="h-10 w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <CalendarRange className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Leave dates empty if the project is still open-ended. Once set, they feed project reporting and timeline views.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Cover Image</h3>
                <p className="text-xs text-muted-foreground">
                  Upload an image from your device. No manual URL needed.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
                <div className="overflow-hidden rounded-[28px] border border-border/70 bg-muted/30">
                  {hasCoverPreview ? (
                    <div className="relative">
                      <img
                        src={coverPreviewUrl ?? undefined}
                        alt="Project cover preview"
                        className="aspect-[16/10] w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-5 py-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/80">
                          Project Cover
                        </p>
                        <p className="mt-1 text-sm text-white">
                          This image appears in the workspace as the visual anchor for the project.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-card">
                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {coverPreviewStatus === "loading" ? "Loading preview..." : "No cover image yet"}
                        </p>
                        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                          {coverPreviewStatus === "error"
                            ? coverPreviewErrorMessage ||
                              "This image preview could not be loaded. Upload a different file or remove the current one."
                            : "Upload a landscape image to give the project a strong visual identity in lists and overview screens."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between rounded-[28px] border border-border/70 bg-card p-5">
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverImageUpload}
                  />

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Asset</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Use one clean visual instead of a dense collage. Wide crops work best across project surfaces.
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => coverFileInputRef.current?.click()}
                      disabled={uploadingCoverImage}
                      className="w-full justify-center rounded-full"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {uploadingCoverImage
                        ? "Uploading..."
                        : coverImageValue
                        ? "Replace image"
                        : "Upload image"}
                    </Button>

                    {coverImageValue ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCoverImageRemove}
                        disabled={uploadingCoverImage}
                        className="w-full justify-center rounded-full"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove image
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Large images are optimized automatically before upload.
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Uploading updates the draft immediately and the section saves automatically once the file is ready.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">Business Details</h3>
                <p className="text-xs text-muted-foreground">
                  Financial context and the combined address string used in project records.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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
                          className="h-10 w-full"
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
                    <FormItem className="md:col-span-2 xl:col-span-1">
                      <FormLabel className="text-sm font-medium">Address / Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Street, city, state, postcode"
                          {...field}
                          className="h-10 w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Stored as one combined address line so it matches the project record created in the new-project flow.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 xl:grid-cols-2">
                  <FormField
                    control={settingsForm.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem id="project-budget">
                        <FormLabel className="text-sm font-medium">Budget</FormLabel>
                        <FormControl>
                          <Input
                            id="project-budget-input"
                            type="number"
                            placeholder="Project budget"
                            {...field}
                            className="h-10 w-full"
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
                            <SelectTrigger className="h-10 w-full">
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
                </div>

                <FormField
                  control={settingsForm.control}
                  name="measurements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Measurements</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select measurement system" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="metric">Metric</SelectItem>
                          <SelectItem value="imperial">Imperial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

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
    <div className="flex flex-col gap-4 lg:gap-6">
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

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-destructive lg:text-xl">Danger Zone</CardTitle>
          <CardDescription className="text-sm">
            Permanent actions that remove data for the whole team.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="rounded-xl border border-destructive/20 bg-background/80 p-4">
            <h4 className="mb-2 text-sm font-medium text-destructive">Delete Project</h4>
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
                  <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="flex flex-col gap-4 lg:gap-6">
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
