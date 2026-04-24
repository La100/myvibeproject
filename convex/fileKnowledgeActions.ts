"use node";

import { createHash } from "node:crypto";

import { openai } from "@ai-sdk/openai";
import { RAG, defaultChunker } from "@convex-dev/rag";
import { makeFunctionReference } from "convex/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { v } from "convex/values";

import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { r2 } from "./files";

type FileKnowledgeFilters = {
  fileId: string;
  mimeType: string;
  fileType: string;
};

type FileKnowledgeMetadata = {
  fileId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  description?: string;
};

type StoredFileRecord = {
  _id: Id<"files">;
  projectId?: Id<"projects">;
  name: string;
  description?: string;
  mimeType: string;
  fileType: string;
  storageId: string;
  extractedText?: string;
  pdfAnalysis?: string;
  aiKnowledgeEnabled?: boolean;
};

type FileKnowledgeMatch = {
  fileId: string;
  fileName: string;
  description?: string;
  fileType?: string;
  mimeType?: string;
  url?: string;
  score: number;
  excerpt: string;
};

const projectFileKnowledge = new RAG<FileKnowledgeFilters, FileKnowledgeMetadata>(
  components.rag,
  {
    textEmbeddingModel: openai.embedding("text-embedding-3-small"),
    embeddingDimension: 1536,
    filterNames: ["fileId", "mimeType", "fileType"],
  },
);

const namespaceForProject = (projectId: string) => `project-files:${projectId}`;
const getFileByIdQueryRef = makeFunctionReference<
  "query",
  { fileId: Id<"files"> },
  StoredFileRecord | null
>("files:getFileByIdInternal");
const getProjectQueryRef = makeFunctionReference<
  "query",
  { projectId: Id<"projects"> },
  Record<string, unknown> | null
>("projects:getProject");
const getProjectAiKnowledgeFilesQueryRef = makeFunctionReference<
  "query",
  { projectId: Id<"projects"> },
  Array<Record<string, unknown>>
>("files:getProjectAiKnowledgeFiles");
const setFileAiKnowledgeStateMutationRef = makeFunctionReference<
  "mutation",
  {
    fileId: Id<"files">;
    status?: "excluded" | "pending" | "ready" | "failed";
    error?: string | null;
    entryId?: string | null;
    indexedAt?: number | null;
    extractedText?: string;
  },
  null
>("files:setFileAiKnowledgeStateInternal");

const isTextLikeMime = (mimeType: string, fileName: string) =>
  mimeType.startsWith("text/") ||
  mimeType.includes("application/json") ||
  mimeType.includes("application/xml") ||
  mimeType.includes("text/csv") ||
  fileName.endsWith(".md") ||
  fileName.endsWith(".txt") ||
  fileName.endsWith(".csv") ||
  fileName.endsWith(".json") ||
  fileName.endsWith(".xml");

const isPdf = (mimeType: string, fileName: string) =>
  mimeType === "application/pdf" || fileName.endsWith(".pdf");

const isDocx = (mimeType: string, fileName: string) =>
  mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  fileName.endsWith(".docx");

const normalizeText = (value: string | undefined | null) =>
  value?.replace(/\u0000/g, " ").replace(/\s+\n/g, "\n").trim() ?? "";

