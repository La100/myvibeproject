import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

function normalizeHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%[^\]]+$/, "")
    .replace(/\.+$/, "");
}

export function isPrivateIpv4(hostname: string): boolean {
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

export function isPrivateIpv6(hostname: string): boolean {
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

export function isBlockedHostname(hostname: string): boolean {
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

export async function assertSafeRemoteUrl(
  url: URL,
  options?: {
    blockedHostMessage?: string;
    unresolvedHostMessage?: string;
  },
): Promise<void> {
  const blockedHostMessage = options?.blockedHostMessage ?? "Blocked URL host";
  const unresolvedHostMessage = options?.unresolvedHostMessage ?? "Unable to resolve URL host";

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP/HTTPS URLs are allowed");
  }

  const hostname = normalizeHost(url.hostname);
  if (isBlockedHostname(hostname)) {
    throw new Error(blockedHostMessage);
  }

  if (isIP(hostname)) {
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(unresolvedHostMessage);
  }

  if (!addresses.length) {
    throw new Error(unresolvedHostMessage);
  }

  for (const record of addresses) {
    if (isBlockedHostname(record.address)) {
      throw new Error(blockedHostMessage);
    }
  }
}
