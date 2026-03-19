import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

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

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(`${openaiBaseUrl}/v1/chatkit/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      cache: "no-store",
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: `clerk:${userId}`,
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
      client_secret: payload.client_secret,
      expires_after: payload.expires_after ?? null,
    },
    { status: 200 },
  );
}
