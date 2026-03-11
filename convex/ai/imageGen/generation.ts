"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import {
  calculateGeminiFlashImageCostUsd,
  usdToCredits,
} from "../billing";
import { IMAGE_GENERATION_CONFIG } from "./config";
import { aiDebugLog } from "../helpers/debugLog";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const apiAny = require("../../_generated/api").api as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const internalAny = require("../../_generated/api").internal as any;

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
  imageStorageKey: v.optional(v.string()), // For handling large images via storage
});

/**
 * Generate architectural visualization using Gemini API with chat history
 */
// Reference image type
const referenceImageValidator = v.object({
  base64: v.optional(v.string()),
  storageKey: v.optional(v.string()),
  mimeType: v.string(),
  name: v.string(),
});

const DEFAULT_MOODBOARD_SECTION_KEY = "1";
const DEFAULT_MOODBOARD_SECTION_LABEL = "CONCEPT";

const normalizeMoodboardSection = (section?: string) => {
  const normalized = section?.trim();
  if (!normalized) {
    return {
      key: DEFAULT_MOODBOARD_SECTION_KEY,
      label: DEFAULT_MOODBOARD_SECTION_LABEL,
    };
  }

  const lower = normalized.toLowerCase();
  if (["1", "concept", "concepts", "inspiration"].includes(lower)) {
    return {
      key: DEFAULT_MOODBOARD_SECTION_KEY,
      label: DEFAULT_MOODBOARD_SECTION_LABEL,
    };
  }

  if (["2", "detail", "details", "materials", "finishes"].includes(lower)) {
    return {
      key: "2",
      label: "DETAILS",
    };
  }

  return {
    key: normalized,
    label: normalized.toUpperCase(),
  };
};

