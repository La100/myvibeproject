"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import type { ChatStatus, FileUIPart } from "ai";
import type { UIMessage } from "@convex-dev/agent/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThreadListItem } from "@/components/ai/assistant/ui/Sidebar";

import type {
  VisualizationComposerPayload,
  VisualizationDisplayMessage,
  VisualizationLightboxState,
  VisualizationMessage,
  VisualizationSession,
} from "./types";

type ReferenceUpload = {
  storageKey: string;
  mimeType: string;
  name: string;
};

const toThreadList = (sessions: VisualizationSession[] | undefined): ThreadListItem[] =>
  (sessions ?? []).map((session) => ({
    threadId: session._id,
    title: session.title || "New visualization",
    lastMessageAt: session.lastMessageAt,
    lastMessagePreview: "",
    messageCount: session.messageCount,
    imageCount: session.imageCount,
  }));

const toDisplayMessages = (messages: VisualizationMessage[] | undefined): VisualizationDisplayMessage[] =>
  (messages ?? []).map((message) => {
    const baseText =
      message.role === "model" &&
      (message.imageUrl || message.imageStorageKey || message.text.trim() === "Generated image.")
        ? ""
        : message.text;

    const mapped: UIMessage = {
      id: message._id,
      key: message._id,
      role: message.role === "model" ? "assistant" : "user",
      content: baseText,
      text: baseText,
      parts: baseText
        ? [
          {
            type: "text",
            text: baseText,
          },
        ]
        : [],
      order: message.messageIndex,
      stepOrder: message.messageIndex,
      status: "success",
      _creationTime: message._creationTime,
    } as UIMessage;

    return { raw: message, mapped };
  });

const buildQuotaBlockedMessage = (message?: string): UIMessage => {
  const text = [
    "### AI credits exhausted",
    message || "AI credits are exhausted.",
    "",
    "Upgrade your plan or manage billing to continue. You can still browse your previous visualizations in history.",
  ].join("\n");

  return {
    id: "quota-blocked-visualizations-message",
    key: "quota-blocked-visualizations-message",
    role: "assistant",
    content: text,
    text,
    parts: [
      {
        type: "text",
        text,
      },
    ],
    order: Number.MAX_SAFE_INTEGER,
    stepOrder: Number.MAX_SAFE_INTEGER,
    status: "success",
    _creationTime: Date.now(),
  } as UIMessage;
};

const convertPromptFiles = async (files: FileUIPart[]) => {
  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      if (!file.url) {
        throw new Error("Missing file URL");
      }

      const response = await fetch(file.url);
      const blob = await response.blob();
      const name = file.filename || `attachment-${index + 1}`;
      const type = file.mediaType || blob.type || "application/octet-stream";
      return new File([blob], name, { type });
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
};

const uploadReferenceImages = async ({
  files,
  teamId,
  getUploadUrl,
}: {
  files: File[];
  teamId: Id<"teams">;
  getUploadUrl: (args: {
    teamId: Id<"teams">;
    fileName: string;
    fileType: string;
  }) => Promise<{ url: string; key: string }>;
}): Promise<ReferenceUpload[]> => {
  const uploads = await Promise.allSettled(
    files.map(async (file) => {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error(`${file.name} is too large (max 20MB)`);
      }

      const { url, key } = await getUploadUrl({
        teamId,
        fileName: file.name,
        fileType: file.type,
      });

      const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!response.ok) {
        throw new Error(`Upload failed for ${file.name}`);
      }

      return {
        storageKey: key,
        mimeType: file.type,
        name: file.name,
      };
    })
  );

  const uploadedRefs: ReferenceUpload[] = [];

  for (const result of uploads) {
    if (result.status === "fulfilled") {
      uploadedRefs.push(result.value);
      continue;
    }

    toast.error(result.reason instanceof Error ? result.reason.message : "Failed to upload file");
  }

  return uploadedRefs;
};

