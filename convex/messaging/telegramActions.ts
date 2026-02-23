"use node";

/**
 * Telegram Node.js Actions
 * 
 * Node.js-specific actions for Telegram integration.
 * These handle the actual message processing and API calls.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
const internalAny = require("../_generated/api").internal as any;

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const FREE_TELEGRAM_MESSAGE_LIMIT = 20;

// Handle incoming Telegram message
export const handleTelegramMessage = internalAction({
    args: {
        projectId: v.id("projects"),
        chatId: v.string(),
        text: v.string(),
        messageId: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.any()),
        media: v.optional(v.object({
            type: v.union(v.literal("photo"), v.literal("document")),
            fileId: v.string(),
            fileName: v.optional(v.string()),
            mimeType: v.optional(v.string()),
            fileSize: v.optional(v.number()),
        })),
    },
    handler: async (ctx, args) => {
        console.log("🔄 [TELEGRAM MESSAGE]", {
            chatId: args.chatId,
            textPreview: args.text.substring(0, 50),
            projectId: args.projectId,
        });

        const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
            projectId: args.projectId,
        });

        if (!project?.telegramBotToken) {
            console.error("❌ [TELEGRAM MESSAGE] Project bot token not configured", {
                projectId: args.projectId,
            });
            return;
        }
        if (!project.createdBy) {
            console.error("❌ [TELEGRAM MESSAGE] Project missing owner", {
                projectId: args.projectId,
            });
            return;
        }

        const text = args.text;

        // Handle /start command
        if (text.startsWith("/start")) {
            const parts = text.split(" ");
            const param = parts[1]?.trim();

            if (param && param !== String(args.projectId)) {
                await sendTelegramMessageDirect(
                    args.chatId,
                    `This bot belongs to project "${project.name}". Please use the correct bot for your project.`,
                    project.telegramBotToken
                );
                return;
            }

            // Check if user is already connected to this project
            const existingChannel = await ctx.runQuery(internalAny.messaging.channels.getChannelByExternalIdForProject, {
                platform: "telegram",
                externalUserId: args.chatId,
                projectId: args.projectId,
            });

            if (existingChannel) {
                // Already connected
                await sendTelegramMessageDirect(
                    args.chatId,
                    `Connected to project: ${project?.name || "Unknown"}\n\nSend a message to start chatting.`,
                    project.telegramBotToken
                );
            } else if (param) {
                // Parameter provided - create pairing request for this project
                await createPairingRequest(ctx, args.chatId, args.projectId, args.metadata, project.telegramBotToken);
            } else {
                // No parameter - send help message
                await sendTelegramMessageDirect(
                    args.chatId,
                    `To connect this bot to project "${project.name}", use the link from your project settings.`,
                    project.telegramBotToken
                );
            }
            return;
        }

        // Handle /connect command
        if (text.startsWith("/connect ")) {
            const projectIdStr = text.replace("/connect ", "").trim();
            await processConnectCommand(ctx, args.chatId, projectIdStr, args.projectId, project.name, args.metadata, project.telegramBotToken);
            return;
        }

        // Handle /new command - reset chat (web UI + Telegram)
        if (text.trim() === "/new") {
            await resetTelegramThread(ctx, args.projectId, args.chatId, project.createdBy, project.telegramBotToken);
            return;
        }

        if (args.media) {
            try {
                const channel = await ctx.runQuery(internalAny.messaging.channels.getChannelByExternalIdForProject, {
                    platform: "telegram",
                    externalUserId: args.chatId,
                    projectId: args.projectId as any,
                });

                if (!channel) {
                    await sendTelegramMessageDirect(
                        args.chatId,
                        "You are not connected to a project. Use the /start link from your project settings to connect.",
                        project.telegramBotToken
                    );
                    return;
                }

                const canProceed = await enforceFreeTelegramMessageLimit(
                    ctx,
                    channel.teamId,
                    channel._id,
                    args.chatId,
                    project.telegramBotToken
                );
                if (!canProceed) return;

                const baseMessage = args.text?.trim()
                    ? args.text.trim()
                    : args.media.type === "photo"
                        ? "User attached a photo."
                        : "User attached a file.";

                await sendTelegramTyping(args.chatId, project.telegramBotToken);

                const fileId = await uploadTelegramMediaToProject(ctx, {
                    projectId: args.projectId,
                    actorUserId: project.createdBy,
                    botToken: project.telegramBotToken,
                    media: args.media,
                    messageId: args.messageId,
                });

                // Use the project owner's web UI thread so messages appear in the UI chat
                const threadId = await ctx.runMutation(internalAny.ai.threads.getProjectThreadInternal, {
                    projectId: args.projectId,
                    userClerkId: project.createdBy,
                    title: "Assistant Chat",
                });

                if (!channel.threadId || channel.threadId !== threadId) {
                    await ctx.runMutation(internalAny.messaging.channels.updateChannelThreadId, {
                        channelId: channel._id,
                        threadId,
                    });
                }

                await ctx.runAction(internalAny.ai.streaming.internalDoStreaming, {
                    message: baseMessage,
                    projectId: args.projectId,
                    userClerkId: project.createdBy,
                    threadId,
                    fileId,
                });

                const response = await ctx.runQuery(internalAny.ai.threads.getLatestAssistantMessageText, {
                    threadId,
                });

                if (response) {
                    await sendTelegramMessageDirect(args.chatId, response, project.telegramBotToken);
                } else {
                    await sendTelegramMessageDirect(args.chatId, "Sorry, I couldn't generate a response. Please try again.", project.telegramBotToken);
                }
            } catch (error) {
                console.error("❌ [TELEGRAM MEDIA PROCESSING ERROR]", error);
                await sendTelegramMessageDirect(
                    args.chatId,
                    "Failed to process the attachment. Please try again.",
                    project.telegramBotToken
                );
            }
            return;
        }

        // Regular message - process via AI
        await processRegularMessage(
            ctx,
            args.chatId,
            args.text,
            args.projectId,
            project.createdBy,
            project.telegramBotToken
        );
    },
});

async function uploadTelegramMediaToProject(
    ctx: any,
    args: {
        projectId: string;
        actorUserId: string;
        botToken: string;
        media: {
            type: "photo" | "document";
            fileId: string;
            fileName?: string;
            mimeType?: string;
            fileSize?: number;
        };
        messageId: string;
    }
): Promise<string> {
    const fileInfoResponse = await fetch(
        `${TELEGRAM_API_BASE}${args.botToken}/getFile?file_id=${args.media.fileId}`
    );
    if (!fileInfoResponse.ok) {
        throw new Error(`Failed to fetch Telegram file info: ${await fileInfoResponse.text()}`);
    }
    const fileInfo = await fileInfoResponse.json();
    const filePath = fileInfo?.result?.file_path as string | undefined;
    if (!filePath) {
        throw new Error("Telegram file_path missing");
    }

    const fileUrl = `${TELEGRAM_API_BASE.replace("/bot", "/file/bot")}${args.botToken}/${filePath}`;
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
        throw new Error(`Failed to download Telegram file: ${await fileResponse.text()}`);
    }

    const fileExt = filePath.includes(".") ? filePath.split(".").pop() : undefined;
    const fileName = args.media.fileName
        ?? `telegram_${args.messageId}${fileExt ? `.${fileExt}` : ""}`;
    const mimeType = args.media.mimeType
        ?? (args.media.type === "photo" ? "image/jpeg" : "application/octet-stream");

    const uploadUrl = await ctx.runMutation(internalAny.files.generateUploadUrlWithCustomKeyInternal, {
        projectId: args.projectId as any,
        actorUserId: args.actorUserId,
        fileName,
        origin: "ai",
        fileSize: args.media.fileSize,
    });

    const buffer = await fileResponse.arrayBuffer();
    const uploadResponse = await fetch(uploadUrl.url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: buffer,
    });
    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file to storage: ${await uploadResponse.text()}`);
    }

    const fileId = await ctx.runMutation(internalAny.files.createFileRecordInternal, {
        projectId: args.projectId as any,
        actorUserId: args.actorUserId,
        fileKey: uploadUrl.key,
        fileName,
        fileType: mimeType,
        fileSize: args.media.fileSize,
        origin: "ai",
    });

    return fileId as string;
}

async function resetTelegramThread(
    ctx: any,
    projectId: string,
    chatId: string,
    projectOwnerClerkId: string,
    botToken: string,
): Promise<void> {
    const channel = await ctx.runQuery(internalAny.messaging.channels.getChannelByExternalIdForProject, {
        platform: "telegram",
        externalUserId: chatId,
        projectId: projectId as any,
    });

    if (!channel) {
        await sendTelegramMessageDirect(
            chatId,
            "You are not connected to a project. Use the /start link from your project settings to connect.",
            botToken
        );
        return;
    }

    const threadId = channel.threadId
        ? channel.threadId
        : await ctx.runMutation(internalAny.ai.threads.getProjectThreadInternal, {
              projectId: projectId as any,
              userClerkId: projectOwnerClerkId,
              title: "Assistant Chat",
          });

    await ctx.runMutation(internalAny.ai.threads.clearThreadInternal, {
        threadId,
        projectId: projectId as any,
    });

    await ctx.runMutation(internalAny.messaging.channels.updateChannelThreadId, {
        channelId: channel._id,
        threadId,
    });

    await sendTelegramMessageDirect(
        chatId,
        "Chat reset. Send a message to start a new conversation.",
        botToken
    );
}

// Create pairing request (like MoltBot approval flow)
async function createPairingRequest(
    ctx: any,
    chatId: string,
    projectId: string,
    metadata?: any,
    botToken?: string
): Promise<void> {
    try {
        // Check if there's already a pending request
        const existingRequest = await ctx.runQuery(internalAny.messaging.pairingRequests.getPendingRequest, {
            projectId: projectId as any,
            platform: "telegram",
            externalUserId: chatId,
        });

        let pairingCode: string;

        if (existingRequest) {
            // Use existing code
            pairingCode = existingRequest.pairingCode;
        } else {
            // Generate new code
            pairingCode = generatePairingCode();

            // Create pairing request
            await ctx.runMutation(internalAny.messaging.pairingRequests.createPairingRequest, {
                projectId: projectId as any,
                platform: "telegram",
                externalUserId: chatId,
                pairingCode,
                metadata,
            });
        }

        await sendTelegramMessageDirect(
            chatId,
            `Pairing code: ${pairingCode}\n\n` +
            `Copy this entire message and paste it to your assistant in Myvibe project to connect your Telegram account.`,
            botToken
        );
    } catch (error) {
        console.error("❌ [PAIRING REQUEST ERROR]", error);
        await sendTelegramMessageDirect(chatId, "Something went wrong. Please try again later.", botToken);
    }
}

// Generate 8-character pairing code (like MoltBot)
function generatePairingCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Process /connect command
async function processConnectCommand(
    ctx: any,
    chatId: string,
    projectIdStr: string,
    expectedProjectId: string,
    projectName: string,
    metadata?: any,
    botToken?: string
): Promise<void> {
    try {
        if (projectIdStr !== String(expectedProjectId)) {
            await sendTelegramMessageDirect(
                chatId,
                `This bot belongs to project "${projectName}". Please use the correct bot or project ID.`,
                botToken
            );
            return;
        }

        const channel = await ctx.runMutation(internalAny.messaging.channels.getOrCreateChannel, {
            platform: "telegram",
            externalUserId: chatId,
            projectId: expectedProjectId as any,
            metadata,
        });

        const message = channel.isNew
            ? `Connected to project "${projectName}"! You can now send me messages.`
            : `Already connected to project "${projectName}".`;

        await sendTelegramMessageDirect(chatId, message, botToken);
    } catch (error) {
        console.error("❌ [CONNECT ERROR]", error);
        await sendTelegramMessageDirect(chatId, "Failed to connect to the project. Please try again.", botToken);
    }
}

// Process regular message via AI
async function processRegularMessage(
    ctx: any,
    chatId: string,
    text: string,
    projectId: string,
    projectOwnerClerkId: string,
    botToken: string
): Promise<void> {
    // Find the channel for this chat
    const channel = await ctx.runQuery(internalAny.messaging.channels.getChannelByExternalIdForProject, {
        platform: "telegram",
        externalUserId: chatId,
        projectId: projectId as any,
    });

    if (!channel) {
        await sendTelegramMessageDirect(
            chatId,
            "You are not connected to a project. Use the /start link from your project settings to connect.",
            botToken
        );
        return;
    }

    const canProceed = await enforceFreeTelegramMessageLimit(
        ctx,
        channel.teamId,
        channel._id,
        chatId,
        botToken
    );
    if (!canProceed) return;

    const systemUserId = projectOwnerClerkId;

    try {
        // Send typing indicator
        await sendTelegramTyping(chatId, botToken);

        // Use the project owner's web UI thread so messages appear in the UI chat
        const threadId = await ctx.runMutation(internalAny.ai.threads.getProjectThreadInternal, {
            projectId: channel.projectId,
            userClerkId: projectOwnerClerkId,
            title: "Assistant Chat",
        });

        if (!channel.threadId || channel.threadId !== threadId) {
            await ctx.runMutation(internalAny.messaging.channels.updateChannelThreadId, {
                channelId: channel._id,
                threadId,
            });
        }

        // Call AI streaming
        await ctx.runAction(internalAny.ai.streaming.internalDoStreaming, {
            message: text,
            projectId: channel.projectId,
            userClerkId: systemUserId,
            threadId,
        });

        // Get the AI response
        const response = await ctx.runQuery(internalAny.ai.threads.getLatestAssistantMessageText, {
            threadId,
        });

        if (response) {
            await sendTelegramMessageDirect(chatId, response, botToken);
        } else {
            await sendTelegramMessageDirect(chatId, "Sorry, I couldn't generate a response. Please try again.", botToken);
        }
    } catch (error) {
        console.error("❌ [AI PROCESSING ERROR]", error);
        await sendTelegramMessageDirect(
            chatId,
            "Something went wrong while processing your message. Please try again.",
            botToken
        );
    }
}

async function enforceFreeTelegramMessageLimit(
    ctx: any,
    teamId: string,
    channelId: string,
    chatId: string,
    botToken: string
): Promise<boolean> {
    const teamSubscription = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccess, {
        teamId: teamId as any,
    });

    if (teamSubscription?.currentPlan !== "free") {
        return true;
    }

    const usage = await ctx.runQuery(internalAny.messaging.channels.getTeamTelegramMessageUsage, {
        teamId: teamId as any,
    });

    if ((usage?.totalMessages || 0) >= FREE_TELEGRAM_MESSAGE_LIMIT) {
        await sendTelegramMessageDirect(
            chatId,
            "Free plan Telegram limit reached (20 messages total). Upgrade to continue chatting on Telegram.",
            botToken
        );
        return false;
    }

    await ctx.runMutation(internalAny.messaging.channels.incrementTelegramMessageUsage, {
        channelId: channelId as any,
    });
    return true;
}

// Send approval notification to user
export const sendApprovalNotification = internalAction({
    args: {
        chatId: v.string(),
        projectId: v.id("projects"),
        projectName: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
            projectId: args.projectId,
        });

        if (!project?.telegramBotToken) {
            console.error("❌ [TELEGRAM APPROVAL] Bot token missing", { projectId: args.projectId });
            return;
        }

        await sendTelegramMessageDirect(
            args.chatId,
            `✅ ${args.projectName} - access approved. Send a message to start chatting.`,
            project.telegramBotToken
        );
    },
});


// Set webhook for a bot
export const setTelegramWebhook = internalAction({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
            projectId: args.projectId,
        });

        if (!project?.telegramBotToken || !project.telegramWebhookSecret) {
            throw new Error("Telegram bot token not configured for this project");
        }

        const webhookUrl = `${process.env.CONVEX_SITE_URL}/telegram/webhook`;

        try {
            const response = await fetch(`${TELEGRAM_API_BASE}${project.telegramBotToken}/setWebhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: webhookUrl,
                    secret_token: project.telegramWebhookSecret,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error("❌ [WEBHOOK SETUP ERROR]", error);
                throw new Error(`Failed to set webhook: ${error}`);
            }

            console.log("✅ [WEBHOOK CONFIGURED]", { projectId: args.projectId, webhookUrl });
            return { success: true, webhookUrl };
        } catch (error) {
            console.error("❌ [WEBHOOK SETUP ERROR]", error);
            throw error;
        }
    },
});

export const deleteTelegramWebhook = internalAction({
    args: {
        botToken: v.string(),
    },
    handler: async (_ctx, args) => {
        try {
            const response = await fetch(`${TELEGRAM_API_BASE}${args.botToken}/deleteWebhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const error = await response.text();
                console.error("❌ [WEBHOOK DELETE ERROR]", error);
                return { success: false, error };
            }

            console.log("✅ [WEBHOOK DELETED]");
            return { success: true };
        } catch (error) {
            console.error("❌ [WEBHOOK DELETE ERROR]", error);
            return { success: false, error: String(error) };
        }
    },
});

export const sendTelegramMessage = internalAction({
    args: {
        projectId: v.id("projects"),
        chatId: v.string(),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
            projectId: args.projectId,
        });

        if (!project?.telegramBotToken) {
            throw new Error("Telegram bot token not configured for this project");
        }

        await sendTelegramMessageDirect(args.chatId, args.text, project.telegramBotToken);
    },
});

// Helper: Send message to Telegram (now accepts token as parameter)
async function sendTelegramMessageDirect(chatId: string, text: string, token?: string): Promise<void> {
    const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error("❌ TELEGRAM_BOT_TOKEN not configured");
        return;
    }

    try {
        const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "Markdown",
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("❌ [TELEGRAM SEND ERROR]", error);
        }
    } catch (error) {
        console.error("❌ [TELEGRAM SEND ERROR]", error);
    }
}

// Helper: Send typing indicator (now accepts token as parameter)
async function sendTelegramTyping(chatId: string, token?: string): Promise<void> {
    const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
        await fetch(`${TELEGRAM_API_BASE}${botToken}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                action: "typing",
            }),
        });
    } catch (error) {
        // Ignore typing errors
    }
}
