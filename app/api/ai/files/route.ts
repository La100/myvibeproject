import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import type { FunctionReference } from "convex/server";
import OpenAI from "openai";

const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/xml",
  "application/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "text/x-python",
  "text/typescript",
  "application/rtf",
  "text/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  jsonl: "text/plain",
  xml: "application/xml",
  html: "text/html",
  htm: "text/html",
  py: "text/x-python",
  js: "text/javascript",
  ts: "text/typescript",
  css: "text/css",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function normalizeMimeType(file: File): string {
  const raw = (file.type || "").trim().toLowerCase();
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? ""
    : "";
  const mappedFromExtension = EXTENSION_TO_MIME[extension];
  if (mappedFromExtension) return mappedFromExtension;
  if (raw) return raw;
  return "application/octet-stream";
}

function isSupportedFile(mimeType: string): boolean {
  if (SUPPORTED_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith("image/")) return true;
  return false;
}

function extractFirstFile(formData: FormData): File | null {
  for (const value of formData.values()) {
    if (value instanceof File) {
      return value;
    }
  }
  return null;
}

type ConvexQueryClient = {
  query: (
    ref: FunctionReference<"query">,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};

/**
 * Upload assistant attachments directly to OpenAI Files API.
 * This bypasses Cloudflare/R2 for AI chat attachments.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file") ?? extractFirstFile(formData);
    const rawProjectId = formData.get("projectId");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (fileValue.size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 32MB)" },
        { status: 400 },
      );
    }

    const normalizedMimeType = normalizeMimeType(fileValue);
    if (!isSupportedFile(normalizedMimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${normalizedMimeType}` },
        { status: 400 },
      );
    }

    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    // Use function references to avoid generated API type depth issues in route handlers.
    const getProjectRef = {
      _name: "projects:getProject",
    } as unknown as FunctionReference<"query">;
    const getCurrentUserTeamMemberRef = {
      _name: "teams:getCurrentUserTeamMember",
    } as unknown as FunctionReference<"query">;

    const convexQueryClient = convex as unknown as ConvexQueryClient;
    const providedProjectId =
      typeof rawProjectId === "string" && rawProjectId.trim().length > 0
        ? rawProjectId.trim()
        : null;

    if (!providedProjectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const project = (await convexQueryClient.query(getProjectRef, {
      projectId: providedProjectId,
    })) as { _id?: string; teamId?: string } | null;
    if (!project?.teamId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const membership = (await convexQueryClient.query(getCurrentUserTeamMemberRef, {
      teamId: project.teamId,
    })) as
      | { isActive?: boolean; role?: "admin" | "member" }
      | null;
    if (
      !membership ||
      membership.isActive === false ||
      (membership.role !== "admin" && membership.role !== "member")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const fileBuffer = await fileValue.arrayBuffer();
    const openaiFile = new File([fileBuffer], fileValue.name, {
      type: normalizedMimeType,
    });

    const uploaded = await openai.files.create({
      file: openaiFile,
      purpose: "user_data",
    });

    return NextResponse.json({
      fileId: uploaded.id,
      fileName: fileValue.name,
      fileType: normalizedMimeType,
      fileSize: fileValue.size,
    });
  } catch (error) {
    console.error("Failed to upload assistant file to OpenAI:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
