import type { UIMessage } from "@convex-dev/agent/react";
import type { FileUIPart } from "ai";

import type { Id } from "@/convex/_generated/dataModel";

export type VisualizationMessage = {
  _id: Id<"aiVisualizationMessages">;
  _creationTime: number;
  role: "user" | "model";
  text: string;
  messageIndex: number;
  imageStorageKey?: string;
  imageMimeType?: string;
  imageUrl?: string;
  referenceImages?: Array<{
    storageKey: string;
    mimeType: string;
    name: string;
    imageUrl?: string;
  }>;
};

export type VisualizationSession = {
  _id: Id<"aiVisualizationSessions">;
  title?: string;
  lastMessageAt: number;
  messageCount: number;
  imageCount: number;
};

export type VisualizationLightboxState = {
  url: string;
  prompt: string;
};

export type VisualizationSuggestion = {
  text: string;
  image: string;
};

export type VisualizationDisplayMessage = {
  raw: VisualizationMessage;
  mapped: UIMessage;
};

export type VisualizationComposerPayload = {
  text: string;
  files: FileUIPart[];
};
