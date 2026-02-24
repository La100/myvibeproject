"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Trash2,
  MessageCircle,
  Sparkles,
  Loader2,
  FileText,
  RotateCcw,
  Copy
} from "lucide-react";
import { defaultPrompt } from "@/convex/ai/prompt";

interface AISettingsProps {
  projectId: Id<"projects">;
}

interface MessagingChannel {
  _id?: string;
  platform: string;
  externalUserId: string;
}

interface MessagingPairingRequest {
  _id: string;
  platform: string;
  externalUserId: string;
  pairingCode: string;
  metadata?: {
    username?: string;
  };
}

export default function AISettings({ projectId }: AISettingsProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [aiAutoConfirmCrud, setAiAutoConfirmCrud] = useState(false);
  const [isSavingAiConfirmMode, setIsSavingAiConfirmMode] = useState(false);

  // Get project data
  const project = useQuery(apiAny.projects.getProject, projectId ? { projectId } : "skip");

  // Mutation to update project settings
  const updateProject = useMutation(apiAny.projects.updateProject);
  const approvePairingRequest = useMutation(apiAny.messaging.pairingRequests.approvePairingRequest);
  const rejectPairingRequest = useMutation(apiAny.messaging.pairingRequests.rejectPairingRequest);
  const disconnectChannel = useMutation(apiAny.messaging.channels.disconnectChannel);

  const connectedChannels = useQuery(
    apiAny.messaging.pairingTokens.getConnectedChannels,
    projectId ? { projectId } : "skip"
  );
  const pendingRequests = useQuery(
    apiAny.messaging.pairingRequests.listPendingRequests,
    projectId ? { projectId } : "skip"
  );

  // Initialize custom prompt from project data
  useEffect(() => {
    if (!project) return;
    setCustomPrompt(project.customAiPrompt || "");
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setTelegramBotUsername(project.telegramBotUsername || "");
    setTelegramBotToken(project.telegramBotToken || "");
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

  const handleSaveTelegram = async () => {
    if (!projectId) return;

    const username = telegramBotUsername.trim().replace(/^@/, "");
    const token = telegramBotToken.trim();

    if (!username) {
      toast.error("Enter the Telegram bot username");
      return;
    }
    if (!token) {
      toast.error("Enter the Telegram bot token");
      return;
    }

    setIsSavingTelegram(true);
    try {
      await updateProject({
        projectId,
        telegramBotUsername: username,
        telegramBotToken: token,
      });
      toast.success("Telegram bot saved. You can now connect your account.");
    } catch (error) {
      console.error("Failed to save Telegram config:", error);
      toast.error("Failed to save Telegram configuration");
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const normalizedTelegramUsername = telegramBotUsername.trim().replace(/^@/, "");
  const telegramDeepLink = normalizedTelegramUsername
    ? `https://t.me/${normalizedTelegramUsername}?start=${projectId}`
    : "";

  const handleCopyTelegramLink = async () => {
    if (!telegramDeepLink) {
      toast.error("Enter the bot username first");
      return;
    }

    try {
      await navigator.clipboard.writeText(telegramDeepLink);
      toast.success("Telegram link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenTelegram = () => {
    if (!telegramDeepLink) {
      toast.error("Save the bot configuration first");
      return;
    }
    window.open(telegramDeepLink, "_blank");
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await approvePairingRequest({ requestId });
      toast.success("Connection approved");
    } catch (error) {
      console.error("Failed to approve Telegram pairing:", error);
      toast.error("Failed to approve connection");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectPairingRequest({ requestId });
      toast.success("Connection rejected");
    } catch (error) {
      console.error("Failed to reject Telegram pairing:", error);
      toast.error("Failed to reject connection");
    }
  };

  const handleDisconnectChannel = async (platform: string, externalUserId: string) => {
    try {
      await disconnectChannel({ projectId, platform, externalUserId });
      toast.success("Channel disconnected");
    } catch (error) {
      console.error("Failed to disconnect channel:", error);
      toast.error("Failed to disconnect channel");
    }
  };

  const isCustomPromptChanged = customPrompt !== (project?.customAiPrompt || "");
  const connectedChannelsList = (connectedChannels ?? []) as MessagingChannel[];
  const pendingRequestsList = (pendingRequests ?? []) as MessagingPairingRequest[];

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

      {/* Telegram Integration Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">Telegram Integration</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Connect the assistant to Telegram like in VibePlanner: bot, deep link, and pairing code approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
            <p className="text-xs font-medium mb-2">Quick Setup</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Open Telegram and find @BotFather</li>
              <li>Send the command <code className="bg-muted px-1 rounded">/newbot</code></li>
              <li>Copy the bot username and token</li>
              <li>Save them below</li>
              <li>Click "Open Telegram", press Start, then approve the pairing code here</li>
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-username">Bot Username</Label>
              <Input
                id="telegram-bot-username"
                value={telegramBotUsername}
                onChange={(e) => setTelegramBotUsername(e.target.value)}
                placeholder="myassistant_bot (without @)"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-token">Bot Token</Label>
              <Input
                id="telegram-bot-token"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456:ABC..."
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSaveTelegram} disabled={isSavingTelegram}>
              {isSavingTelegram ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Telegram Bot"
              )}
            </Button>
            <Button variant="outline" onClick={handleOpenTelegram} disabled={!telegramDeepLink}>
              Open Telegram
            </Button>
            <Button variant="outline" onClick={handleCopyTelegramLink} disabled={!telegramDeepLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          </div>

          {telegramDeepLink && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-1">Connection Link</p>
              <p className="text-xs text-muted-foreground break-all">{telegramDeepLink}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Connected Channels</p>
            {connectedChannelsList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No connected channels.</p>
            ) : (
              <div className="space-y-2">
                {connectedChannelsList.map((channel) => (
                  <div
                    key={String(channel._id ?? `${channel.platform}-${channel.externalUserId}`)}
                    className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{channel.platform}</p>
                      <p className="text-xs text-muted-foreground">{channel.externalUserId}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectChannel(channel.platform, channel.externalUserId)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingRequestsList.length > 0 && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-2">
              <p className="text-sm font-medium">
                Pending Connection Requests ({pendingRequestsList.length})
              </p>
              {pendingRequestsList.map((request) => (
                <div
                  key={String(request._id)}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border bg-background p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {request.platform === "telegram" ? "Telegram" : "WhatsApp"}:{" "}
                      {request.metadata?.username ? `@${request.metadata.username}` : request.externalUserId}
                    </p>
                    <p className="text-xs text-muted-foreground">Code: {request.pairingCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveRequest(String(request._id))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectRequest(String(request._id))}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
