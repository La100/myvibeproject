"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import { IMAGE_GENERATION_CONFIG } from "./imageGen/config";

/**
 * Gemini Image Generation for Architectural Visualizations
 * Uses Gemini image model with official SDK and chat history
 */

// History message type - includes image data for model responses
const historyMessageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("model")),
  text: v.string(),
  imageBase64: v.optional(v.string()),
  imageMimeType: v.optional(v.string()),
});

/**
 * Generate architectural visualization using Gemini API with chat history
 */
// Reference image type
const referenceImageValidator = v.object({
  base64: v.string(),
  mimeType: v.string(),
  name: v.string(),
});

type GenerateVisualizationResult = {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  textResponse?: string;
  error?: string;
};

export const generateVisualization = action({
  args: {
    prompt: v.string(),
    referenceImages: v.optional(v.array(referenceImageValidator)),
    projectId: v.id("projects"),
    history: v.optional(v.array(historyMessageValidator)),
  },
  returns: v.object({
    success: v.boolean(),
    imageBase64: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    textResponse: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<GenerateVisualizationResult> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured. Please add it to your environment variables.",
      };
    }

    try {
      const aiAccess = await ctx.runQuery(internal.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      });

      if (!aiAccess.allowed) {
        return {
          success: false,
          error: aiAccess.message || "AI features are unavailable for this project.",
        };
      }

      const ai = new GoogleGenAI({ apiKey });

      const startTime = Date.now();

      // Build contents array - single turn only
      // Gemini thinking models require thought_signature for model responses,
      // which we don't have access to. So we use single-turn with context in prompt.
      type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
      type ContentItem = { role: "user" | "model"; parts: Part[] };
      
      const contents: ContentItem[] = [];
      
      // Find the last generated image from history to use as context
      let lastGeneratedImage: { base64: string; mimeType: string } | null = null;
      let conversationContext = "";
      
      if (args.history && args.history.length > 0) {
        // Build conversation context summary
        const contextParts: string[] = [];
        for (const msg of args.history) {
          if (msg.role === "user") {
            contextParts.push(`User requested: "${msg.text}"`);
          } else if (msg.role === "model" && msg.imageBase64 && msg.imageMimeType) {
            contextParts.push("AI generated an image based on this request.");
            // Keep track of the last generated image
            lastGeneratedImage = {
              base64: msg.imageBase64,
              mimeType: msg.imageMimeType,
            };
          }
        }
        if (contextParts.length > 0) {
          conversationContext = "Previous conversation:\n" + contextParts.join("\n") + "\n\nNow: ";
        }
      }
      
      // Build current user message parts
      // Include system prompt and conversation context in prompt
      // We prepend the system prompt to ensure the model follows instructions
      const basePrompt = `${IMAGE_GENERATION_CONFIG.SYSTEM_PROMPT}\n\n`;
      
      const enhancedPrompt = conversationContext 
        ? `${basePrompt}${conversationContext}${args.prompt}`
        : `${basePrompt}${args.prompt}`;
      
      const currentParts: Part[] = [{ text: enhancedPrompt }];
      
      // Add the last generated image first (for context/editing)
      if (lastGeneratedImage) {
        currentParts.push({
          inlineData: {
            mimeType: lastGeneratedImage.mimeType,
            data: lastGeneratedImage.base64,
          },
        });
      }
      
      // Add user-provided reference images
      if (args.referenceImages && args.referenceImages.length > 0) {
        for (const img of args.referenceImages) {
          currentParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
              },
          });
        }
      }
      
      contents.push({ role: "user", parts: currentParts });

      // Generate with full conversation context
      const response = await ai.models.generateContent({
        model: IMAGE_GENERATION_CONFIG.MODEL_ID,
        contents: contents,
        config: IMAGE_GENERATION_CONFIG.GENERATION_CONFIG,
      });

      const duration = Date.now() - startTime;

      // Log usage information
      const usageMetadata = response.usageMetadata;
      console.log("=== GEMINI IMAGE GENERATION (Chat Mode) ===");
      console.log("Model:", IMAGE_GENERATION_CONFIG.MODEL_ID);
      console.log("User prompt:", args.prompt);
      console.log("History length:", args.history?.length || 0, "messages");
      console.log("Reference images:", args.referenceImages?.length || 0);
      console.log("Duration:", duration, "ms");
      console.log("Prompt tokens:", usageMetadata?.promptTokenCount || "N/A");
      console.log("Response tokens:", usageMetadata?.candidatesTokenCount || "N/A");
      console.log("Total tokens:", usageMetadata?.totalTokenCount || "N/A");
      console.log("============================================");

      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          error: "No response generated from Gemini API",
        };
      }

      // Extract image and text from response
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let textResponse: string | undefined;

      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
        }
        if (part.text) {
          textResponse = part.text;
        }
      }

      if (!imageBase64) {
        return {
          success: false,
          error: "No image was generated. The model may have returned only text.",
          textResponse,
        };
      }

      // Log image info
      const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
      console.log("Generated image size:", imageSizeKB, "KB");
      console.log("Image MIME type:", mimeType);

      return {
        success: true,
        imageBase64,
        mimeType: mimeType || "image/png",
        textResponse,
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        success: false,
        error: `Failed to generate visualization: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Save generated image to R2 storage and files table
 */
export const saveGeneratedImage = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    fileName: v.string(),
    projectId: v.id("projects"),
    prompt: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    fileId: v.optional(v.id("files")),
    fileUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    fileId?: Id<"files">;
    fileUrl?: string;
    error?: string;
  }> => {
    try {
      // Get project and team info
      const project: { teamId: Id<"teams">; teamSlug: string; projectSlug: string } | null = 
        await ctx.runQuery(internal.ai.imageGen.helpers.getProjectInfo, {
          projectId: args.projectId,
        });

      if (!project) {
        return { success: false, error: "Project not found" };
      }

      // Convert base64 to binary
      const binaryData = Buffer.from(args.imageBase64, "base64");

      // Determine file extension from mime type
      const extension = args.mimeType.split("/")[1] || "png";
      const uuid = crypto.randomUUID();
      const fileKey: string = `${project.teamSlug}/${project.projectSlug}/ai-visualizations/${uuid}-${args.fileName}.${extension}`;

      // Get upload URL from R2
      const uploadData: { url: string } = await ctx.runMutation(internal.ai.imageGen.helpers.generateR2UploadUrl, {
        key: fileKey,
      });

      // Upload to R2
      const uploadResponse: Response = await fetch(uploadData.url, {
        method: "PUT",
        body: binaryData,
        headers: {
          "Content-Type": args.mimeType,
        },
      });

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: `Failed to upload image: ${uploadResponse.status}`,
        };
      }

      // Save file record to database
      const fileId: Id<"files"> = await ctx.runMutation(internal.ai.imageGen.helpers.createFileRecord, {
        projectId: args.projectId,
        teamId: project.teamId,
        fileName: `${args.fileName}.${extension}`,
        fileKey,
        mimeType: args.mimeType,
        size: binaryData.length,
        description: `AI Generated: ${args.prompt.substring(0, 200)}`,
      });

      // Get the file URL
      const fileUrl: string | null = await ctx.runQuery(internal.ai.imageGen.helpers.getFileUrl, {
        fileKey,
      });

      return {
        success: true,
        fileId,
        fileUrl: fileUrl ?? undefined,
      };
    } catch (error) {
      console.error("Error saving generated image:", error);
      return {
        success: false,
        error: `Failed to save image: ${(error as Error).message}`,
      };
    }
  },
});
