import assert from "node:assert/strict";
import test from "node:test";

import { toOpenAIFileContentPart } from "../../convex/ai/openaiFileParts.ts";

test("toOpenAIFileContentPart preserves MIME type for non-image files", () => {
  const result = toOpenAIFileContentPart({
    fileId: "file_csv_1",
    fileName: "budget.csv",
    fileType: "text/csv",
    fileSize: 128,
  });

  assert.deepEqual(result.contentPart, {
    type: "file",
    data: "file_csv_1",
    mimeType: "text/csv",
  });
  assert.equal(result.description, "User attached file: budget.csv (text/csv)");
  assert.deepEqual(result.metadata, {
    fileId: "file_csv_1",
    fileName: "budget.csv",
    fileType: "text/csv",
    fileSize: 128,
  });
});
