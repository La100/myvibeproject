import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference, type FunctionReference } from "convex/server";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

type ChatKitSessionRequest = {
  projectId?: string;
  teamId?: string;
};

function getWorkflowId() {
  return (
    process.env.OPENAI_CHATKIT_WORKFLOW_ID?.trim() ||
    process.env.CHATKIT_WORKFLOW_ID?.trim() ||
    null
  );
}

function getApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function normalizeScopeValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildScopedUserId(userId: string, teamId: string, projectId: string) {
  return `clerk:${userId}:team:${teamId}:project:${projectId}`;
}

type ConvexQueryClient = {
  query: (
    ref: FunctionReference<"query">,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};

function getConvexClient(token: string): ConvexQueryClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable.");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client as unknown as ConvexQueryClient;
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }

  const root = payload as Record<string, unknown>;
  const nestedError = root.error;

  if (typeof nestedError === "string" && nestedError.trim()) {
    return nestedError;
  }

  if (typeof nestedError === "object" && nestedError !== null) {
    const message = (nestedError as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export async function POST(request: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ChatKitSessionRequest | null;
  const projectId = normalizeScopeValue(body?.projectId);
  const teamId = normalizeScopeValue(body?.teamId);

  if (!projectId || !teamId) {
    return NextResponse.json(
      { error: "Missing ChatKit scope. Expected projectId and teamId." },
      { status: 400 },
    );
  }

  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let convex: ConvexQueryClient;
  try {
    convex = getConvexClient(convexToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize Convex client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const getProjectRef = makeFunctionReference<"query">("projects:getProject");
  const getCurrentUserTeamMemberRef =
    makeFunctionReference<"query">("teams:getCurrentUserTeamMember");
  const checkTeamAIAccessRef =
    makeFunctionReference<"query">("stripe:checkTeamAIAccess");
  const [project, membership, aiAccess] = await Promise.all([
    convex.query(getProjectRef, { projectId }),
    convex.query(getCurrentUserTeamMemberRef, { teamId }),
    convex.query(checkTeamAIAccessRef, { teamId }),
  ]) as [
    { _id?: string; teamId?: string } | null,
    { isActive?: boolean; role?: "admin" | "member" } | null,
    { hasAccess?: boolean; message?: string; remainingTokens?: number } | null,
  ];

  if (!project?._id || project.teamId !== teamId) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (
    !membership ||
    membership.isActive === false ||
    (membership.role !== "admin" && membership.role !== "member")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!aiAccess?.hasAccess) {
    return NextResponse.json(
      {
        error:
          aiAccess?.message?.trim() ||
          "AI access is not available for this workspace right now.",
      },
      { status: 402 },
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 },
    );
  }

  const workflowId = getWorkflowId();
  if (!workflowId) {
    return NextResponse.json(
      { error: "Missing OPENAI_CHATKIT_WORKFLOW_ID environment variable." },
      { status: 500 },
    );
  }

  const openaiBaseUrl =
    process.env.OPENAI_API_BASE_URL?.trim() ||
    process.env.CHATKIT_API_BASE?.trim() ||
    DEFAULT_OPENAI_BASE_URL;
  const scopedOpenAIProjectId = process.env.OPENAI_PROJECT_ID?.trim() || null;
  const requestId = `chatkit:${teamId}:${projectId}:${userId}:${Date.now()}`;

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(`${openaiBaseUrl}/v1/chatkit/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        "X-Client-Request-Id": requestId,
        ...(scopedOpenAIProjectId ? { "OpenAI-Project": scopedOpenAIProjectId } : {}),
      },
      cache: "no-store",
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: buildScopedUserId(userId, teamId, projectId),
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach OpenAI ChatKit API.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const payload = (await upstreamResponse.json().catch(() => null)) as
    | {
        client_secret?: string;
        expires_after?: string | null;
        error?: string | { message?: string };
      }
    | null;

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: extractErrorMessage(payload, "Failed to create ChatKit session."),
      },
      { status: upstreamResponse.status },
    );
  }

  if (!payload?.client_secret) {
    return NextResponse.json(
      { error: "Missing client_secret in OpenAI ChatKit response." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      clientSecret: payload.client_secret,
      client_secret: payload.client_secret,
      expiresAfter: payload.expires_after ?? null,
      expires_after: payload.expires_after ?? null,
    },
    { status: 200 },
  );
}

export const runtime = "nodejs";
export const maxDuration = 60;