const buildMoodboardFileName = (sectionLabel: string, mimeType?: string) => {
  const extension = (mimeType || "image/png").split("/")[1] || "png";
  const baseName = sectionLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${baseName || "moodboard"}-${Date.now()}.${extension}`;
};

export const generateVisualization = action({
  args: {
    prompt: v.string(),
    referenceImages: v.optional(v.array(referenceImageValidator)),
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    sessionId: v.optional(v.id("aiVisualizationSessions")),
    history: v.optional(v.array(historyMessageValidator)),
  },
  returns: v.object({
    success: v.boolean(),
    imageBase64: v.optional(v.string()),
    imageStorageKey: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    textResponse: v.optional(v.string()),
    error: v.optional(v.string()),
    generationId: v.optional(v.id("aiGeneratedImages")),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    imageBase64?: string;
    imageStorageKey?: string;
    fileUrl?: string;
    mimeType?: string;
    textResponse?: string;
    error?: string;
    generationId?: Id<"aiGeneratedImages">;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured. Please add it to your environment variables.",
      };
    }

    // Determine access scope and ID
    let aiAccess;

    if (args.projectId) {
      aiAccess = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      });
      // We still need teamId for later if not returned by checkAIFeatureAccessByProject (it isn't directly, but accessible via getContextInfo)
    } else if (args.teamId) {
      aiAccess = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccess, {
        teamId: args.teamId,
      });
    } else {
      return {
        success: false,
        error: "Either projectId or teamId must be provided.",
      };
    }

    if (!aiAccess.allowed) {
      return {
        success: false,
        error: aiAccess.message || "AI features are unavailable.",
      };
    }

    const startTime = Date.now();
    
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Build contents array - single turn only
      type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
      type ContentItem = { role: "user" | "model"; parts: Part[] };
      
      const contents: ContentItem[] = [];
      
      // Helper to resolve image data (base64) from storage key if needed
      const resolveImage = async (storageKey?: string, base64?: string): Promise<string | null> => {
        if (base64) return base64;
        if (!storageKey) return null;

        try {
          // Get signed URL for the file
          const url: string | null = await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
            fileKey: storageKey,
          });
          
          if (!url) return null;
          
          // Fetch file content
          const response = await fetch(url);
          if (!response.ok) return null;
          
          const buffer = await response.arrayBuffer();
          return Buffer.from(buffer).toString("base64");
        } catch (error) {
          console.error("Error fetching image from storage:", error);
          return null;
        }
      };
      
      // Find the last generated image from history to use as context
      let lastGeneratedImage: { base64: string; mimeType: string } | null = null;
      let conversationContext = "";
      
      if (args.history && args.history.length > 0) {
        // Build conversation context summary
        const contextParts: string[] = [];
        for (const msg of args.history) {
          if (msg.role === "user") {
            contextParts.push(`User requested: "${msg.text}"`);
          } else if (msg.role === "model") {
            const hasImage = msg.imageBase64 || msg.imageStorageKey;
            if (hasImage && msg.imageMimeType) {
              contextParts.push("AI generated an image based on this request.");
              // Keep track of the last generated image
              const base64 = await resolveImage(msg.imageStorageKey, msg.imageBase64);
              if (base64) {
                lastGeneratedImage = {
                  base64,
                  mimeType: msg.imageMimeType,
                };
              }
            }
          }
        }
        if (contextParts.length > 0) {
          conversationContext = "Previous conversation:\n" + contextParts.join("\n") + "\n\nNow: ";
        }
      }
      
      // Build current user message parts
      const userPrompt = conversationContext 
        ? `${conversationContext}${args.prompt}`
        : args.prompt;
      const enhancedPrompt = `${IMAGE_GENERATION_CONFIG.SYSTEM_PROMPT}\n\n${userPrompt}`;
      
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
          const base64 = await resolveImage(img.storageKey, img.base64);
          if (base64) {
            currentParts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: base64,
                },
            });
          }
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
      aiDebugLog("=== GEMINI IMAGE GENERATION (Chat Mode) ===");
      aiDebugLog("Model:", IMAGE_GENERATION_CONFIG.MODEL_ID);
      aiDebugLog("User prompt:", args.prompt);
      aiDebugLog("History length:", args.history?.length || 0, "messages");
      aiDebugLog("Reference images:", args.referenceImages?.length || 0);
      aiDebugLog("Duration:", duration, "ms");
      aiDebugLog("Prompt tokens:", usageMetadata?.promptTokenCount || "N/A");
      aiDebugLog("Response tokens:", usageMetadata?.candidatesTokenCount || "N/A");
      aiDebugLog("Total tokens:", usageMetadata?.totalTokenCount || "N/A");
      aiDebugLog("============================================");

      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          error: "No response generated from Gemini API",
        };
      }

      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      const totalTokens =
        usageMetadata?.totalTokenCount ?? (inputTokens + outputTokens);
      const estimatedCostUsd = calculateGeminiFlashImageCostUsd(
        inputTokens,
        outputTokens
      );
      const estimatedCostCents = Math.round(estimatedCostUsd * 100);
      const billableTokens = usdToCredits(estimatedCostUsd);

      let contextInfo: {
        teamId: Id<"teams">;
        teamSlug: string;
        projectSlug?: string;
        projectId?: Id<"projects">;
      } | null = null;

      try {
        contextInfo = await ctx.runQuery(internalAny.ai.imageGen.helpers.getContextInfo, {
          projectId: args.projectId,
          teamId: args.teamId,
        });

        if (contextInfo) {
          const identity = await ctx.auth.getUserIdentity();
          const userClerkId = identity?.subject || "anonymous";

          await ctx.runMutation(internalAny.ai.usage.saveTokenUsage, {
            projectId: contextInfo.projectId,
            teamId: contextInfo.teamId,
            userClerkId,
            model: IMAGE_GENERATION_CONFIG.MODEL_ID,
            feature: "visualizations",
            requestType: "other",
            inputTokens,
            outputTokens,
            totalTokens,
            billableTokens,
            contextSize: args.history?.length || 0,
            mode: "visualization",
            estimatedCostCents,
            responseTimeMs: duration,
            success: true,
          });
        }
      } catch (error) {
        console.error("Failed to log visualization token usage:", error);
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
      aiDebugLog("Generated image size:", imageSizeKB, "KB");
      aiDebugLog("Image MIME type:", mimeType);

      // --- AUTO-UPLOAD TO STORAGE ---
      let imageStorageKey: string | undefined;
      let fileUrl: string | undefined;
      let generationId: Id<"aiGeneratedImages"> | undefined;

      try {
        if (contextInfo) {
          const binaryData = Buffer.from(imageBase64, "base64");
          const extension = (mimeType || "image/png").split("/")[1] || "png";
          const uuid = crypto.randomUUID();
          const fileName = `generated-${Date.now()}`;
          // Use "global" folder if no project slug
          const locationSlug = contextInfo.projectSlug || "global";
          const fileKey = `${contextInfo.teamSlug}/${locationSlug}/ai-visualizations/${uuid}-${fileName}.${extension}`;

          // Generate upload URL
          const uploadData: { url: string } = await ctx.runMutation(internalAny.ai.imageGen.helpers.generateR2UploadUrl, {
            key: fileKey,
          });

          // Upload to R2
          const uploadResponse = await fetch(uploadData.url, {
            method: "PUT",
            body: binaryData,
            headers: {
              "Content-Type": mimeType || "image/png",
            },
          });

          if (uploadResponse.ok) {
            // Only store the key for chat context - don't create file record yet
            // File record will be created only when user clicks "Save"
            imageStorageKey = fileKey;

            // Get signed URL for immediate display
            const url: string | null = await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
              fileKey,
            });
            if (url) fileUrl = url;

            // Log successful generation to database
            const identity = await ctx.auth.getUserIdentity();
            const userClerkId = identity?.subject || "anonymous";

            const loggedGenerationId = await ctx.runMutation(internalAny.ai.imageGen.helpers.logImageGeneration, {
              projectId: contextInfo.projectId,
              teamId: contextInfo.teamId,
              userClerkId,
              sessionId: args.sessionId,
              prompt: args.prompt,
              model: IMAGE_GENERATION_CONFIG.MODEL_ID,
              storageKey: fileKey,
              fileUrl: url || undefined,
              mimeType: mimeType || "image/png",
              sizeBytes: binaryData.length,
              durationMs: duration,
              promptTokens: usageMetadata?.promptTokenCount,
              responseTokens: usageMetadata?.candidatesTokenCount,
              totalTokens,
              billableTokens,
              estimatedCostCents,
              referenceImageCount: args.referenceImages?.length || 0,
              textResponse,
              success: true,
            });

            // Add model message to session if sessionId provided
            if (args.sessionId) {
              await ctx.runMutation(internalAny.ai.visualizationSessions.addModelMessage, {
                sessionId: args.sessionId,
                text: textResponse?.trim() || "Generated image.",
                imageStorageKey: fileKey,
                imageMimeType: mimeType || "image/png",
                imageUrl: url || undefined,
                generationId: loggedGenerationId,
              });
            }

            // Store for return
            generationId = loggedGenerationId;
          } else {
            console.error("Failed to auto-upload generated image:", uploadResponse.status);
          }
        }
      } catch (uploadError) {
        console.error("Error auto-uploading generated image:", uploadError);
      }

      // If we have a fileUrl, don't return base64 to avoid exceeding 1MB response limit
      // The client can fetch the image via the URL
      return {
        success: true,
        imageBase64: fileUrl ? undefined : imageBase64, // Only return base64 if no URL available
        imageStorageKey, // Return key for history
        fileUrl, // Return URL if available
        mimeType: mimeType || "image/png",
        textResponse,
        generationId,
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      
      // Log failed generation
      try {
        const contextInfo = await ctx.runQuery(internalAny.ai.imageGen.helpers.getContextInfo, {
          projectId: args.projectId,
          teamId: args.teamId,
        });
        if (contextInfo) {
          const identity = await ctx.auth.getUserIdentity();
          const userClerkId = identity?.subject || "anonymous";
          
          await ctx.runMutation(internalAny.ai.imageGen.helpers.logImageGeneration, {
            projectId: contextInfo.projectId,
            teamId: contextInfo.teamId,
            userClerkId,
            prompt: args.prompt,
            model: IMAGE_GENERATION_CONFIG.MODEL_ID,
            mimeType: "unknown",
            durationMs: Date.now() - startTime,
            referenceImageCount: args.referenceImages?.length || 0,
            error: (error as Error).message,
            success: false,
          });
        }
      } catch {
        // Ignore logging errors
      }
      
      return {
        success: false,
        error: `Failed to generate visualization: ${(error as Error).message}`,
      };
    }
  },
});

export const generateMoodboardImageForAssistant = action({
  args: {
    prompt: v.string(),
    projectId: v.id("projects"),
    section: v.optional(v.string()),
    userClerkId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    imageUrl: v.optional(v.string()),
    fileId: v.optional(v.id("files")),
    fileName: v.optional(v.string()),
    sectionKey: v.string(),
    sectionLabel: v.string(),
    model: v.string(),
    markdown: v.optional(v.string()),
    message: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    imageUrl?: string;
    fileId?: Id<"files">;
    fileName?: string;
    sectionKey: string;
    sectionLabel: string;
    model: string;
    markdown?: string;
    message?: string;
    error?: string;
  }> => {
    const section = normalizeMoodboardSection(args.section);

    const generation = await ctx.runAction(
      apiAny.ai.imageGen.generation.generateVisualization,
      {
        prompt: args.prompt,
        projectId: args.projectId,
      },
    );

    if (!generation?.success) {
      return {
        success: false,
        sectionKey: section.key,
        sectionLabel: section.label,
        model: IMAGE_GENERATION_CONFIG.MODEL_ID,
        error: generation?.error || "Image generation failed",
      };
    }

    if (!generation.imageStorageKey) {
      return {
        success: false,
        sectionKey: section.key,
        sectionLabel: section.label,
        model: IMAGE_GENERATION_CONFIG.MODEL_ID,
        error: "Generated image is missing a storage key",
      };
    }

    const fileName = buildMoodboardFileName(section.label, generation.mimeType);
    const imageByteSize = generation.imageBase64
      ? Buffer.from(generation.imageBase64, "base64").length
      : undefined;

    const fileId = await ctx.runMutation(
      internalAny.files.saveGeneratedMoodboardImageInternal,
      {
        projectId: args.projectId,
        fileKey: generation.imageStorageKey,
        fileName,
        mimeType: generation.mimeType || "image/png",
        fileSize: imageByteSize,
        moodboardSection: section.key,
        uploadedBy: args.userClerkId || "assistant",
        aiPrompt: args.prompt,
        generationId: generation.generationId,
      },
    );

    const imageUrl =
      generation.fileUrl ||
      (await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
        fileKey: generation.imageStorageKey,
      })) ||
      undefined;

    return {
      success: true,
      imageUrl,
      fileId,
      fileName,
      sectionKey: section.key,
      sectionLabel: section.label,
      model: IMAGE_GENERATION_CONFIG.MODEL_ID,
      markdown: imageUrl
        ? `![${section.label} moodboard image](${imageUrl})`
        : undefined,
      message: `Saved a new image to the ${section.label} moodboard section.`,
    };
  },
});

/**
 * Generate upload URL for reference images (public action)
 */
export const getUploadUrl = action({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
    fileName: v.string(),
    fileType: v.string(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; key: string }> => {
    // Get context info to construct key
    const context: {
      teamId: Id<"teams">;
      teamSlug: string;
      projectSlug?: string;
    } | null = await ctx.runQuery(internalAny.ai.imageGen.helpers.getContextInfo, {
      projectId: args.projectId,
      teamId: args.teamId,
    });

    if (!context) throw new Error("Context (project or team) not found");

    const extension = args.fileName.includes('.')
      ? args.fileName.split('.').pop()
      : args.fileType.split('/')[1] || '';

    const uuid = crypto.randomUUID();
    const baseName = args.fileName.replace(/\.[^/.]+$/, "");
    const locationSlug = context.projectSlug || "global";
    const fileKey = `${context.teamSlug}/${locationSlug}/ai-visualizations/references/${uuid}-${baseName}.${extension}`;

    const uploadData: { url: string } = await ctx.runMutation(internalAny.ai.imageGen.helpers.generateR2UploadUrl, {
      key: fileKey,
    });

    return {
      url: uploadData.url,
      key: fileKey,
    };
  },
});

/**
 * Get generated images gallery
 */
export const getGallery = action({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiGeneratedImages"),
      _creationTime: v.number(),
      url: v.union(v.string(), v.null()),
      prompt: v.string(),
      storageKey: v.optional(v.string()),
      mimeType: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"aiGeneratedImages">;
    _creationTime: number;
    url: string | null;
    prompt: string;
    storageKey?: string;
    mimeType?: string;
  }>> => {
    const images = await ctx.runQuery(internalAny.ai.imageGen.helpers.getGeneratedImagesGallery, {
      projectId: args.projectId,
      teamId: args.teamId,
    });

    // Generate fresh URLs for all images
    const imagesWithUrls = await Promise.all(
      images.map(async (img: {
        _id: Id<"aiGeneratedImages">;
        _creationTime: number;
        prompt: string;
        storageKey?: string;
        mimeType?: string;
      }) => {
        let url: string | null = null;
        if (img.storageKey) {
          url = await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
            fileKey: img.storageKey,
          });
        }
        return {
          _id: img._id,
          _creationTime: img._creationTime,
          url,
          prompt: img.prompt,
          storageKey: img.storageKey,
          mimeType: img.mimeType,
        };
      })
    );

    return imagesWithUrls;
  },
});

/**
 * Delete generated image
 */
export const deleteGeneration = action({
  args: {
    generationId: v.id("aiGeneratedImages"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(internalAny.ai.imageGen.helpers.deleteGeneratedImage, {
        generationId: args.generationId,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
