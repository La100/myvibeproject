"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import { aiDebugLog } from "../helpers/debugLog";

/**
 * Video Generation using Google Veo 3.1 model
 * Generates videos from text prompts or images
 */

const VIDEO_GENERATION_CONFIG = {
  MODEL_ID: "veo-3.1-generate-preview",
  POLL_INTERVAL_MS: 10000, // 10 seconds
  MAX_POLL_ATTEMPTS: 60, // Max 10 minutes of waiting
};

/**
 * Generate video using Veo 3.1 API
 */
export const generateVideo = action({
  args: {
    prompt: v.string(),
    sourceImageBase64: v.optional(v.string()),
    sourceImageMimeType: v.optional(v.string()),
    sourceImageStorageKey: v.optional(v.string()),
    projectId: v.id("projects"),
    aspectRatio: v.optional(v.string()), // "16:9", "9:16", "1:1"
  },
  returns: v.object({
    success: v.boolean(),
    videoUrl: v.optional(v.string()),
    videoStorageKey: v.optional(v.string()),
    error: v.optional(v.string()),
    status: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    videoUrl?: string;
    videoStorageKey?: string;
    error?: string;
    status?: string;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured. Please add it to your environment variables.",
      };
    }

    const aiAccess = await ctx.runQuery(internal.stripe.checkAIFeatureAccessByProject, {
      projectId: args.projectId,
    });

    if (!aiAccess.allowed) {
      return {
        success: false,
        error: aiAccess.message || "AI features are unavailable for this project.",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const startTime = Date.now();

      aiDebugLog("=== VEO VIDEO GENERATION ===");
      aiDebugLog("Model:", VIDEO_GENERATION_CONFIG.MODEL_ID);
      aiDebugLog("Prompt:", args.prompt);
      aiDebugLog("Has source image:", !!(args.sourceImageBase64 || args.sourceImageStorageKey));
      aiDebugLog("Aspect Ratio:", args.aspectRatio || "default");

      // Resolve source image if provided via storage key
      let imageData: { base64: string; mimeType: string } | undefined;
      
      if (args.sourceImageStorageKey) {
        try {
          const url: string | null = await ctx.runQuery(internal.ai.imageGen.helpers.getFileUrl, {
            fileKey: args.sourceImageStorageKey,
          });
          
          if (url) {
            const response = await fetch(url);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              imageData = {
                base64: Buffer.from(buffer).toString("base64"),
                mimeType: args.sourceImageMimeType || "image/png",
              };
            }
          }
        } catch (error) {
          console.error("Error fetching source image from storage:", error);
        }
      } else if (args.sourceImageBase64 && args.sourceImageMimeType) {
        imageData = {
          base64: args.sourceImageBase64,
          mimeType: args.sourceImageMimeType,
        };
      }

      // Start video generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let operation: any;
      
      // Configuration for generation
      const generationConfig: any = {};
      if (args.aspectRatio) {
        generationConfig.aspectRatio = args.aspectRatio;
      }

      if (imageData) {
        // Image-to-video generation
        operation = await ai.models.generateVideos({
          model: VIDEO_GENERATION_CONFIG.MODEL_ID,
          prompt: args.prompt,
          image: {
            imageBytes: imageData.base64,
            mimeType: imageData.mimeType,
          },
          config: generationConfig,
        });
      } else {
        // Text-to-video generation
        operation = await ai.models.generateVideos({
          model: VIDEO_GENERATION_CONFIG.MODEL_ID,
          prompt: args.prompt,
          config: generationConfig,
        });
      }

      aiDebugLog("Video generation started, polling for completion...");

      // Poll for completion
      let pollCount = 0;
      while (!operation.done && pollCount < VIDEO_GENERATION_CONFIG.MAX_POLL_ATTEMPTS) {
        aiDebugLog(`Polling attempt ${pollCount + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, VIDEO_GENERATION_CONFIG.POLL_INTERVAL_MS));
        
        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });
        
        pollCount++;
      }

      const duration = Date.now() - startTime;
      aiDebugLog("Duration:", duration, "ms");

      if (!operation.done) {
        return {
          success: false,
          error: "Video generation timed out. Please try again.",
          status: "timeout",
        };
      }

      // Check for errors in operation
      if (operation.error) {
        return {
          success: false,
          error: `Video generation failed: ${operation.error.message || "Unknown error"}`,
          status: "error",
        };
      }

      // Get generated video
      const generatedVideos = operation.response?.generatedVideos;
      if (!generatedVideos || generatedVideos.length === 0) {
        return {
          success: false,
          error: "No video was generated.",
          status: "no_video",
        };
      }

      const videoFile = generatedVideos[0].video;
      aiDebugLog("Video generated successfully!");

      // Get project info for storage path
      const projectInfo: {
        teamId: Id<"teams">;
        teamSlug: string;
        projectSlug: string;
      } | null = await ctx.runQuery(internal.ai.imageGen.helpers.getProjectInfo, {
        projectId: args.projectId,
      });

      if (!projectInfo) {
        return {
          success: false,
          error: "Project not found",
        };
      }

      // Download video to buffer and upload to R2
      const uuid = crypto.randomUUID();
      const fileName = `video-${Date.now()}`;
      const fileKey = `${projectInfo.teamSlug}/${projectInfo.projectSlug}/ai-videos/${uuid}-${fileName}.mp4`;

      try {
        // Get video URI and fetch content
        // The video file object contains a uri property we can fetch from
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videoUri = (videoFile as any).uri || (videoFile as any).url;
        
        if (!videoUri) {
          console.error("Video file object:", JSON.stringify(videoFile, null, 2));
          throw new Error("Could not find video URI in response");
        }

        aiDebugLog("Fetching video from:", videoUri);
        
        // Fetch the video content from Google's servers
        // The URL requires API key authentication
        const videoFetchUrl = videoUri.includes('?') 
          ? `${videoUri}&key=${apiKey}` 
          : `${videoUri}?key=${apiKey}`;
        
        const videoResponse = await fetch(videoFetchUrl);
        if (!videoResponse.ok) {
          const errorText = await videoResponse.text();
          console.error("Video fetch error:", errorText);
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }

        const videoArrayBuffer = await videoResponse.arrayBuffer();
        const videoBuffer = Buffer.from(videoArrayBuffer);
        const videoSize = videoBuffer.length;
        aiDebugLog("Downloaded video size:", Math.round(videoSize / 1024), "KB");

        // Upload to R2
        const uploadData: { url: string } = await ctx.runMutation(internal.ai.imageGen.helpers.generateR2UploadUrl, {
          key: fileKey,
        });

        const uploadResponse = await fetch(uploadData.url, {
          method: "PUT",
          body: videoBuffer,
          headers: {
            "Content-Type": "video/mp4",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        // Create file record
        await ctx.runMutation(internal.ai.imageGen.helpers.createFileRecord, {
          projectId: args.projectId,
          teamId: projectInfo.teamId,
          fileName: `${fileName}.mp4`,
          fileKey,
          mimeType: "video/mp4",
          size: videoSize,
          description: `AI Generated Video: ${args.prompt.substring(0, 200)}`,
        });

        // Get signed URL
        const videoUrl: string | null = await ctx.runQuery(internal.ai.imageGen.helpers.getFileUrl, {
          fileKey,
        });

        aiDebugLog("Video uploaded to storage successfully!");
        aiDebugLog("============================================");

        return {
          success: true,
          videoUrl: videoUrl || undefined,
          videoStorageKey: fileKey,
          status: "completed",
        };
      } catch (downloadError) {
        console.error("Error downloading/uploading video:", downloadError);
        return {
          success: false,
          error: `Failed to save video: ${(downloadError as Error).message}`,
          status: "save_error",
        };
      }
    } catch (error) {
      console.error("Error calling Veo API:", error);
      return {
        success: false,
        error: `Failed to generate video: ${(error as Error).message}`,
      };
    }
  },
});
