// Messaging Module Types

export type MessagingPlatform = "telegram" | "whatsapp";

export interface InboundMessage {
    platform: MessagingPlatform;
    externalUserId: string;
    text: string;
    timestamp: number;
    metadata?: {
        messageId?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
        mediaUrl?: string;
        mediaType?: string;
    };
}

export interface OutboundMessage {
    platform: MessagingPlatform;
    externalUserId: string;
    text: string;
}

// Telegram Update types (subset of grammy types)
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

export interface TelegramMessage {
    message_id: number;
    from?: {
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
    };
    chat: {
        id: number;
        type: "private" | "group" | "supergroup" | "channel";
        title?: string;
        first_name?: string;
        last_name?: string;
        username?: string;
    };
    date: number;
    text?: string;
    caption?: string;
    photo?: Array<{
        file_id: string;
        file_unique_id: string;
        width: number;
        height: number;
        file_size?: number;
    }>;
    document?: {
        file_id: string;
        file_unique_id: string;
        file_name?: string;
        mime_type?: string;
        file_size?: number;
    };
}

// WhatsApp Cloud API types
export interface WhatsAppWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: string;
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                contacts?: Array<{
                    profile: { name: string };
                    wa_id: string;
                }>;
                messages?: Array<WhatsAppMessage>;
            };
            field: string;
        }>;
    }>;
}

export interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    type: "text" | "image" | "document" | "audio" | "video" | "location" | "contacts" | "reaction";
    text?: { body: string };
    image?: { id: string; caption?: string };
}