export function useVisualizationController() {
  const { organization } = useOrganization();
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<Id<"aiVisualizationSessions"> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedLightbox, setSelectedLightbox] = useState<VisualizationLightboxState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, team?._id ? { teamId: team._id } : "skip");
  const sessions = useQuery(
    apiAny.ai.visualizationSessions.listSessions,
    team?._id ? { teamId: team._id } : "skip"
  ) as VisualizationSession[] | undefined;
  const currentSession = useQuery(
    apiAny.ai.visualizationSessions.getSession,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  ) as VisualizationSession | null | undefined;
  const sessionMessages = useQuery(
    apiAny.ai.visualizationSessions.getSessionMessages,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  ) as VisualizationMessage[] | undefined;

  const generateVisualization = useAction(apiAny.ai.imageGen.generation.generateVisualization);
  const getUploadUrl = useAction(apiAny.ai.imageGen.generation.getUploadUrl);
  const createSession = useMutation(apiAny.ai.visualizationSessions.createSession);
  const addUserMessage = useMutation(apiAny.ai.visualizationSessions.addUserMessage);

  const isGenerating = !!generatingSessionId;
  const threadList = useMemo(() => toThreadList(sessions), [sessions]);
  const displayMessages = useMemo(() => toDisplayMessages(sessionMessages), [sessionMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, isGenerating]);

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (aiAccess.remainingTokens === 0 || (aiAccess.message || "").toLowerCase().includes("exhaust"))
  );

  const quotaBlockedAssistantMessage = useMemo(
    () => (isQuotaBlocked ? buildQuotaBlockedMessage(aiAccess?.message) : null),
    [aiAccess?.message, isQuotaBlocked]
  );

  const handleNewChat = () => {
    startTransition(() => {
      setCurrentSessionId(null);
      setSelectedLightbox(null);
    });
  };

  const handleThreadSelect = (threadId: string) => {
    startTransition(() => {
      setCurrentSessionId(threadId as Id<"aiVisualizationSessions">);
      setSelectedLightbox(null);
    });
  };

  const runSendMessage = async ({ text, files }: VisualizationComposerPayload) => {
    if (isGenerating || isUploading || !team) return;
    if (isQuotaBlocked) {
      toast.error("AI credits exhausted. Upgrade your plan or manage billing to continue.");
      return;
    }

    const userPrompt = text.trim();
    if (!userPrompt) return;

    setGeneratingSessionId(currentSessionId || "new");

    try {
      let sessionId = currentSessionId;

      if (!sessionId) {
        sessionId = await createSession({
          teamId: team._id,
          initialPrompt: userPrompt,
        });
        setCurrentSessionId(sessionId);
      }

      setGeneratingSessionId(sessionId);

      const uploadFiles = await convertPromptFiles(files);
      if (uploadFiles.length > 0) {
        setIsUploading(true);
      }

      const uploadedRefs = await uploadReferenceImages({
        files: uploadFiles,
        teamId: team._id,
        getUploadUrl,
      });

      await addUserMessage({
        sessionId,
        text: userPrompt,
        referenceImages: uploadedRefs.length > 0 ? uploadedRefs : undefined,
      });

      const history = (sessionMessages ?? []).map((message) => ({
        role: message.role as "user" | "model",
        text: message.text,
        imageStorageKey: message.imageStorageKey,
        imageMimeType: message.imageMimeType,
      }));

      const result = await generateVisualization({
        prompt: userPrompt,
        referenceImages: uploadedRefs.length > 0 ? uploadedRefs : undefined,
        teamId: team._id,
        sessionId,
        history: history.length > 0 ? history : undefined,
      });

      if (result.success) {
        toast.success("Visualization generated!");
      } else {
        toast.error(result.error || "Generation failed");
      }
    } catch (error) {
      toast.error("Generation failed");
      console.error(error);
    } finally {
      setGeneratingSessionId(null);
      setIsUploading(false);
    }
  };

  const handleSendMessage = (payload: VisualizationComposerPayload) => {
    void runSendMessage(payload);
  };

  const handleStopResponse = () => {
    // Gemini generation is still single-flight; stop support can be added once the action supports cancellation.
  };

  const handleDownload = async (imageUrl: string) => {
    if (!imageUrl) return;

    try {
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download = `visualization-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success("Downloaded");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed");
    }
  };

  const submitStatus = (isGenerating ? "streaming" : "ready") as ChatStatus;
  const showEmptyState = !currentSessionId && !isGenerating;
  const isLoadingAccess = aiAccess === undefined && !!team?._id;
  const isThreadListLoading = sessions === undefined && !!team?._id;
  const showSubscriptionWall = !!(
    aiAccess !== undefined &&
    !aiAccess.hasAccess &&
    team?._id &&
    !isQuotaBlocked
  );

  return {
    aiAccess,
    currentSession,
    currentSessionId,
    displayMessages,
    generatingSessionId,
    handleDownload,
    handleNewChat,
    handleSendMessage,
    handleStopResponse,
    handleThreadSelect,
    isGenerating,
    isLoadingAccess,
    isQuotaBlocked,
    isThreadListLoading,
    isUploading,
    messagesEndRef,
    quotaBlockedAssistantMessage,
    selectedLightbox,
    sessionCount: sessions?.length ?? 0,
    setSelectedLightbox,
    setShowHistory,
    showEmptyState,
    showHistory,
    showSubscriptionWall,
    submitStatus,
    team,
    threadList,
  };
}