async function downloadFileBuffer(storageId: string): Promise<Buffer> {
  const url = await r2.getUrl(storageId, {
    expiresIn: 60 * 30,
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file contents (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractPrimaryText(file: StoredFileRecord): Promise<string> {
  const existingText = normalizeText(file.extractedText);
  if (existingText) return existingText;

  const buffer = await downloadFileBuffer(file.storageId);
  const normalizedName = file.name.toLowerCase();
  const normalizedMimeType = file.mimeType.toLowerCase();

  if (isPdf(normalizedMimeType, normalizedName)) {
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed.text);
  }

  if (isDocx(normalizedMimeType, normalizedName)) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  if (isTextLikeMime(normalizedMimeType, normalizedName)) {
    return normalizeText(buffer.toString("utf-8"));
  }

  return "";
}

function buildKnowledgeText(file: StoredFileRecord, extractedText: string) {
  const sections = [
    `File name: ${file.name}`,
    file.description ? `Description: ${file.description}` : undefined,
    `File type: ${file.fileType}`,
    file.mimeType ? `MIME type: ${file.mimeType}` : undefined,
    extractedText ? `Document text:\n${extractedText}` : undefined,
    normalizeText(file.pdfAnalysis) ? `Existing analysis:\n${normalizeText(file.pdfAnalysis)}` : undefined,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return sections.join("\n\n").trim();
}

export const searchProjectAiKnowledge = action({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    text: v.string(),
    matches: v.array(
      v.object({
        fileId: v.string(),
        fileName: v.string(),
        description: v.optional(v.string()),
        fileType: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        url: v.optional(v.string()),
        score: v.number(),
        excerpt: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(getProjectQueryRef, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("No access to this project");
    }

    const trimmedQuery = args.query.trim();
    if (!trimmedQuery) {
      return { ok: true, text: "", matches: [] };
    }

    const allowedFiles = (await ctx.runQuery(getProjectAiKnowledgeFilesQueryRef, {
      projectId: args.projectId,
    })) as Array<Record<string, unknown>>;

    if (allowedFiles.length === 0) {
      return { ok: true, text: "", matches: [] };
    }

    const namespace = await projectFileKnowledge.getNamespace(ctx, {
      namespace: namespaceForProject(String(args.projectId)),
    });
    if (!namespace) {
      return { ok: true, text: "", matches: [] };
    }

    const limit = Math.max(1, Math.min(args.limit ?? 6, 10));
    const { results, entries, text } = await projectFileKnowledge.search(ctx, {
      namespace: namespaceForProject(String(args.projectId)),
      query: trimmedQuery,
      limit,
      searchType: "hybrid",
      chunkContext: { before: 1, after: 1 },
      vectorScoreThreshold: 0.15,
    });

    const entryById = new Map(entries.map((entry) => [entry.entryId, entry]));
    const allowedFileById = new Map(
      allowedFiles
        .map((file) => {
          const fileId = typeof file._id === "string" ? file._id : undefined;
          return fileId ? ([fileId, file] as const) : null;
        })
        .filter(
          (entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry),
        ),
    );

    const matches = results
      .map((result): FileKnowledgeMatch | null => {
        const entry = entryById.get(result.entryId);
        const metadata = entry?.metadata;
        const fileId =
          metadata && typeof metadata.fileId === "string"
            ? metadata.fileId
            : undefined;
        if (!fileId) return null;

        const file = allowedFileById.get(fileId);
        if (!file) return null;

        return {
          fileId,
          fileName:
            typeof file.name === "string"
              ? file.name
              : metadata && typeof metadata.fileName === "string"
                ? metadata.fileName
                : "Untitled file",
          description:
            typeof file.description === "string" ? file.description : undefined,
          fileType:
            typeof file.fileType === "string"
              ? file.fileType
              : metadata && typeof metadata.fileType === "string"
                ? metadata.fileType
                : undefined,
          mimeType:
            typeof file.mimeType === "string"
              ? file.mimeType
              : metadata && typeof metadata.mimeType === "string"
                ? metadata.mimeType
                : undefined,
          url: typeof file.url === "string" ? file.url : undefined,
          score: result.score,
          excerpt: result.content.map((chunk) => chunk.text).join("\n\n").trim(),
        };
      })
      .filter((match): match is FileKnowledgeMatch => match !== null)
      .slice(0, limit);

    return {
      ok: true,
      text,
      matches,
    };
  },
});

export const indexProjectFileKnowledge = internalAction({
  args: {
    fileId: v.id("files"),
  },
  returns: v.object({
    ok: v.boolean(),
    status: v.union(
      v.literal("ready"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    entryId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const file = (await ctx.runQuery(getFileByIdQueryRef, {
      fileId: args.fileId,
    })) as StoredFileRecord | null;

    if (!file || !file.projectId || file.aiKnowledgeEnabled !== true) {
      return { ok: true, status: "skipped" as const };
    }

    const normalizedName = file.name.toLowerCase();
    const normalizedMimeType = file.mimeType.toLowerCase();
    if (!isPdf(normalizedMimeType, normalizedName)) {
      await ctx.runMutation(setFileAiKnowledgeStateMutationRef, {
        fileId: args.fileId,
        status: "failed",
        error: "AI knowledge is only available for PDF files",
      });
      return {
        ok: false,
        status: "failed" as const,
        error: "AI knowledge is only available for PDF files",
      };
    }

    try {
      await ctx.runMutation(setFileAiKnowledgeStateMutationRef, {
        fileId: args.fileId,
        status: "pending",
        error: null,
      });

      const extractedText = await extractPrimaryText(file);
      const knowledgeText = buildKnowledgeText(file, extractedText);

      if (!knowledgeText) {
        throw new Error(
          "This file does not contain readable text yet. Add a description or upload a text-based document.",
        );
      }

      const contentHash = createHash("sha256").update(knowledgeText).digest("hex");
      const chunks = defaultChunker(knowledgeText, {
        minCharsSoftLimit: 350,
        maxCharsSoftLimit: 1400,
        maxCharsHardLimit: 6000,
      });

      const result = await projectFileKnowledge.add(ctx, {
        namespace: namespaceForProject(String(file.projectId)),
        key: `file:${String(file._id)}`,
        title: file.name,
        chunks,
        contentHash,
        metadata: {
          fileId: String(file._id),
          projectId: String(file.projectId),
          fileName: file.name,
          mimeType: file.mimeType,
          fileType: file.fileType,
          description: file.description,
        },
        filterValues: [
          { name: "fileId", value: String(file._id) },
          { name: "mimeType", value: file.mimeType },
          { name: "fileType", value: file.fileType },
        ],
      });

      if (result.replacedEntry) {
        await projectFileKnowledge.delete(ctx, {
          entryId: result.replacedEntry.entryId,
        });
      }

      const latestFile = (await ctx.runQuery(getFileByIdQueryRef, {
        fileId: args.fileId,
      })) as StoredFileRecord | null;

      if (!latestFile || latestFile.aiKnowledgeEnabled !== true) {
        await projectFileKnowledge.delete(ctx, {
          entryId: result.entryId,
        });
        return { ok: true, status: "skipped" as const };
      }

      await ctx.runMutation(setFileAiKnowledgeStateMutationRef, {
        fileId: args.fileId,
        status: "ready",
        error: null,
        entryId: result.entryId,
        indexedAt: Date.now(),
        extractedText: extractedText ? extractedText.slice(0, 200000) : undefined,
      });

      return {
        ok: true,
        status: "ready" as const,
        entryId: result.entryId,
      };
    } catch (error) {
      const latestFile = (await ctx.runQuery(getFileByIdQueryRef, {
        fileId: args.fileId,
      })) as StoredFileRecord | null;

      if (latestFile?.aiKnowledgeEnabled === true) {
        await ctx.runMutation(setFileAiKnowledgeStateMutationRef, {
          fileId: args.fileId,
          status: "failed",
          error:
            error instanceof Error ? error.message : "Failed to index file for AI knowledge.",
        });
      }

      return {
        ok: false,
        status: "failed" as const,
        error:
          error instanceof Error ? error.message : "Failed to index file for AI knowledge.",
      };
    }
  },
});

export const removeProjectFileKnowledgeEntry = internalAction({
  args: {
    entryId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await projectFileKnowledge.delete(ctx, {
      entryId: args.entryId as never,
    });
    return null;
  },
});
