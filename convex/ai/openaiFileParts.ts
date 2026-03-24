import type { FileMetadataForHistory, OpenAIUploadedFile } from "./files";

type OpenAIFileContentPart =
  | { type: "file"; data: string; mimeType: string };

export const toOpenAIFileContentPart = (
  file: OpenAIUploadedFile,
): {
  contentPart: OpenAIFileContentPart;
  description: string;
  metadata: FileMetadataForHistory;
} => {
  const fileType = file.fileType || "application/octet-stream";
  const readableName = file.fileName || file.fileId;

  return {
    contentPart: {
      type: "file",
      data: file.fileId,
      mimeType: fileType,
    },
    description: fileType.startsWith("image/")
      ? `User attached image: ${readableName} (${fileType})`
      : `User attached file: ${readableName} (${fileType})`,
    metadata: {
      fileId: file.fileId,
      fileName: readableName,
      fileType,
      fileSize: typeof file.fileSize === "number" ? file.fileSize : undefined,
    },
  };
};
