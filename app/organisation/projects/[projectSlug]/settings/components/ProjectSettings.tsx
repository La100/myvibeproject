"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
import {
  AlertCircle,
  Archive,
  Check,
  Copy,
  ImagePlus,
  RotateCcw,
  Save,
  Settings,
  X,
} from "lucide-react";

import { apiAny } from "@/lib/convexApiAny";
import { optimizeCoverImageForUpload } from "@/lib/coverImageUpload";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateInput, parseDateInput } from "@/lib/dateInput";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import ProjectMembers from "./ProjectMembers";
import TaskStatusSettings from "./TaskStatusSettings";
import { useI18n } from "@/lib/i18n";

const settingsFormSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    coverImageUrl: z.string().optional().or(z.literal("")),
    responsibleClerkUserId: z.string().optional(),
    clientPortalDigestRecipientClerkUserIds: z.array(z.string()).optional(),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    customer: z.string().optional(),
    customerEmail: z
      .union([
        z.string().trim().email("Enter a valid email address"),
        z.literal(""),
      ])
      .optional(),
    budget: z.coerce
      .number()
      .positive("Budget must be positive")
      .optional()
      .or(z.literal("")),
    location: z.string().optional(),
    status: z
      .enum([
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "archived",
      ])
      .optional(),
    measurements: z.enum(["metric", "imperial"]).optional(),
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
  })
  .refine(
    (values) => {
      if (!values.startDate || !values.endDate) {
        return true;
      }
      return (
        new Date(values.endDate).getTime() >=
        new Date(values.startDate).getTime()
      );
    },
    {
      message: "End date cannot be earlier than start date",
      path: ["endDate"],
    },
  );

const deleteFormSchema = z.object({
  confirmName: z
    .string()
    .min(1, "Please enter the project name to confirm deletion"),
});

type SettingsTabValue = "general" | "members" | "taskstatus" | "advanced";

interface SettingsTabConfig {
  value: SettingsTabValue;
  labelKey: "general" | "members" | "taskStatus" | "delete";
  descriptionKey:
    | "generalDescription"
    | "membersDescription"
    | "taskStatusDescription"
    | "advancedDeleteDescription";
}

