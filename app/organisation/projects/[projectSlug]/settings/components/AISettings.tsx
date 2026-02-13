"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Trash2,
  MessageSquare,
  MessageCircle,
  Sparkles,
  AlertTriangle,
  Loader2,
  FileText,
  RotateCcw,
  Copy
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
  const { user } = useUser();
  const [isClearing, setIsClearing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);

  // Get project data
  const project = useQuery(apiAny.projects.getProject, projectId ? { projectId } : "skip");

  // Get user threads for this project
  const userThreads = useQuery(
    apiAny.ai.threads.listThreadsForUser,
    projectId && user?.id
      ? { projectId, userClerkId: user.id }
      : "skip"
  );

  // Mutation to clear all threads
  const clearAllThreads = useMutation(apiAny.ai.threads.clearAllThreadsForUser);

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
    if (project?.customAiPrompt !== undefined) {
      // If project has custom prompt, use it. Otherwise, use default prompt.
      setCustomPrompt(project.customAiPrompt || defaultPrompt);
    }
  }, [project?.customAiPrompt]);

  useEffect(() => {
    if (!project) return;
    setTelegramBotUsername(project.telegramBotUsername || "");
    setTelegramBotToken(project.telegramBotToken || "");
  }, [project]);

  const threadCount = userThreads?.length ?? 0;
  const hasThreads = threadCount > 0;

  const handleSaveCustomPrompt = async () => {
    if (!projectId) return;

    setIsSaving(true);
    try {
      // Save as custom prompt only if different from default, otherwise save as undefined
      const promptToSave = customPrompt.trim() === defaultPrompt ? undefined : customPrompt.trim();
      await updateProject({
        projectId,
        customAiPrompt: promptToSave,
      });
      toast.success("Zapisano niestandardowy prompt AI");
    } catch (error) {
      console.error("Failed to save custom AI prompt:", error);
      toast.error("Nie udało się zapisać promptu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomPrompt(defaultPrompt);
  };

  const handleClearAllHistory = async () => {
    if (!projectId || !user?.id) return;

    setIsClearing(true);
    try {
      const result = await clearAllThreads({
        projectId,
        userClerkId: user.id,
      });
      toast.success(`Usunięto ${result.removedThreads} konwersacji AI`);
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear AI history:", error);
      toast.error("Nie udało się usunąć historii AI");
    } finally {
      setIsClearing(false);
    }
  };

  const handleSaveTelegram = async () => {
    if (!projectId) return;

    const username = telegramBotUsername.trim().replace(/^@/, "");
    const token = telegramBotToken.trim();

    if (!username) {
      toast.error("Podaj nazwę użytkownika bota Telegram");
      return;
    }
    if (!token) {
      toast.error("Podaj token bota Telegram");
      return;
    }

    setIsSavingTelegram(true);
    try {
      await updateProject({
        projectId,
        telegramBotUsername: username,
        telegramBotToken: token,
      });
      toast.success("Zapisano bota Telegram. Możesz teraz połączyć konto.");
    } catch (error) {
      console.error("Failed to save Telegram config:", error);
      toast.error("Nie udało się zapisać konfiguracji Telegram");
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
      toast.error("Najpierw wpisz nazwę użytkownika bota");
      return;
    }

    try {
      await navigator.clipboard.writeText(telegramDeepLink);
      toast.success("Skopiowano link Telegram");
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  };

  const handleOpenTelegram = () => {
    if (!telegramDeepLink) {
      toast.error("Najpierw zapisz konfigurację bota");
      return;
    }
    window.open(telegramDeepLink, "_blank");
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await approvePairingRequest({ requestId });
      toast.success("Połączenie zatwierdzone");
    } catch (error) {
      console.error("Failed to approve Telegram pairing:", error);
      toast.error("Nie udało się zatwierdzić połączenia");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectPairingRequest({ requestId });
      toast.success("Połączenie odrzucone");
    } catch (error) {
      console.error("Failed to reject Telegram pairing:", error);
      toast.error("Nie udało się odrzucić połączenia");
    }
  };

  const handleDisconnectChannel = async (platform: string, externalUserId: string) => {
    try {
      await disconnectChannel({ projectId, platform, externalUserId });
      toast.success("Kanał został rozłączony");
    } catch (error) {
      console.error("Failed to disconnect channel:", error);
      toast.error("Nie udało się rozłączyć kanału");
    }
  };

  const isCustomPromptChanged = customPrompt !== (project?.customAiPrompt || defaultPrompt);
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
            Zarządzaj ustawieniami asystenta AI dla tego projektu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Historia konwersacji</p>
                <p className="text-sm text-muted-foreground">
                  {userThreads === undefined ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Ładowanie...
                    </span>
                  ) : (
                    <>
                      {threadCount} {threadCount === 1 ? "konwersacja" : threadCount < 5 ? "konwersacje" : "konwersacji"}
                    </>
                  )}
                </p>
              </div>
            </div>
            {hasThreads && (
              <Badge variant="secondary" className="text-xs">
                Aktywne
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom AI Prompt Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg lg:text-xl">Niestandardowy prompt AI</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Dostosuj sposób, w jaki asystent AI odpowiada w tym projekcie. Pozostaw puste, aby użyć domyślnego promptu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customPrompt" className="text-sm font-medium">
              Custom Prompt
            </Label>
            <Textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {customPrompt.trim() === defaultPrompt ? (
                <>Używasz domyślnego promptu systemu ({defaultPrompt.length} znaków)</>
              ) : (
                <>Używasz niestandardowego promptu ({customPrompt.length} znaków)</>
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
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Zapisz prompt
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={customPrompt.trim() === defaultPrompt}
              className="flex-1 sm:flex-initial"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Przywróć domyślny
            </Button>
          </div>

          {customPrompt.trim() && customPrompt.trim() !== defaultPrompt && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Uwaga:</strong> Używasz niestandardowego promptu. Zmiana wpłynie tylko na nowe konwersacje. Istniejące konwersacje będą nadal używać poprzedniego promptu.
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
            <CardTitle className="text-lg lg:text-xl">Integracja Telegram</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Połącz asystenta z Telegramem tak jak w VibePlanner: bot, deep link i akceptacja pairing code.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
            <p className="text-xs font-medium mb-2">Szybka konfiguracja</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Otwórz Telegram i znajdź @BotFather</li>
              <li>Wyślij komendę <code className="bg-muted px-1 rounded">/newbot</code></li>
              <li>Skopiuj username i token bota</li>
              <li>Zapisz je poniżej</li>
              <li>Kliknij „Open Telegram”, naciśnij Start i zatwierdź kod parowania tutaj</li>
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-username">Bot Username</Label>
              <Input
                id="telegram-bot-username"
                value={telegramBotUsername}
                onChange={(e) => setTelegramBotUsername(e.target.value)}
                placeholder="myassistant_bot (bez @)"
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
                  Zapisywanie...
                </>
              ) : (
                "Zapisz bota Telegram"
              )}
            </Button>
            <Button variant="outline" onClick={handleOpenTelegram} disabled={!telegramDeepLink}>
              Open Telegram
            </Button>
            <Button variant="outline" onClick={handleCopyTelegramLink} disabled={!telegramDeepLink}>
              <Copy className="mr-2 h-4 w-4" />
              Kopiuj link
            </Button>
          </div>

          {telegramDeepLink && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-1">Link połączenia</p>
              <p className="text-xs text-muted-foreground break-all">{telegramDeepLink}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Połączone kanały</p>
            {connectedChannelsList.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak połączonych kanałów.</p>
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
                Oczekujące prośby o połączenie ({pendingRequestsList.length})
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

      {/* Danger Zone Card */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive text-lg lg:text-xl">Strefa niebezpieczna</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Nieodwracalne akcje związane z AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 lg:px-6 space-y-4">
          <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-medium text-destructive">Usuń całą historię czatu AI</h4>
                <p className="text-sm text-muted-foreground">
                  Trwale usuwa wszystkie konwersacje z asystentem AI w tym projekcie.
                  Ta operacja jest nieodwracalna.
                </p>
              </div>
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={!hasThreads || isClearing}
                    className="shrink-0"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Usuwanie...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Usuń historię
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć historię?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ta akcja jest nieodwracalna. Wszystkie {threadCount} konwersacji z asystentem AI 
                      w tym projekcie zostaną trwale usunięte.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearing}>Anuluj</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllHistory}
                      disabled={isClearing}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isClearing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Usuwanie...
                        </>
                      ) : (
                        "Tak, usuń wszystko"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
