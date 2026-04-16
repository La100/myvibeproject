import { NextRequest, NextResponse } from "next/server";

import { fetchRemoteUrlPinned } from "@/lib/security/remoteUrlSafety";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
export const runtime = "nodejs";

async function normalizeInputUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Missing url parameter");
  }

  return new URL(trimmed);
}

async function fetchImageWithRedirects(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchRemoteUrlPinned(currentUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
      blockedHostMessage: "Blocked redirected host",
      unresolvedHostMessage: "Redirected host could not be resolved",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect without location header");
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
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

    if (response.body.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image is too large");
    }

    return { buffer: response.body, contentType };
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

    return new NextResponse(new Uint8Array(buffer), {
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
