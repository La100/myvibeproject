import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

type SafeRemoteUrlOptions = {
  blockedHostMessage?: string;
  unresolvedHostMessage?: string;
};

type ResolvedRemoteAddress = {
  address: string;
  family: 4 | 6;
};

type PinnedFetchOptions = {
  body?: Buffer | Uint8Array | string;
  headers?: Record<string, string>;
  maxBytes?: number;
  method?: string;
  timeoutMs?: number;
} & SafeRemoteUrlOptions;

type PinnedFetchResponse = {
  body: Buffer;
  headers: Headers;
  status: number;
  url: URL;
};

function normalizeHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%[^\]]+$/, "")
    .replace(/\.+$/, "");
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = normalizeHost(hostname);

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return true;
  }

  if (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
}

export { isBlockedHostname, isPrivateIpv4, isPrivateIpv6 };

async function resolveSafeRemoteAddress(
  url: URL,
  options?: SafeRemoteUrlOptions,
): Promise<ResolvedRemoteAddress> {
  const blockedHostMessage = options?.blockedHostMessage ?? "Blocked URL host";
  const unresolvedHostMessage = options?.unresolvedHostMessage ?? "Unable to resolve URL host";

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP/HTTPS URLs are allowed");
  }

  const hostname = normalizeHost(url.hostname);
  if (isBlockedHostname(hostname)) {
    throw new Error(blockedHostMessage);
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 || ipVersion === 6) {
    return { address: hostname, family: ipVersion as 4 | 6 };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(unresolvedHostMessage);
  }

  const safeAddress = addresses.find(
    (record) =>
      (record.family === 4 || record.family === 6) &&
      !isBlockedHostname(record.address),
  );

  if (!safeAddress) {
    throw new Error(
      addresses.length > 0 ? blockedHostMessage : unresolvedHostMessage,
    );
  }

  return { address: safeAddress.address, family: safeAddress.family as 4 | 6 };
}

export async function assertSafeRemoteUrl(
  url: URL,
  options?: SafeRemoteUrlOptions,
): Promise<void> {
  await resolveSafeRemoteAddress(url, options);
}

export async function fetchRemoteUrlPinned(
  url: URL,
  options?: PinnedFetchOptions,
): Promise<PinnedFetchResponse> {
  const resolved = await resolveSafeRemoteAddress(url, options);
  const client = url.protocol === "https:" ? https : http;
  const timeoutMs = options?.timeoutMs ?? 10_000;

  return await new Promise<PinnedFetchResponse>((resolve, reject) => {
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const resolveOnce = (value: PinnedFetchResponse) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const request = client.request(
      url,
      {
        family: resolved.family,
        headers: options?.headers,
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, resolved.address, resolved.family);
        },
        method: options?.method ?? "GET",
        servername: url.protocol === "https:" ? url.hostname : undefined,
      },
      (response) => {
        const declaredContentLength = Number(response.headers["content-length"]);
        if (
          options?.maxBytes !== undefined &&
          Number.isFinite(declaredContentLength) &&
          declaredContentLength > options.maxBytes
        ) {
          response.resume();
          rejectOnce(new Error("Remote response is too large"));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        response.on("data", (chunk: Buffer | string) => {
          const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += bufferChunk.length;

          if (options?.maxBytes !== undefined && totalBytes > options.maxBytes) {
            response.destroy(new Error("Remote response is too large"));
            return;
          }

          chunks.push(bufferChunk);
        });

        response.on("error", (error) => {
          rejectOnce(error as Error);
        });

        response.on("end", () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              for (const entry of value) {
                headers.append(key, entry);
              }
            } else if (typeof value === "string") {
              headers.set(key, value);
            }
          }

          resolveOnce({
            body: Buffer.concat(chunks),
            headers,
            status: response.statusCode || 0,
            url,
          });
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Remote request timed out"));
    });

    request.on("error", (error) => {
      rejectOnce(error as Error);
    });

    if (options?.body !== undefined) {
      request.write(options.body);
    }

    request.end();
  });
}
