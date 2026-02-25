"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useAction, useMutation } from "convex/react";
import type { ChatStatus, FileUIPart } from "ai";
import type { UIMessage } from "@convex-dev/agent/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  X,
  Download,
  History,
} from "lucide-react";
import { AISubscriptionWall } from "@/components/ai/shared";
import { AIQuotaUpsellCard } from "@/components/ai/shared";
import { Badge } from "@/components/ui/badge";

import { ChatSidebar, ThreadListItem } from "@/components/ai/assistant/ui/Sidebar";
import { Composer } from "@/components/ai/assistant/ui/Composer";
import { Message as AssistantMessage, ThinkingMessage } from "@/components/ai/assistant/ui/messages";
import { PromptInputProvider, usePromptInputController } from "@/components/ai/primitives/prompt-input";

type VisualizationMessage = {
  _id: Id<"aiVisualizationMessages">;
  _creationTime: number;
  role: "user" | "model";
  text: string;
  messageIndex: number;
  imageStorageKey?: string;
  imageMimeType?: string;
  imageUrl?: string;
  referenceImages?: Array<{
    storageKey: string;
    mimeType: string;
    name: string;
  }>;
};

type Suggestion = {
  text: string;
  image: string;
};

function VisualizationSuggestions({ suggestions }: { suggestions: Suggestion[] }) {
  const { textInput } = usePromptInputController();

  return (
    <div className="mt-16 w-full flex flex-col items-center max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-5 pb-4 -mx-6 px-6 max-w-5xl mx-auto no-scrollbar w-full"
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.text}
            onClick={() => textInput.setInput(suggestion.text)}
            className={cn(
              "group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 aspect-[5/3] flex-shrink-0 border border-[color:var(--overlay-border)] shadow-lg",
              "min-w-[70vw] sm:min-w-[300px] md:min-w-[280px] lg:min-w-[260px] snap-center",
              "hover:shadow-2xl hover:-translate-y-1.5 hover:border-[color:var(--overlay-border-strong)]"
            )}
          >
            <div className="absolute inset-0 z-0">
              <img
                src={suggestion.image}
                alt=""
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>

            <div className="relative z-10 h-full flex flex-col justify-end p-5">
              <p className="text-[var(--overlay-foreground)] font-semibold leading-snug text-sm drop-shadow-sm">
                {suggestion.text}
              </p>
            </div>
          </button>
        ))}
      </motion.div>
    </div>
  );
}