const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    value: "general",
    labelKey: "general",
    descriptionKey: "generalDescription",
  },
  {
    value: "members",
    labelKey: "members",
    descriptionKey: "membersDescription",
  },
  {
    value: "taskstatus",
    labelKey: "taskStatus",
    descriptionKey: "taskStatusDescription",
  },
  {
    value: "advanced",
    labelKey: "delete",
    descriptionKey: "advancedDeleteDescription",
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
      member.isActive && (member.role === "admin" || member.role === "member"),
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

function ProjectSettingsLoading() {
  return <Spinner className="pb-8" />;
}

function SettingsTabLoading() {
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
  const { project } = useProject();
  const { t } = useI18n();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabValue>("general");

  const teamMember = useQuery(
    apiAny.teams.getCurrentUserTeamMember,
    project ? { teamId: project.teamId } : "skip",
  );
  const teamMembers = useQuery(
    apiAny.teams.getTeamMembers,
    project ? { teamId: project.teamId } : "skip",
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
            ((project as { responsibleClerkUserId?: string })
              .responsibleClerkUserId ||
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
          customerEmail: project.customerEmail || "",
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
          customerEmail: "",
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
          (member.role === "admin" || member.role === "member"),
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
      (option) => option.clerkUserId === currentValue,
    );
    if (isCurrentValid) {
      return;
    }

    const creatorOption = responsibleOptions.find(
      (option) => option.clerkUserId === project.createdBy,
    );
    settingsForm.setValue(
      "responsibleClerkUserId",
      creatorOption?.clerkUserId || responsibleOptions[0].clerkUserId,
      { shouldDirty: false, shouldTouch: false },
    );
  }, [project, responsibleOptions, settingsForm]);

  const deleteForm = useForm<z.infer<typeof deleteFormSchema>>({
    resolver: zodResolver(deleteFormSchema),
    defaultValues: { confirmName: "" },
  });

  const onSettingsSubmit = useCallback(
    async (
      values: z.infer<typeof settingsFormSchema>,
      options?: { silent?: boolean },
    ) => {
      if (!project) {
        return false;
      }

      const normalizedBudget =
        values.budget === "" || values.budget === undefined
          ? undefined
          : Number(values.budget);
      const normalizedCoverUrl = normalizeCoverImageUrl(values.coverImageUrl);
      const normalizedStartDate = values.startDate
        ? new Date(values.startDate).getTime()
        : undefined;
      const normalizedEndDate = values.endDate
        ? new Date(values.endDate).getTime()
        : undefined;

      try {
        const validResponsibleIds = new Set(
          responsibleOptions.map((option) => option.clerkUserId),
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
          coverImageUrl:
            normalizedCoverUrl ?? values.coverImageUrl?.trim() ?? "",
          customer: values.customer || undefined,
          customerEmail: values.customerEmail || undefined,
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
        if (!options?.silent) {
          toast.success(t("projectSettings", "projectSettingsSaved"));
        }
        return true;
      } catch (error) {
        if (!options?.silent) {
          toast.error(t("projectSettings", "errorUpdatingProjectSettings"), {
            description: toUserFacingErrorMessage(error),
          });
        }
        return false;
      }
    },
    [params.projectSlug, project, responsibleOptions, router, t, updateProject],
  );

  if (!project || !teamMember || teamMembers === undefined) {
    return null;
  }

  const canEdit = teamMember.role === "admin" || teamMember.role === "member";

  if (!canEdit) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold text-destructive">
          {t("projectSettings", "readOnly")}
        </h1>
        <p className="text-muted-foreground">
          {t("projectSettings", "readOnlyDescription")}
        </p>
      </div>
    );
  }

  const activeTabConfig =
    SETTINGS_TABS.find((tab) => tab.value === activeTab) ?? SETTINGS_TABS[0];

  async function onDeleteSubmit(values: z.infer<typeof deleteFormSchema>) {
    if (values.confirmName !== project.name) {
      deleteForm.setError("confirmName", {
        message:
          t("projectSettings", "projectNameDoesntMatch"),
      });
      return;
    }

    try {
      await deleteProject({ projectId: project._id });
      toast.success(t("projectSettings", "projectDeletedSuccessfully"));
      setDeleteDialogOpen(false);
      router.push("/organisation");
    } catch (error) {
      toast.error(t("projectSettings", "errorDeletingProject"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  }

  async function handleArchiveToggle() {
    if (!project) {
      return;
    }

    const nextStatus = project.status === "archived" ? "active" : "archived";

    try {
      await updateProject({
        projectId: project._id,
        status: nextStatus,
      });
      toast.success(
        nextStatus === "archived"
          ? t("projectSettings", "projectArchivedSuccessfully")
          : t("projectSettings", "projectRestoredSuccessfully"),
      );
      if (nextStatus === "archived") {
        router.push("/organisation");
      }
    } catch (error) {
      toast.error(t("projectSettings", "errorUpdatingProjectSettings"), {
        description: toUserFacingErrorMessage(error),
      });
    }
  }

  return (
    <ProjectPageLayout>
      <div className="min-h-screen pb-20">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 py-4">
          <ProjectPageHeader
            title={t("projectSettings", "settings")}
            icon={<Settings className="h-8 w-8 text-primary" />}
            subtitle={project.name}
          />

          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
            <aside className="self-start lg:sticky lg:top-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <p className="px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t("projectSettings", "project")}
                  </p>
                  <nav className="flex flex-col gap-1">
                    {SETTINGS_TABS.map((tab) => {
                      const isActive = activeTab === tab.value;

                      return (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setActiveTab(tab.value)}
                          className={cn(
                            "rounded-2xl px-4 py-3 text-left text-[1rem] transition-colors",
                            isActive
                              ? "bg-secondary text-foreground"
                              : "text-foreground/80 hover:bg-secondary/70 hover:text-foreground",
                          )}
                        >
                          {t("projectSettings", tab.labelKey)}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </aside>

            <div className="grid gap-8">
              <section className="grid gap-8">
                <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
                  <h2 className="text-[1.2rem] font-semibold tracking-tight text-foreground md:text-[1.3rem]">
                    {t("projectSettings", activeTabConfig.labelKey)}
                  </h2>
                </div>

                {activeTab === "general" ? (
                  <GeneralTab
                    projectId={project._id}
                    projectCoverImageUrl={project.coverImageUrl}
                    projectCoverImageDisplayUrl={
                      (project as { coverImageDisplayUrl?: string })
                        .coverImageDisplayUrl
                    }
                    responsibleOptions={responsibleOptions}
                    settingsForm={settingsForm}
                    onSettingsSubmit={onSettingsSubmit}
                  />
                ) : null}

                {activeTab === "members" ? (
                  <Suspense fallback={<SettingsTabLoading />}>
                    <MembersTab project={project} />
                  </Suspense>
                ) : null}

                {activeTab === "taskstatus" ? (
                  <Suspense fallback={<SettingsTabLoading />}>
                    <TaskStatusTab project={project} />
                  </Suspense>
                ) : null}

                {activeTab === "advanced" ? (
                  <AdvancedTab
                    project={project}
                    deleteForm={deleteForm}
                    deleteDialogOpen={deleteDialogOpen}
                    setDeleteDialogOpen={setDeleteDialogOpen}
                    onDeleteSubmit={onDeleteSubmit}
                    onArchiveToggle={handleArchiveToggle}
                  />
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProjectPageLayout>
  );
}

export default function ProjectSettings() {
  return (
    <Suspense fallback={<ProjectSettingsLoading />}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

function GeneralTab({
  projectId,
  projectCoverImageUrl,
  projectCoverImageDisplayUrl,
  responsibleOptions,
  settingsForm,
  onSettingsSubmit,
}: {
  projectId: Id<"projects">;
  projectCoverImageUrl?: string;
  projectCoverImageDisplayUrl?: string;
  responsibleOptions: Array<{
    clerkUserId: string;
    label: string;
    email: string;
  }>;
  settingsForm: UseFormReturn<z.infer<typeof settingsFormSchema>>;
  onSettingsSubmit: (
    values: z.infer<typeof settingsFormSchema>,
    options?: { silent?: boolean },
  ) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const generateUploadUrl = useMutation(
    apiAny.files.generateUploadUrlWithCustomKey,
  );
  const addFile = useMutation(apiAny.files.addFile);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [coverPreviewStatus, setCoverPreviewStatus] = useState<
    "empty" | "loading" | "ready" | "error"
  >("empty");
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const localCoverPreviewUrlRef = useRef<string | null>(null);
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = useState<
    string | null
  >(null);
  const [uploadedCoverPreviewUrl, setUploadedCoverPreviewUrl] = useState<
    string | null
  >(null);
  const [coverPreviewCandidateIndex, setCoverPreviewCandidateIndex] =
    useState(0);
  const [coverPreviewErrorMessage, setCoverPreviewErrorMessage] = useState<
    string | null
  >(null);
  const [showSavedState, setShowSavedState] = useState(false);
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

    return candidates.filter(
      (value, index) => candidates.indexOf(value) === index,
    );
  }, [localCoverPreviewUrl, persistedCoverPreviewUrl, uploadedCoverPreviewUrl]);
  const coverPreviewUrl =
    coverPreviewCandidates[coverPreviewCandidateIndex] ?? null;
  const hasCoverPreview = coverPreviewStatus === "ready";
  const hasUnsavedChanges = settingsForm.formState.isDirty;
  const isSavingSettings = settingsForm.formState.isSubmitting;
  const isSaveDisabled =
    isSavingSettings || uploadingCoverImage || !hasUnsavedChanges;
  const savedStateTimeoutRef = useRef<number | null>(null);

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
      if (savedStateTimeoutRef.current) {
        clearTimeout(savedStateTimeoutRef.current);
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
  }, [
    coverPreviewCandidateIndex,
    coverPreviewCandidates.length,
    coverPreviewUrl,
  ]);

  const handleCoverImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("projectSettings", "pleaseSelectImageFile"));
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
        t("projectSettings", "thisHeicMayUpload"),
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
        const savedKb = Math.max(
          1,
          Math.round((optimized.originalSize - uploadFile.size) / 1024),
        );
        toast.success(t("projectSettings", "coverImageUploadedAndOptimized"), {
          description: `${t("projectSettings", "reducedByAbout")} ${savedKb} KB. ${t("projectSettings", "clickSaveToKeepChanges")}`,
        });
      } else {
        toast.success(t("projectSettings", "coverImageUploaded"));
      }
    } catch (error) {
      toast.error(t("projectSettings", "failedToUploadCoverImage"), {
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

  const handleManualSave = settingsForm.handleSubmit(async (values) => {
    const didSave = await onSettingsSubmit(values);
    if (!didSave) {
      return;
    }

    settingsForm.reset(values);
    setShowSavedState(true);

    if (savedStateTimeoutRef.current) {
      clearTimeout(savedStateTimeoutRef.current);
    }

    savedStateTimeoutRef.current = window.setTimeout(() => {
      setShowSavedState(false);
    }, 2500);
  });

  return (
    <div className="flex flex-col gap-8">
      <Form {...settingsForm}>
        <form
          id="project-settings-form"
          onSubmit={handleManualSave}
          className={cn(
            "flex flex-col gap-8",
            hasUnsavedChanges && "pb-24 sm:pb-20",
          )}
        >
          {hasUnsavedChanges ? (
            <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:inset-x-6 sm:bottom-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                  <AlertCircle className="size-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {t("projectSettings", "unsavedProjectSettings")}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("projectSettings", "clickSaveToKeepChanges")}
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                form="project-settings-form"
                disabled={isSaveDisabled}
                className="w-full sm:w-auto sm:min-w-[140px]"
              >
                <Save data-icon="inline-start" />
                {isSavingSettings ? t("projectSettings", "saving") : t("projectSettings", "saveChanges")}
              </Button>
            </div>
          ) : null}

          <section className="flex flex-col gap-4">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t("projectSettings", "identity")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("projectSettings", "identityDescription")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={settingsForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "projectName")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("projectSettings", "projectName")}
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
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "projectStatus")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder={t("projectSettings", "selectProjectStatus")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">{t("projectSettings", "planning")}</SelectItem>
                        <SelectItem value="active">{t("projectSettings", "active")}</SelectItem>
                        <SelectItem value="on_hold">{t("projectSettings", "onHold")}</SelectItem>
                        <SelectItem value="completed">{t("projectSettings", "completed")}</SelectItem>
                        <SelectItem value="cancelled">{t("projectWorkspace", "cancelled")}</SelectItem>
                        <SelectItem value="archived">{t("projectSettings", "archived")}</SelectItem>
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
                    {t("projectSettings", "responsiblePerson")}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={responsibleOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder={t("projectSettings", "selectTeamMemberResponsible")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {responsibleOptions.map((option) => (
                        <SelectItem
                          key={option.clerkUserId}
                          value={option.clerkUserId}
                        >
                          {option.label}
                          {option.email ? ` (${option.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("projectSettings", "responsiblePersonDescription")}
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
                  <FormLabel className="text-sm font-medium">
                    {t("projectSettings", "description")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("projectSettings", "whatIsThisProjectAbout")}
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

          <section className="border-t border-border/70 pt-8">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t("projectSettings", "businessDetails")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("projectSettings", "businessDetailsDescription")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField
                control={settingsForm.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "client")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("projectSettings", "client")}
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
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "customerEmail")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("projectSettings", "customerEmailPlaceholder")}
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "location")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("projectSettings", "locationPlaceholder")}
                        {...field}
                        className="h-10 w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:col-span-2 xl:col-span-3 xl:grid-cols-3">
                <FormField
                  control={settingsForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem id="project-budget">
                      <FormLabel className="text-sm font-medium">
                        {t("projectSettings", "budget")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="project-budget-input"
                          type="number"
                          placeholder={t("projectSettings", "projectBudget")}
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
                      <FormLabel className="text-sm font-medium">
                        {t("projectSettings", "currency")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={t("projectSettings", "selectProjectCurrency")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((currency) => (
                            <SelectItem
                              key={currency.value}
                              value={currency.value}
                            >
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
                  name="measurements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("projectSettings", "measurements")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={t("projectSettings", "selectMeasurementSystem")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="metric">{t("projectSettings", "metric")}</SelectItem>
                          <SelectItem value="imperial">{t("projectSettings", "imperial")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section className="border-t border-border/70 pt-8">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t("projectSettings", "timeline")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("projectSettings", "timelineDescription")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={settingsForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "startDate")}
                    </FormLabel>
                    <FormControl>
                      <DatePicker
                        date={parseDateInput(field.value)}
                        onDateChange={(date) =>
                          field.onChange(formatDateInput(date))
                        }
                        placeholder={t("projectSettings", "selectStartDate")}
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
                    <FormLabel className="text-sm font-medium">
                      {t("projectSettings", "endDate")}
                    </FormLabel>
                    <FormControl>
                      <DatePicker
                        date={parseDateInput(field.value)}
                        onDateChange={(date) =>
                          field.onChange(formatDateInput(date))
                        }
                        placeholder={t("projectSettings", "selectEndDate")}
                        className="h-10 w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-4 rounded-2xl bg-secondary/70 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("projectSettings", "leaveDatesEmpty")}
              </p>
            </div>
          </section>

          <section className="border-t border-border/70 pt-8">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t("projectSettings", "coverImage")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("projectSettings", "optionalImageShown")}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="max-w-4xl overflow-hidden rounded-3xl border border-border/70 bg-secondary/70">
                {hasCoverPreview ? (
                  <div className="relative">
                    <img
                      src={coverPreviewUrl ?? undefined}
                      alt={t("projectSettings", "projectCoverPreview")}
                      className="h-48 w-full object-cover sm:h-56 lg:h-64"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-5 py-4">
                      <p className="text-sm font-medium text-white">
                        {t("projectSettings", "projectCover")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => coverFileInputRef.current?.click()}
                          disabled={uploadingCoverImage}
                          className="rounded-full"
                        >
                          <ImagePlus className="mr-2 h-4 w-4" />
                          {uploadingCoverImage ? t("projectSettings", "uploading") : t("projectSettings", "replace")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleCoverImageRemove}
                          disabled={uploadingCoverImage}
                          className="rounded-full"
                        >
                          <X className="mr-2 h-4 w-4" />
                          {t("projectSettings", "remove")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:min-h-[260px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-card">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {coverPreviewStatus === "loading"
                          ? t("projectSettings", "loadingPreview")
                          : t("projectSettings", "noCoverImageYet")}
                      </p>
                      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                        {coverPreviewStatus === "error"
                          ? coverPreviewErrorMessage ||
                            t("projectSettings", "uploadADifferentFile")
                          : t("projectSettings", "uploadSimpleWideImage")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => coverFileInputRef.current?.click()}
                      disabled={uploadingCoverImage}
                      className="rounded-full"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {uploadingCoverImage ? t("projectSettings", "uploading") : t("projectSettings", "uploadImage")}
                    </Button>
                  </div>
                )}
              </div>

              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverImageUpload}
              />

              {coverPreviewErrorMessage ? (
                <p className="text-sm text-muted-foreground">
                  {coverPreviewErrorMessage}
                </p>
              ) : null}
            </div>
          </section>

          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("projectSettings", "projectSettingsSavedOnly")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {showSavedState ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" />
                  {t("projectSettings", "saved")}
                </span>
              ) : null}
              <Button
                type="submit"
                disabled={isSaveDisabled}
                className="min-w-[120px]"
              >
                {isSavingSettings ? t("projectSettings", "saving") : t("projectSettings", "save")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

function MembersTab({
  project,
}: {
  project: { _id: Id<"projects">; teamId: Id<"teams">; name: string };
}) {
  return <ProjectMembers project={project} />;
}

function TaskStatusTab({
  project,
}: {
  project: { _id: string; taskStatusSettings?: unknown };
}) {
  const { t } = useI18n();

  return (
    <div>
      {project && project.taskStatusSettings ? (
        <TaskStatusSettings
          projectId={project._id as Id<"projects">}
          initialSettings={
            project.taskStatusSettings as {
              todo: { name: string; color: string };
              in_progress: { name: string; color: string };
              review: { name: string; color: string };
              done: { name: string; color: string };
            }
          }
        />
      ) : (
        <div className="border-b border-border/70 pb-5">
          <h3 className="text-lg font-semibold text-foreground">
            {t("projectSettings", "taskStatusSettings")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("projectSettings", "configureCustomTaskStatuses")}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {t("projectSettings", "taskStatusSettingsAvailable")}
          </p>
        </div>
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
  onArchiveToggle,
}: {
  project: { name: string; status?: string };
  deleteForm: UseFormReturn<z.infer<typeof deleteFormSchema>>;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  onDeleteSubmit: (values: z.infer<typeof deleteFormSchema>) => void;
  onArchiveToggle: () => void;
}) {
  const { t } = useI18n();
  const isArchived = project.status === "archived";
  const copyProjectName = async () => {
    try {
      await navigator.clipboard.writeText(project.name);
      toast.success(t("projectSettings", "projectNameCopied"));
    } catch {
      toast.error(t("projectSettings", "couldNotCopyProjectName"));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t("projectSettings", "archive")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("projectSettings", "archiveDescription")}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
        <h4 className="mb-2 text-sm font-medium text-foreground">
          {isArchived
            ? t("projectSettings", "restoreProject")
            : t("projectSettings", "archiveProject")}
        </h4>
        <p className="mb-4 text-sm text-muted-foreground">
          {isArchived
            ? t("projectSettings", "restoreProjectDescription")
            : t("projectSettings", "archiveProjectDescription")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onArchiveToggle}
        >
          {isArchived ? (
            <RotateCcw className="mr-2 h-4 w-4" />
          ) : (
            <Archive className="mr-2 h-4 w-4" />
          )}
          {isArchived
            ? t("projectSettings", "restoreProject")
            : t("projectSettings", "archiveProject")}
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-destructive">{t("projectSettings", "delete")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("projectSettings", "deletingRemoves")}
        </p>
      </div>

      <div className="rounded-2xl bg-destructive/5 p-4">
        <h4 className="mb-2 text-sm font-medium text-destructive">
          {t("projectSettings", "deleteProject")}
        </h4>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("projectSettings", "thisPermanentlyRemoves")}
        </p>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              {t("projectSettings", "deleteProject")}
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-lg">{t("projectSettings", "deleteProject")}</DialogTitle>
              <DialogDescription className="text-sm">
                {t("projectSettings", "thisActionCannotBeUndone")}
              </DialogDescription>
            </DialogHeader>
            <Form {...deleteForm}>
              <form
                onSubmit={deleteForm.handleSubmit(onDeleteSubmit)}
                className="flex flex-col gap-4 lg:gap-6"
              >
                <FormField
                  control={deleteForm.control}
                  name="confirmName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">
                        {t("projectSettings", "type")}{" "}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono font-semibold">
                            {project.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={(event) => {
                              event.preventDefault();
                              void copyProjectName();
                            }}
                            aria-label={t("projectSettings", "copyProjectName")}
                            title={t("projectSettings", "copyProjectName")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </span>{" "}
                        {t("projectSettings", "toConfirm")}
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
                    {t("projectSettings", "cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deleteForm.formState.isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    {deleteForm.formState.isSubmitting
                      ? t("projectSettings", "deleting")
                      : t("projectSettings", "deleteProject")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
