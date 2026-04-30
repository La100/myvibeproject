import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { verifyAssistantAccess, verifyProjectScope } from "@/lib/assistant/serverAccess";

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const CHATKIT_PROXY_TIMEOUT_MS = 180_000;
const SLOW_CHATKIT_PROXY_MS = 5_000;

function buildTargetUrl(request: Request, path: string[]) {
  const baseUrl = process.env.CHATKIT_SELF_HOSTED_SERVER_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing CHATKIT_SELF_HOSTED_SERVER_URL environment variable.");
  }

  const targetUrl = new URL(baseUrl);
  const incomingUrl = new URL(request.url);

  if (path.length > 0) {
    const basePath = targetUrl.pathname.replace(/\/+$/, "");
    const extraPath = path.join("/");
    targetUrl.pathname = `${basePath}/${extraPath}`;
  }

  targetUrl.search = incomingUrl.search;
  return targetUrl;
}

function isAttachmentPath(path: string[]) {
  return (
    path.length === 3 &&
    path[0] === "attachments" &&
    path[1] !== "" &&
    (path[2] === "upload" || path[2] === "content")
  );
}

function isAllowedProxyPath(method: string, path: string[]) {
  if (path.length === 0) {
    return method === "POST" || method === "OPTIONS";
  }

  if (!isAttachmentPath(path)) {
    return false;
  }

  if (path[2] === "upload") {
    return method === "POST" || method === "PUT" || method === "OPTIONS";
  }

  return method === "GET" || method === "OPTIONS";
}

function hasAttachmentToken(request: Request, path: string[]) {
  if (!isAttachmentPath(path)) {
    return false;
  }

  const incomingUrl = new URL(request.url);
  return Boolean(incomingUrl.searchParams.get("attachmentToken")?.trim());
}

async function proxyRequest(
  request: Request,
  path: string[],
) {
  const startedAt = Date.now();
  let authDurationMs = 0;
  let upstreamDurationMs = 0;

  if (!isAllowedProxyPath(request.method, path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedAttachmentRequest = hasAttachmentToken(request, path);

  const internalSecret = process.env.CHATKIT_SELF_HOSTED_INTERNAL_SECRET?.trim();
  if (!internalSecret) {
    return NextResponse.json(
      { error: "Missing CHATKIT_SELF_HOSTED_INTERNAL_SECRET environment variable." },
      { status: 500 },
    );
  }

  const incomingUrl = new URL(request.url);
  let userId: string | null = null;
  let convexToken: string | null = null;
  let projectId: string | undefined;
  let teamId: string | undefined;
  let timezone: string | null = null;
  let canMakeChanges: string | null = null;

  if (!signedAttachmentRequest) {
    const authStartedAt = Date.now();
    const authContext = await auth();
    userId = authContext.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    convexToken = await authContext.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    projectId =
      request.headers.get("x-chatkit-project-id")?.trim() ||
      incomingUrl.searchParams.get("projectId")?.trim();
    teamId =
      request.headers.get("x-chatkit-team-id")?.trim() ||
      incomingUrl.searchParams.get("teamId")?.trim();
    timezone = request.headers.get("x-chatkit-timezone")?.trim() || null;
    canMakeChanges = request.headers.get("x-chatkit-can-make-changes")?.trim() || null;

    if (!projectId || !teamId) {
      return NextResponse.json(
        { error: "Missing ChatKit scope headers. Expected project and team identifiers." },
        { status: 400 },
      );
    }

    try {
      await verifyProjectScope(convexToken, projectId, teamId);

      if (path.length === 0) {
        await verifyAssistantAccess(convexToken, teamId);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Access denied for this ChatKit request.";
      return NextResponse.json({ error: message }, { status: 403 });
    } finally {
      authDurationMs = Date.now() - authStartedAt;
    }
  }

  let targetUrl: URL;
  try {
    targetUrl = buildTargetUrl(request, path);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve ChatKit self-hosted URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const upstreamHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (contentType) {
    upstreamHeaders.set("content-type", contentType);
  }

  if (accept) {
    upstreamHeaders.set("accept", accept);
  }

  upstreamHeaders.set("x-chatkit-internal-secret", internalSecret);
  upstreamHeaders.set(
    "x-chatkit-proxy-base-url",
    `${incomingUrl.origin}/api/chatkit/self-hosted`,
  );

  if (userId) {
    upstreamHeaders.set("x-chatkit-user-id", userId);
  }

  if (teamId) {
    upstreamHeaders.set("x-chatkit-team-id", teamId);
  }

  if (projectId) {
    upstreamHeaders.set("x-chatkit-project-id", projectId);
  }

  if (timezone) {
    upstreamHeaders.set("x-chatkit-timezone", timezone);
  }

  if (convexToken) {
    upstreamHeaders.set("x-chatkit-convex-token", convexToken);
  }

  if (!signedAttachmentRequest && (canMakeChanges === "true" || canMakeChanges === "false")) {
    upstreamHeaders.set("x-chatkit-can-make-changes", canMakeChanges);
  }

  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let upstreamResponse: Response;

  try {
    const upstreamStartedAt = Date.now();
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: requestBody,
      cache: "no-store",
      signal: AbortSignal.timeout(CHATKIT_PROXY_TIMEOUT_MS),
    });
    upstreamDurationMs = Date.now() - upstreamStartedAt;
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The self-hosted ChatKit service timed out after 180 seconds."
        : error instanceof Error
          ? error.message
          : "Failed to reach the self-hosted ChatKit service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const headerName of HOP_BY_HOP_RESPONSE_HEADERS) {
    responseHeaders.delete(headerName);
  }

  const totalDurationMs = Date.now() - startedAt;
  responseHeaders.append(
    "Server-Timing",
    [
      `chatkit_auth;dur=${authDurationMs}`,
      `chatkit_upstream;dur=${upstreamDurationMs}`,
      `chatkit_total;dur=${totalDurationMs}`,
    ].join(", "),
  );

  if (totalDurationMs >= SLOW_CHATKIT_PROXY_MS) {
    console.warn("[chatkit-proxy] slow request", {
      method: request.method,
      path: path.join("/") || "/",
      status: upstreamResponse.status,
      authDurationMs,
      upstreamDurationMs,
      totalDurationMs,
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export async function OPTIONS(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxyRequest(request, path);
}

export const runtime = "nodejs";
export const maxDuration = 60;