export default function VisualizationsPage() {
  const { organization } = useOrganization();
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const isGenerating = !!generatingSessionId;
  const [isUploading, setIsUploading] = useState(false);

  // Session state
  const [currentSessionId, setCurrentSessionId] = useState<Id<"aiVisualizationSessions"> | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Lightbox state
  const [selectedLightbox, setSelectedLightbox] = useState<{
    url: string;
    prompt: string;
  } | null>(null);

  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, team?._id ? { teamId: team._id } : "skip");

  // Session queries
  const sessions = useQuery(
    apiAny.ai.visualizationSessions.listSessions,
    team?._id ? { teamId: team._id } : "skip"
  );

  const currentSession = useQuery(
    apiAny.ai.visualizationSessions.getSession,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  );

  const sessionMessages = useQuery(
    apiAny.ai.visualizationSessions.getSessionMessages,
    currentSessionId ? { sessionId: currentSessionId } : "skip"
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Actions and mutations
  const generateVisualization = useAction(apiAny.ai.imageGen.generation.generateVisualization);
  const getUploadUrl = useAction(apiAny.ai.imageGen.generation.getUploadUrl);
  const createSession = useMutation(apiAny.ai.visualizationSessions.createSession);
  const addUserMessage = useMutation(apiAny.ai.visualizationSessions.addUserMessage);

  // Map sessions to ThreadListItem format for ChatSidebar
  const threadList: ThreadListItem[] = useMemo(() => {
    if (!sessions) return [];
    return sessions.map((session) => ({
      threadId: session._id,
      title: session.title || "New visualization",
      lastMessageAt: session.lastMessageAt,
      lastMessagePreview: `${session.imageCount} image${session.imageCount !== 1 ? "s" : ""}`,
      messageCount: session.messageCount,
    }));
  }, [sessions]);

  const normalizedMessages = useMemo(
    () => ((sessionMessages ?? []) as VisualizationMessage[]),
    [sessionMessages]
  );

  const displayMessages = useMemo(() => {
    return normalizedMessages.map((msg) => {
      const baseText = msg.role === "model" && msg.text.trim() === "Generated image." ? "" : msg.text;

      const mapped: UIMessage = {
        id: msg._id,
        key: msg._id,
        role: msg.role === "model" ? "assistant" : "user",
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
        order: msg.messageIndex,
        stepOrder: msg.messageIndex,
        status: "success",
        _creationTime: msg._creationTime,
      } as UIMessage;

      return { raw: msg, mapped };
    });
  }, [normalizedMessages]);

  const convertPromptFiles = async (files: FileUIPart[]) => {
    const uploadFiles: File[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.url) continue;

      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const name = file.filename || `attachment-${index + 1}`;
        const type = file.mediaType || blob.type || "application/octet-stream";
        const converted = new File([blob], name, { type });
        uploadFiles.push(converted);
      } catch {
        continue;
      }
    }

    return uploadFiles;
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages.length, isGenerating]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
  };

  const handleThreadSelect = (threadId: string) => {
    setCurrentSessionId(threadId as Id<"aiVisualizationSessions">);
  };

  const handleSendMessage = async (payload: { text: string; files: FileUIPart[] }) => {
    if (isGenerating || isUploading || !team) return;
    if (isQuotaBlocked) {
      toast.error("AI credits exhausted. Upgrade your plan or manage billing to continue.");
      return;
    }

    const userPrompt = payload.text.trim();
    if (!userPrompt) return;

    // Track generation for current session (or "new" if creating one)
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

      // Update generating session ID to the real one
      setGeneratingSessionId(sessionId);

      // Upload reference images if any
      const uploadFiles = await convertPromptFiles(payload.files);
      const uploadedRefs: Array<{ storageKey: string; mimeType: string; name: string; base64?: string }> = [];

      if (uploadFiles.length > 0) {
        setIsUploading(true);
      }

      for (const file of uploadFiles) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 20MB)`);
          continue;
        }

        try {
          const { url, key } = await getUploadUrl({
            teamId: team._id,
            fileName: file.name,
            fileType: file.type,
          });

          await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          uploadedRefs.push({
            storageKey: key,
            mimeType: file.type,
            name: file.name,
          });
        } catch (err) {
          console.error("Failed to upload file:", err);
        }
      }

      // Add user message to session
      await addUserMessage({
        sessionId,
        text: userPrompt,
        referenceImages: uploadedRefs.length > 0 ? uploadedRefs : undefined,
      });

      // Build history from session messages
      const history = normalizedMessages.map((msg) => ({
        role: msg.role as "user" | "model",
        text: msg.text,
        imageStorageKey: msg.imageStorageKey,
        imageMimeType: msg.imageMimeType,
      }));

      // Generate visualization
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

  const handleStopResponse = () => {
    // For now, we can't stop Gemini generation mid-flight
    // This is a placeholder for future implementation
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

  const suggestions: Suggestion[] = [
    {
      text: "Minimalist Scandinavian living room with natural oak floors",
      image: "/samplevisuals/sample1.jpeg",
    },
    {
      text: "Japanese zen garden with stone pathway and bamboo",
      image: "https://images.unsplash.com/photo-1585938389612-a552a28d6914?q=80&w=800&auto=format&fit=crop",
    },
    {
      text: "Industrial loft conversion with exposed steel beams",
      image: "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=800&auto=format&fit=crop",
    },
    {
      text: "Mediterranean terrace with olive trees at sunset",
      image: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?q=80&w=800&auto=format&fit=crop",
    },
  ];

  const submitStatus = (isGenerating ? "streaming" : "ready") as ChatStatus;

  // Check access
  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (aiAccess.remainingTokens === 0 || (aiAccess.message || "").toLowerCase().includes("exhaust"))
  );

  const quotaBlockedAssistantMessage = useMemo(() => {
    if (!isQuotaBlocked) return null;

    const text = [
      "### AI credits exhausted",
      aiAccess?.message || "AI credits are exhausted.",
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
  }, [aiAccess?.message, isQuotaBlocked]);

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (!isQuotaBlocked) {
      return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
    }
  }

  if (aiAccess === undefined && team?._id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showEmptyState = !currentSessionId && !isGenerating;

  return (
    <PromptInputProvider>
      <>
        <div className="flex h-[calc(100vh-4rem)] text-foreground overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                {currentSession && (
                  <>
                    <h2 className="font-medium truncate max-w-[300px]">
                      {currentSession.title || "New visualization"}
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {currentSession.imageCount} image{currentSession.imageCount !== 1 ? "s" : ""}
                    </Badge>
                  </>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className="h-8 w-8"
                title="Toggle history"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-6">
              {showEmptyState ? (
                isQuotaBlocked && quotaBlockedAssistantMessage ? (
                  <div className="max-w-4xl mx-auto py-8 space-y-6">
                    <AssistantMessage
                      message={quotaBlockedAssistantMessage}
                      isLoading={false}
                    />
                    <div className="mx-auto w-full max-w-[44rem]">
                      <Composer
                        submitStatus={submitStatus}
                        onSubmit={handleSendMessage}
                        onStopResponse={handleStopResponse}
                        placeholder="Describe your visualization..."
                        accept="image/*"
                        maxFiles={10}
                        maxFileSize={20 * 1024 * 1024}
                        isUploading={isUploading}
                        disabled={isGenerating}
                      />
                    </div>
                    {team?._id && (
                      <div className="mx-auto w-full max-w-[44rem]">
                        <AIQuotaUpsellCard
                          teamId={team._id}
                          currentPlan={aiAccess?.currentPlan}
                          subscriptionStatus={aiAccess?.subscriptionStatus ?? null}
                          message={aiAccess?.message}
                          remainingTokens={aiAccess?.remainingTokens ?? 0}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-full w-full max-w-2xl mx-auto px-4 py-12 animate-in fade-in zoom-in-95 duration-500">
                    <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-3 text-center text-foreground font-display">
                      Visualizations
                    </h1>

                    <p className="text-muted-foreground text-center mb-12 text-lg">
                      Describe your <span className="italic font-serif text-foreground">vision</span>. AI
                      brings it to{" "}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-semibold">
                        life
                      </span>
                      .
                    </p>

                    <Composer
                      submitStatus={submitStatus}
                      onSubmit={handleSendMessage}
                      onStopResponse={handleStopResponse}
                      placeholder="Describe your visualization..."
                      accept="image/*"
                      maxFiles={10}
                      maxFileSize={20 * 1024 * 1024}
                      isUploading={isUploading}
                      disabled={isGenerating}
                    />

                    <VisualizationSuggestions suggestions={suggestions} />
                  </div>
                )
              ) : (
                <div className="max-w-4xl mx-auto py-6 space-y-6">
                  {displayMessages.map(({ raw, mapped }) => (
                    <AssistantMessage
                      key={raw._id}
                      message={mapped}
                      isLoading={false}
                      localAttachments={
                        raw.role === "user"
                          ? raw.referenceImages?.map((image) => ({
                            name: image.name,
                            size: 0,
                            type: image.mimeType,
                          }))
                          : undefined
                      }
                      mediaImageUrl={raw.role === "model" ? raw.imageUrl : undefined}
                      hideGeneratedPlaceholderText
                      onImageClick={(payload) => setSelectedLightbox(payload)}
                      onDownloadImage={handleDownload}
                    />
                  ))}

                  {isQuotaBlocked && quotaBlockedAssistantMessage && (
                    <>
                      <AssistantMessage
                        message={quotaBlockedAssistantMessage}
                        isLoading={false}
                      />
                      {team?._id && (
                        <div className="mx-auto w-full max-w-[44rem]">
                          <AIQuotaUpsellCard
                            teamId={team._id}
                            currentPlan={aiAccess?.currentPlan}
                            subscriptionStatus={aiAccess?.subscriptionStatus ?? null}
                            message={aiAccess?.message}
                            remainingTokens={aiAccess?.remainingTokens ?? 0}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Generating indicator - only show if for this session */}
                  {isGenerating && (generatingSessionId === currentSessionId || (generatingSessionId === "new" && !currentSessionId)) && (
                    <ThinkingMessage />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area for conversation */}
            {!showEmptyState && (
              <div className="w-full px-6 py-4 border-t border-border/50">
                <Composer
                  submitStatus={submitStatus}
                  onSubmit={handleSendMessage}
                  onStopResponse={handleStopResponse}
                  placeholder="Describe your visualization..."
                  accept="image/*"
                  maxFiles={10}
                  maxFileSize={20 * 1024 * 1024}
                  isUploading={isUploading}
                  disabled={isGenerating}
                />
              </div>
            )}
          </div>

          {/* Sidebar using ChatSidebar */}
          <ChatSidebar
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            isThreadListLoading={sessions === undefined}
            hasThreads={(sessions?.length ?? 0) > 0}
            threadList={threadList}
            currentThreadId={currentSessionId ?? undefined}
            onThreadSelect={handleThreadSelect}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedLightbox && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[10000] flex flex-col items-center justify-center p-8"
              onClick={() => setSelectedLightbox(null)}
            >
              <div className="absolute top-4 right-4 z-50">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-12 w-12 shadow-lg"
                  onClick={() => setSelectedLightbox(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <motion.div
                className="relative w-full h-full flex items-center justify-center"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
              >
                <img
                  src={selectedLightbox.url}
                  alt={selectedLightbox.prompt}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>

              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50 bg-black/50 backdrop-blur-md p-2 rounded-full border border-[color:var(--overlay-border-soft)] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  className="rounded-lg text-[var(--overlay-foreground)] hover:bg-card/20 hover:text-[var(--overlay-foreground)] px-6 h-10"
                  onClick={() => handleDownload(selectedLightbox.url)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    </PromptInputProvider>
  );
}
