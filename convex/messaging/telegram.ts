/**
 * Telegram HTTP Routes (non-Node.js)
 * 
 * HTTP handlers for Telegram webhooks. These cannot be in Node.js files.
 * They delegate to Node.js actions for the actual processing.
 */

import { httpAction } from "../_generated/server";
import type { TelegramUpdate } from "./types";
const internalAny = require("../_generated/api").internal as any;

// Telegram Webhook Handler
export const telegramWebhook = httpAction(async (ctx, request) => {
    try {
        const secret = request.headers.get("x-telegram-bot-api-secret-token");
        if (!secret) {
            console.warn("❌ [TELEGRAM WEBHOOK] Missing secret token");
            return new Response("Unauthorized", { status: 401 });
        }

        const project = await ctx.runQuery(internalAny.projects.getProjectByTelegramWebhookSecret, {
            telegramWebhookSecret: secret,
        });

        if (!project) {
            console.warn("⚠️ [TELEGRAM WEBHOOK] Unknown secret token (possibly deleted project)");
            return new Response("OK", { status: 200 });
        }

        const body = await request.json() as TelegramUpdate;

        console.log("📨 [TELEGRAM WEBHOOK]", {
            updateId: body.update_id,
            hasMessage: !!body.message,
            projectId: project._id,
        });

        if (body.message) {
            const msg = body.message;
            const chatId = String(msg.chat.id);
            const text = msg.text ?? msg.caption ?? "";
            const largestPhoto = msg.photo?.length ? msg.photo[msg.photo.length - 1] : null;
            const document = msg.document ?? null;

            const media = largestPhoto
                ? {
                    type: "photo" as const,
                    fileId: largestPhoto.file_id,
                    fileName: `photo_${msg.message_id}.jpg`,
                    mimeType: "image/jpeg",
                    fileSize: largestPhoto.file_size,
                }
                : document
                    ? {
                        type: "document" as const,
                        fileId: document.file_id,
                        fileName: document.file_name ?? `document_${msg.message_id}`,
                        mimeType: document.mime_type ?? "application/octet-stream",
                        fileSize: document.file_size,
                    }
                    : undefined;

            if (!text && !media) {
                return new Response("OK", { status: 200 });
            }

            // Schedule processing via Node.js action
            await ctx.runAction(internalAny.messaging.telegramActions.handleTelegramMessage, {
                projectId: project._id,
                chatId,
                text,
                messageId: String(msg.message_id),
                timestamp: msg.date * 1000,
                metadata: {
                    firstName: msg.from?.first_name,
                    lastName: msg.from?.last_name,
                    username: msg.from?.username,
                },
                media,
            });
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("❌ [TELEGRAM WEBHOOK ERROR]", error);
        return new Response("Error", { status: 500 });
    }
});
