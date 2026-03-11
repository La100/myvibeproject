"use node";

/**
 * File Processor Helper
 *
 * Responsible for converting uploaded files (Excel, text files) into text that can be safely passed
 * to the language model. PDFs are handled natively by the agent via file URLs.
 */

import { aiDebugLog } from "./debugLog";

export const processFileForAI = async (
  file: any,
  fileUrl: string,
  userMessage: string,
): Promise<string> => {
  let augmentedMessage = userMessage;

  const isExcelFile =
    file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimeType === "application/vnd.ms-excel" ||
    file.mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.name.endsWith(".xlsm");

  if (isExcelFile) {
    aiDebugLog("📊 Spreadsheet attached for AI context:", file.name);
    augmentedMessage = `${userMessage}\n\n📎 ATTACHED SPREADSHEET: "${file.name}" (${file.mimeType}) — spreadsheet preview is disabled in production hardening mode. Ask the user to export CSV or describe the rows they want analyzed.`;
    return augmentedMessage;
  }

  // Handle text-like files
  if (
    file.mimeType?.includes("text/") ||
    file.mimeType?.includes("application/json") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".json") ||
    file.name.endsWith(".csv")
  ) {
    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch text file: ${fileResponse.status}`);
      }
      const textContent = await fileResponse.text();
      const truncated =
        textContent.length > 10000
          ? `${textContent.slice(0, 10000)}\n...[truncated]`
          : textContent;
      augmentedMessage = `${userMessage}\n\n[FILE CONTENT: ${file.name}]\n${truncated}`;
      return augmentedMessage;
    } catch (error) {
      console.error("Failed to read text file contents:", error);
      augmentedMessage = `${userMessage}\n\n📎 ATTACHED FILE: "${file.name}" (${file.mimeType}) — unable to read contents automatically.`;
      return augmentedMessage;
    }
  }

  // Fallback for other file types
  const fileTypeDescription = file.mimeType || "unknown file type";
  augmentedMessage = `${userMessage}\n\n📎 ATTACHED FILE: "${file.name}" (${fileTypeDescription}, ${(file.size / 1024).toFixed(
    1,
  )} KB). I can't read this file type automatically, but I can help if you describe what you need from it.`;
  return augmentedMessage;
};

export const getFileUrl = async (
  file: any,
  ctx: any,
): Promise<string | null> => {
  try {
    const { r2 } = await import("../../files");
    const fileUrl = await r2.getUrl(file.storageId as string, {
      expiresIn: 60 * 60 * 2, // 2 hours
    });
    aiDebugLog(`🔗 Generated R2 signed URL for file: ${file.name}`);
    return fileUrl;
  } catch (error) {
    console.error("Failed to get R2 signed URL:", error);
    try {
      const fileUrl = await ctx.storage.getUrl(file.storageId);
      aiDebugLog(`🔗 Using Convex storage URL fallback: ${file.name}`);
      return fileUrl;
    } catch (fallbackError) {
      console.error("Both R2 and Convex storage URL generation failed:", fallbackError);
      return null;
    }
  }
};
