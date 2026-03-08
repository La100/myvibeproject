import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const convexRoot = path.join(workspaceRoot, "convex");

type ConvexFunctionType = "query" | "mutation" | "internalQuery" | "internalMutation";

type ConvexBlock = {
  file: string;
  name: string;
  type: ConvexFunctionType;
  source: string;
};

const convexFunctionPattern =
  /export const\s+(\w+)\s*=\s*(query|mutation|internalQuery|internalMutation)\s*\(\s*\{/g;

const collectTsFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "_generated") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const findCallEnd = (source: string, startParenIndex: number): number => {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startParenIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (!escaped && char === "'") inSingle = false;
      escaped = !escaped && char === "\\";
      continue;
    }
    if (inDouble) {
      if (!escaped && char === "\"") inDouble = false;
      escaped = !escaped && char === "\\";
      continue;
    }
    if (inTemplate) {
      if (!escaped && char === "`") inTemplate = false;
      escaped = !escaped && char === "\\";
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      escaped = false;
      continue;
    }
    if (char === "\"") {
      inDouble = true;
      escaped = false;
      continue;
    }
    if (char === "`") {
      inTemplate = true;
      escaped = false;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

const extractConvexBlocks = (file: string, source: string): ConvexBlock[] => {
  const blocks: ConvexBlock[] = [];
  for (const match of source.matchAll(convexFunctionPattern)) {
    const name = match[1];
    const type = match[2] as ConvexFunctionType;
    const exportStart = match.index ?? 0;
    const openParen = source.indexOf("(", exportStart);
    if (openParen < 0) continue;

    const closeParen = findCallEnd(source, openParen);
    if (closeParen < 0) continue;

    blocks.push({
      file,
      name,
      type,
      source: source.slice(exportStart, closeParen + 1),
    });
  }
  return blocks;
};

test("Convex queries/mutations never call fetch directly", async () => {
  const files = await collectTsFiles(convexRoot);
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const blocks = extractConvexBlocks(file, source);
    for (const block of blocks) {
      if (/\bfetch\s*\(/.test(block.source)) {
        violations.push(`${path.relative(workspaceRoot, block.file)} -> ${block.type} ${block.name}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found forbidden fetch() in Convex query/mutation handlers:\n${violations.join("\n")}`,
  );
});

test("Team invite/revoke flow stays scheduler + internalAction based", async () => {
  const teamsPath = path.join(convexRoot, "teams.ts");
  const source = await readFile(teamsPath, "utf8");

  assert.match(source, /runAfter\(\s*0,\s*"teams:sendClerkInvitation"/);
  assert.match(source, /runAfter\(\s*0,\s*"teams:revokeClerkInvitation"/);
  assert.match(source, /export const revokeClerkInvitation = internalAction\(/);
  assert.match(source, /"Content-Type":\s*"application\/json"/);
  assert.match(source, /ctx\.db\.patch\(\s*invitation\._id,\s*\{\s*status:\s*"revoked"\s*\}\s*\)/);
  assert.doesNotMatch(source, /export const revokeInvitation = mutation\([\s\S]*?\bfetch\s*\(/);
});

test("AI assistant public endpoints stay access-controlled", async () => {
  const threadsPath = path.join(convexRoot, "ai", "threads.ts");
  const source = await readFile(threadsPath, "utf8");

  assert.match(
    source,
    /export const getProjectThread = mutation\([\s\S]*?const identity = await requireIdentity\(ctx\)/,
  );
  assert.match(
    source,
    /export const getProjectThread = mutation\([\s\S]*?identity\.subject !== args\.userClerkId/,
  );
  assert.match(
    source,
    /export const getProjectThread = mutation\([\s\S]*?ensureProjectAccess\(ctx,\s*args\.projectId,\s*identity\.subject\)/,
  );
  assert.match(
    source,
    /export const listPendingItems = query\([\s\S]*?ensureThreadAccess\(ctx,\s*args\.threadId,\s*identity\.subject\)/,
  );
  assert.match(
    source,
    /export const markFunctionCallsAsConfirmed = mutation\([\s\S]*?ensureThreadAccess\(ctx,\s*args\.threadId,\s*identity\.subject\)/,
  );
  assert.match(
    source,
    /export const markFunctionCallsAsConfirmed = mutation\([\s\S]*?q\.and\([\s\S]*?q\.eq\(q\.field\("threadId"\),\s*args\.threadId\)[\s\S]*?q\.eq\(q\.field\("status"\),\s*"pending"\)/,
  );
});

test("AI streaming endpoints stay scoped to authorized thread/project access", async () => {
  const streamingPath = path.join(convexRoot, "ai", "streamingQueries.ts");
  const source = await readFile(streamingPath, "utf8");

  assert.match(
    source,
    /export const listThreadMessages = query\([\s\S]*?const identity = await requireIdentity\(ctx\)/,
  );
  assert.match(
    source,
    /export const listThreadMessages = query\([\s\S]*?ensureThreadAccess\(ctx,\s*args\.threadId,\s*identity\.subject\)/,
  );
  assert.match(
    source,
    /export const initiateStreaming = mutation\([\s\S]*?const identity = await requireIdentity\(ctx\)/,
  );
  assert.match(
    source,
    /export const initiateStreaming = mutation\([\s\S]*?ensureProjectAccess\(ctx,\s*args\.projectId,\s*userClerkId\)/,
  );
});
