"use client";

import { Loader2 } from "lucide-react";

import { AISubscriptionWall, AIQuotaUpsellCard } from "@/components/ai/shared";
import { PromptInputProvider } from "@/components/ai/primitives/prompt-input";
import { Message as AssistantMessage, ThinkingMessage } from "@/components/ai/assistant/ui/messages";
import { ChatSidebar } from "@/components/ai/assistant/ui/Sidebar";

import { VISUALIZATION_SUGGESTIONS } from "./constants";
import {
  VisualizationComposer,
  VisualizationEmptyState,
  VisualizationHeader,
  VisualizationLightbox,
} from "./components";
import { useVisualizationController } from "./useVisualizationController";

export default function VisualizationsPage() {
  const {
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
    sessionCount,
    setSelectedLightbox,
    setShowHistory,
    showEmptyState,
    showHistory,
    showSubscriptionWall,
    submitStatus,
    team,
    threadList,
  } = useVisualizationController();

  if (showSubscriptionWall && team?._id) {
    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  if (isLoadingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PromptInputProvider>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden text-foreground">
        <div className="flex flex-1 flex-col overflow-hidden">
          <VisualizationHeader
            currentSession={currentSession}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory(!showHistory)}
          />

          <div className="flex-1 overflow-y-auto px-6">
            {showEmptyState ? (
              isQuotaBlocked && quotaBlockedAssistantMessage ? (
                <div className="mx-auto max-w-4xl space-y-6 py-8">
                  <AssistantMessage message={quotaBlockedAssistantMessage} isLoading={false} />
                  <VisualizationComposer
                    submitStatus={submitStatus}
                    onSubmit={handleSendMessage}
                    onStopResponse={handleStopResponse}
                    isUploading={isUploading}
                    disabled={isGenerating}
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
                </div>
              ) : (
                <VisualizationEmptyState
                  submitStatus={submitStatus}
                  onSubmit={handleSendMessage}
                  onStopResponse={handleStopResponse}
                  isUploading={isUploading}
                  disabled={isGenerating}
                  suggestions={VISUALIZATION_SUGGESTIONS}
                />
              )
            ) : (
              <div className="mx-auto max-w-4xl space-y-6 py-6">
                {displayMessages.map(({ raw, mapped }) => (
                  <AssistantMessage
                    key={raw._id}
                    message={mapped}
                    isLoading={false}
                    localAttachments={
                      raw.role === "user"
                        ? raw.referenceImages?.map((image) => ({
                          name: image.name,
                          size: undefined,
                          type: image.mimeType,
                          previewUrl: image.imageUrl,
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
                    <AssistantMessage message={quotaBlockedAssistantMessage} isLoading={false} />
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

                {isGenerating &&
                  (generatingSessionId === currentSessionId ||
                    (generatingSessionId === "new" && !currentSessionId)) && <ThinkingMessage />}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {!showEmptyState && (
            <div className="w-full border-t border-border/50 px-6 py-4">
              <VisualizationComposer
                submitStatus={submitStatus}
                onSubmit={handleSendMessage}
                onStopResponse={handleStopResponse}
                isUploading={isUploading}
                disabled={isGenerating}
              />
            </div>
          )}
        </div>

        <ChatSidebar
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          isThreadListLoading={isThreadListLoading}
          hasThreads={sessionCount > 0}
          threadList={threadList}
          currentThreadId={currentSessionId ?? undefined}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          title="Visualization history"
          newChatLabel="New visualization"
          emptyStateTitle="No visualizations yet"
          emptyStateDescription="Start a new visualization to keep iterations and generated images in one thread."
        />
      </div>

      <VisualizationLightbox
        selectedLightbox={selectedLightbox}
        onClose={() => setSelectedLightbox(null)}
        onDownload={handleDownload}
      />
    </PromptInputProvider>
  );
}
