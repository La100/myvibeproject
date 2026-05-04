"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import OpenAI, { toFile } from "openai";
import {
  calculateGptImageCostUsd,
  usdToCredits,
} from "../billing";
import { IMAGE_GENERATION_CONFIG } from "./config";
import { aiDebugLog } from "../helpers/debugLog";
import { fetchRemoteUrlPinned } from "../../../lib/security/remoteUrlSafety";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const apiAny = require("../../_generated/api").api as any;
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const internalAny = require("../../_generated/api").internal as any;

/**
 * OpenAI image generation for architectural visualizations.
 * Uses GPT Image with image edits when prior or reference images are present.
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
 * Generate architectural visualization using GPT Image with chat history
 */
// Reference image type
const referenceImageValidator = v.object({
  base64: v.optional(v.string()),
  storageKey: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  name: v.string(),
});

const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCE_REDIRECTS = 3;

const DEFAULT_TEXT_ONLY_FAILURE =
  "No image was generated. The model may have returned only text.";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Please add it to your environment variables.");
  }

  return new OpenAI({ apiKey });
};

const fileExtensionForMimeType = (mimeType?: string) => {
  const normalized = mimeType?.split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  return "png";
};

const toImageFile = async (
  image: { data: string; mimeType: string },
  name: string,
) =>
  toFile(Buffer.from(image.data, "base64"), name, {
    type: image.mimeType,
  });

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
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return {
        success: false,
        error: "OPENAI_API_KEY is not configured. Please add it to your environment variables.",
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
      const client = getOpenAIClient();
      
      // Helper to resolve image data (base64) from storage key if needed
      const fetchRemoteImage = async (
        inputUrl: string,
        fallbackMimeType?: string,
        redirectCount: number = 0,
      ): Promise<{ data: string; mimeType: string } | null> => {
        try {
          const parsedUrl = new URL(inputUrl);
          const response = await fetchRemoteUrlPinned(parsedUrl, {
            maxBytes: MAX_REFERENCE_IMAGE_BYTES,
            timeoutMs: 10_000,
            blockedHostMessage: "Blocked reference image host",
            unresolvedHostMessage: "Unable to resolve reference image host",
          });

          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location || redirectCount >= MAX_REFERENCE_REDIRECTS) {
              return null;
            }

            const nextUrl = new URL(location, parsedUrl);
            return fetchRemoteImage(nextUrl.toString(), fallbackMimeType, redirectCount + 1);
          }

          if (response.status < 200 || response.status >= 300) {
            return null;
          }

          const mimeType =
            response.headers.get("content-type")?.split(";")[0].trim() ||
            fallbackMimeType ||
            "";

          if (!mimeType.startsWith("image/")) {
            return null;
          }

          const contentLength = Number(response.headers.get("content-length"));
          if (Number.isFinite(contentLength) && contentLength > MAX_REFERENCE_IMAGE_BYTES) {
            return null;
          }

          if (response.body.byteLength > MAX_REFERENCE_IMAGE_BYTES) {
            return null;
          }

          return {
            data: response.body.toString("base64"),
            mimeType,
          };
        } catch (error) {
          console.error("Error fetching remote reference image:", error);
          return null;
        }
      };

      const resolveImage = async ({
        storageKey,
        base64,
        imageUrl,
        mimeType,
      }: {
        storageKey?: string;
        base64?: string;
        imageUrl?: string;
        mimeType?: string;
      }): Promise<{ data: string; mimeType: string } | null> => {
        if (base64) {
          return {
            data: base64,
            mimeType: mimeType?.trim() || "image/png",
          };
        }

        if (storageKey) {
          try {
            const url: string | null = await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
              fileKey: storageKey,
            });

            if (!url) return null;
            return fetchRemoteImage(url, mimeType);
          } catch (error) {
            console.error("Error fetching image from storage:", error);
            return null;
          }
        }

        if (imageUrl) {
          return fetchRemoteImage(imageUrl, mimeType);
        }

        return null;
      };
      
      // Find the last generated image from history to use as edit context.
      let lastGeneratedImage: { data: string; mimeType: string } | null = null;
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
              const resolvedImage = await resolveImage({
                storageKey: msg.imageStorageKey,
                base64: msg.imageBase64,
                mimeType: msg.imageMimeType,
              });
              if (resolvedImage) {
                lastGeneratedImage = resolvedImage;
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
      
      const editImages: Array<{ data: string; mimeType: string; name: string }> = [];
      if (lastGeneratedImage) {
        editImages.push({
          ...lastGeneratedImage,
          name: `previous.${fileExtensionForMimeType(lastGeneratedImage.mimeType)}`,
        });
      }
      
      // Add user-provided reference images
      if (args.referenceImages && args.referenceImages.length > 0) {
        let resolvedReferenceImageCount = 0;
        for (const [index, img] of args.referenceImages.entries()) {
          const resolvedImage = await resolveImage({
            storageKey: img.storageKey,
            base64: img.base64,
            imageUrl: img.imageUrl,
            mimeType: img.mimeType,
          });
          if (resolvedImage) {
            resolvedReferenceImageCount += 1;
            editImages.push({
              ...resolvedImage,
              name: img.name || `reference-${index + 1}.${fileExtensionForMimeType(resolvedImage.mimeType)}`,
            });
          }
        }

        if (resolvedReferenceImageCount === 0) {
          return {
            success: false,
            error: "Could not load any valid reference images for generation.",
          };
        }
      }
      const identity = await ctx.auth.getUserIdentity();
      const imageRequestBase = {
        model: IMAGE_GENERATION_CONFIG.MODEL_ID,
        prompt: enhancedPrompt,
        n: 1,
        size: IMAGE_GENERATION_CONFIG.SIZE,
        quality: IMAGE_GENERATION_CONFIG.QUALITY,
        output_format: IMAGE_GENERATION_CONFIG.OUTPUT_FORMAT,
        user: identity?.subject,
      };

      const response =
        editImages.length > 0
          ? await client.images.edit({
              ...imageRequestBase,
              image: await Promise.all(
                editImages.map((image) =>
                  toImageFile(
                    image,
                    image.name.includes(".")
                      ? image.name
                      : `${image.name}.${fileExtensionForMimeType(image.mimeType)}`,
                  ),
                ),
              ),
            } as never)
          : await client.images.generate(imageRequestBase as never);

      const duration = Date.now() - startTime;

      // Log usage information
      const usageMetadata = response.usage;
      aiDebugLog("=== OPENAI IMAGE GENERATION (Chat Mode) ===");
      aiDebugLog("Model:", IMAGE_GENERATION_CONFIG.MODEL_ID);
      aiDebugLog("User prompt:", args.prompt);
      aiDebugLog("History length:", args.history?.length || 0, "messages");
      aiDebugLog("Reference images:", args.referenceImages?.length || 0);
      aiDebugLog("Duration:", duration, "ms");
      aiDebugLog("Input tokens:", usageMetadata?.input_tokens || "N/A");
      aiDebugLog("Output tokens:", usageMetadata?.output_tokens || "N/A");
      aiDebugLog("Total tokens:", usageMetadata?.total_tokens || "N/A");
      aiDebugLog("============================================");

      if (!response.data || response.data.length === 0) {
        return {
          success: false,
          error: "No response generated from OpenAI Images API",
        };
      }

      const inputTokens = usageMetadata?.input_tokens || 0;
      const outputTokens = usageMetadata?.output_tokens || 0;
      const totalTokens =
        usageMetadata?.total_tokens ?? (inputTokens + outputTokens);
      const estimatedCostUsd = calculateGptImageCostUsd(
        inputTokens,
        outputTokens
      );
      const estimatedCostCents = Math.round(estimatedCostUsd * 100);
      const billableTokens = usdToCredits(estimatedCostUsd);
      let usageRecordId: Id<"aiTokenUsage"> | undefined;

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
      } catch (error) {
        console.error("Failed to resolve visualization storage context:", error);
      }

      const imageBase64 = response.data[0]?.b64_json;
      const mimeType = IMAGE_GENERATION_CONFIG.OUTPUT_MIME_TYPE;
      const cleanedTextResponse = undefined;

      if (!imageBase64) {
        if (args.sessionId && cleanedTextResponse) {
          await ctx.runMutation(internalAny.ai.visualizationSessions.addModelMessage, {
            sessionId: args.sessionId,
            text: cleanedTextResponse,
          });
        }

        return {
          success: false,
          error: cleanedTextResponse || DEFAULT_TEXT_ONLY_FAILURE,
          textResponse: cleanedTextResponse,
        };
      }

      if (!contextInfo) {
        return {
          success: false,
          error: "Generated image could not be stored because the team or project context was not found.",
          textResponse: cleanedTextResponse,
        };
      }

      const userClerkId = identity?.subject || "anonymous";

      try {
        usageRecordId = await ctx.runMutation(internalAny.ai.usage.saveTokenUsage, {
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
      } catch (error) {
        console.error("Failed to log visualization token usage:", error);
      }

      // Log image info
      const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
      aiDebugLog("Generated image size:", imageSizeKB, "KB");
      aiDebugLog("Image MIME type:", mimeType);

      // --- AUTO-UPLOAD TO STORAGE ---
      let imageStorageKey: string | undefined;
      let fileUrl: string | undefined;
      let generationId: Id<"aiGeneratedImages"> | undefined;
      let sessionMessageSaved = !args.sessionId;
      let deliveryError: string | undefined;

      const refundUsageIfNeeded = async (reason: string) => {
        if (!usageRecordId) return true;
        try {
          await ctx.runMutation(internalAny.ai.usage.refundTokenUsage, {
            usageId: usageRecordId,
            errorMessage: reason,
          });
          return true;
        } catch (refundError) {
          console.error("Failed to refund visualization token usage:", refundError);
          return false;
        }
      };

      try {
        const binaryData = Buffer.from(imageBase64, "base64");
        const extension = (mimeType || "image/png").split("/")[1] || "png";
        const uuid = crypto.randomUUID();
        const fileName = `generated-${Date.now()}`;
        const locationSlug = contextInfo.projectSlug || "global";
        const fileKey = `${contextInfo.teamSlug}/${locationSlug}/ai-visualizations/${uuid}-${fileName}.${extension}`;

        const uploadData: { url: string } = await ctx.runMutation(internalAny.ai.imageGen.helpers.generateR2UploadUrl, {
          key: fileKey,
        });

        const uploadResponse = await fetch(uploadData.url, {
          method: "PUT",
          body: binaryData,
          headers: {
            "Content-Type": mimeType || "image/png",
          },
        });

        if (!uploadResponse.ok) {
          deliveryError = `Failed to upload generated image (${uploadResponse.status}).`;
        } else {
          imageStorageKey = fileKey;

          const url: string | null = await ctx.runQuery(internalAny.ai.imageGen.helpers.getFileUrl, {
            fileKey,
          });
          if (url) fileUrl = url;

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
            promptTokens: inputTokens,
            responseTokens: outputTokens,
            totalTokens,
            billableTokens,
            estimatedCostCents,
            referenceImageCount: args.referenceImages?.length || 0,
            textResponse: cleanedTextResponse,
            success: true,
          });

          generationId = loggedGenerationId;

          if (args.sessionId) {
            await ctx.runMutation(internalAny.ai.visualizationSessions.addModelMessage, {
              sessionId: args.sessionId,
              text: cleanedTextResponse || "Generated image.",
              imageStorageKey: fileKey,
              imageMimeType: mimeType || "image/png",
              imageUrl: url || undefined,
              generationId: loggedGenerationId,
            });
            sessionMessageSaved = true;
          }
        }
      } catch (uploadError) {
        console.error("Error auto-uploading generated image:", uploadError);
        deliveryError = (uploadError as Error).message || "Generated image could not be stored.";
      }

      const wasDelivered =
        Boolean(imageStorageKey && generationId) &&
        (!args.sessionId || sessionMessageSaved);

      if (!wasDelivered) {
        const errorMessage =
          deliveryError || "Generated image could not be stored.";
        const refundCompleted = await refundUsageIfNeeded(errorMessage);
        return {
          success: false,
          error: refundCompleted
            ? `${errorMessage} No AI credits were charged.`
            : `${errorMessage} AI credits may need manual correction.`,
          textResponse: cleanedTextResponse,
        };
      }

      // If we have a fileUrl, don't return base64 to avoid exceeding 1MB response limit
      // The client can fetch the image via the URL
      return {
        success: true,
        imageBase64: fileUrl ? undefined : imageBase64, // Only return base64 if no URL available
        imageStorageKey, // Return key for history
        fileUrl, // Return URL if available
        mimeType: mimeType || "image/png",
        textResponse: cleanedTextResponse,
        generationId,
      };
    } catch (error) {
      console.error("Error calling OpenAI Images API:", error);
      
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
    referenceImages: v.optional(v.array(referenceImageValidator)),
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
    const section = await ctx.runQuery(
      internalAny.ai.imageGen.helpers.resolveMoodboardSectionForGeneratedImage,
      {
        projectId: args.projectId,
        section: args.section,
      },
    );

    const generation = await ctx.runAction(
      apiAny.ai.imageGen.generation.generateVisualization,
      {
        prompt: args.prompt,
        projectId: args.projectId,
        referenceImages: args.referenceImages,
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
