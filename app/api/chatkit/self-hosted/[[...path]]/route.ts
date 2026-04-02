import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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

async function proxyRequest(
  request: Request,
  path: string[],
) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalSecret = process.env.CHATKIT_SELF_HOSTED_INTERNAL_SECRET?.trim();
  if (!internalSecret) {
    return NextResponse.json(
      { error: "Missing CHATKIT_SELF_HOSTED_INTERNAL_SECRET environment variable." },
      { status: 500 },
    );
  }

  const projectId = request.headers.get("x-chatkit-project-id")?.trim();
  const teamId = request.headers.get("x-chatkit-team-id")?.trim();
  const canMakeChanges = request.headers.get("x-chatkit-can-make-changes")?.trim();

  if (!projectId || !teamId) {
    return NextResponse.json(
      { error: "Missing ChatKit scope headers. Expected project and team identifiers." },
      { status: 400 },
    );
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
  upstreamHeaders.set("x-chatkit-user-id", userId);
  upstreamHeaders.set("x-chatkit-team-id", teamId);
  upstreamHeaders.set("x-chatkit-project-id", projectId);
  upstreamHeaders.set("x-chatkit-convex-token", convexToken);

  if (canMakeChanges === "true" || canMakeChanges === "false") {
    upstreamHeaders.set("x-chatkit-can-make-changes", canMakeChanges);
  }

  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: requestBody,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach the self-hosted ChatKit service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const headerName of HOP_BY_HOP_RESPONSE_HEADERS) {
    responseHeaders.delete(headerName);
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
