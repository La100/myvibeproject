import { NextRequest, NextResponse } from "next/server";

import { assertSafeRemoteUrl } from "@/lib/security/remoteUrlSafety";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
export const runtime = "nodejs";

async function normalizeInputUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Missing url parameter");
  }

  const parsed = new URL(trimmed);
  await assertSafeRemoteUrl(parsed, {
    blockedHostMessage: "Blocked URL host",
    unresolvedHostMessage: "Unable to resolve URL host",
  });

  return parsed;
}

async function fetchImageWithRedirects(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeRemoteUrl(currentUrl, {
      blockedHostMessage: "Blocked redirected host",
      unresolvedHostMessage: "Redirected host could not be resolved",
    });

    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect without location header");
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      throw new Error("Remote resource is not an image");
    }

    const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image is too large");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image is too large");
    }

    return { buffer, contentType };
  }

  throw new Error("Too many redirects");
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const normalizedUrl = await normalizeInputUrl(rawUrl);
    const { buffer, contentType } = await fetchImageWithRedirects(normalizedUrl);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return new NextResponse((error as Error).message || "Internal Server Error", {
      status: 400,
    });
  }
}
