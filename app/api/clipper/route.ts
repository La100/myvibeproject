import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";

const DEFAULT_ALLOWED_WEB_ORIGINS = new Set([
  "https://myvibeproject.com",
  "https://www.myvibeproject.com",
  "http://localhost:3000",
  "http://localhost:3001",
] as const);
const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS";
const CORS_FALLBACK_ALLOWED_HEADERS = "Authorization, Content-Type";

const PRIORITIES = new Set(["low", "medium", "high", "urgent"] as const);
const REALIZATION_STATUSES = new Set([
  "PLANNED",
  "ORDERED",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const);

type Priority = "low" | "medium" | "high" | "urgent";
type RealizationStatus =
  | "PLANNED"
  | "ORDERED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

interface AddShoppingListItemPayload {
  name: string;
  projectId: Id<"projects">;
  sectionId?: Id<"shoppingListSections">;
  alternativeToItemId?: Id<"shoppingListItems">;
  unitPrice?: number;
  quantity: number;
  totalPrice?: number;
  supplier?: string;
  catalogNumber?: string;
  notes?: string;
  productLink?: string;
  imageUrl?: string;
  priority: Priority;
  realizationStatus: RealizationStatus;
}

function parseConfiguredWebOrigins(): Set<string> {
  const envOrigins = (process.env.CLIPPER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublicAppUrl) {
    envOrigins.push(nextPublicAppUrl);
  }

  return new Set([...DEFAULT_ALLOWED_WEB_ORIGINS, ...envOrigins]);
}

const ALLOWED_WEB_ORIGINS = parseConfiguredWebOrigins();

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) {
    return false;
  }

  if (origin.startsWith("chrome-extension://")) {
    return true;
  }

  return ALLOWED_WEB_ORIGINS.has(origin);
}

function getCorsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get("origin")?.trim() ?? "";

  let allowOrigin: string | null = null;
  if (isAllowedCorsOrigin(origin)) {
    allowOrigin = origin;
  } else if (
    !origin &&
    (req.headers.has("access-control-request-method") ||
      req.headers.get("sec-fetch-mode") === "cors")
  ) {
    // Some proxies strip non-http(s) origins (e.g. chrome-extension://) on preflight.
    // Fallback to wildcard keeps token-authenticated extension requests working.
    allowOrigin = "*";
  }

  if (!allowOrigin) {
    return null;
  }

  const requestedHeaders = req.headers
    .get("access-control-request-headers")
    ?.trim();

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": CORS_ALLOWED_METHODS,
    "Access-Control-Allow-Headers":
      requestedHeaders && requestedHeaders.length > 0
        ? requestedHeaders
        : CORS_FALLBACK_ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function withCors(req: Request, response: NextResponse): NextResponse {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) {
    return response;
  }

  for (const [header, value] of Object.entries(corsHeaders)) {
    response.headers.set(header, value);
  }

  return response;
}

function jsonError(req: Request, message: string, status: number) {
  return withCors(req, NextResponse.json({ message }, { status }));
}

function getAuthTokenFromRequest(req: Request): string | null {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, value] = authHeader.split(" ");
  if (scheme !== "Bearer" || !value?.trim()) {
    return null;
  }

  return value.trim();
}

function getConvexClient(token: string): ConvexHttpClient {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

function asOptionalBoundedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid field: ${fieldName}`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`Field too long: ${fieldName}`);
  }

  return trimmed;
}

function asOptionalNumber(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid numeric field: ${fieldName}`);
  }

  return value;
}

function asRequiredQuantity(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100_000
  ) {
    throw new Error("Invalid quantity");
  }

  return value;
}

function asOptionalHttpUrl(
  value: unknown,
  fieldName: string,
): string | undefined {
  const normalized = asOptionalBoundedString(value, fieldName, 2_000);
  if (!normalized) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid URL field: ${fieldName}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid URL protocol for: ${fieldName}`);
  }

  return normalized;
}

function validateClipperPostPayload(raw: unknown): AddShoppingListItemPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid request body");
  }

  const body = raw as Record<string, unknown>;

  const name = asOptionalBoundedString(body.name, "name", 240);
  if (!name) {
    throw new Error("Product name is required");
  }

  const projectId = asOptionalBoundedString(body.projectId, "projectId", 256);
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const sectionId = asOptionalBoundedString(body.sectionId, "sectionId", 256);
  const alternativeToItemId = asOptionalBoundedString(
    body.alternativeToItemId,
    "alternativeToItemId",
    256,
  );

  const priorityRaw = asOptionalBoundedString(body.priority, "priority", 20);
  const priority = (priorityRaw ?? "medium") as Priority;
  if (!PRIORITIES.has(priority)) {
    throw new Error("Invalid priority");
  }

  const statusRaw = asOptionalBoundedString(
    body.realizationStatus,
    "realizationStatus",
    20,
  );
  const realizationStatus = (statusRaw ?? "PLANNED") as RealizationStatus;
  if (!REALIZATION_STATUSES.has(realizationStatus)) {
    throw new Error("Invalid realizationStatus");
  }

  const quantity = asRequiredQuantity(body.quantity);
  const unitPrice = asOptionalNumber(body.unitPrice, "unitPrice");
  const totalPrice =
    asOptionalNumber(body.totalPrice, "totalPrice") ??
    (unitPrice !== undefined ? unitPrice * quantity : undefined);

  return {
    name,
    projectId: projectId as Id<"projects">,
    sectionId: sectionId as Id<"shoppingListSections"> | undefined,
    alternativeToItemId: alternativeToItemId as
      | Id<"shoppingListItems">
      | undefined,
    unitPrice,
    quantity,
    totalPrice,
    supplier: asOptionalBoundedString(body.supplier, "supplier", 160),
    catalogNumber: asOptionalBoundedString(
      body.catalogNumber,
      "catalogNumber",
      120,
    ),
    notes: asOptionalBoundedString(body.notes, "notes", 8_000),
    productLink: asOptionalHttpUrl(body.productLink, "productLink"),
    imageUrl: asOptionalHttpUrl(body.imageUrl, "imageUrl"),
    priority,
    realizationStatus,
  };
}

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function GET(req: Request) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return jsonError(req, "Authorization token is missing.", 401);
  }

  try {
    const convex = getConvexClient(token);
    const convexAny = convex as typeof convex & {
      query: (ref: unknown, args: unknown) => Promise<unknown>;
    };

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId")?.trim() || null;
    const projectId = searchParams.get("projectId")?.trim() || null;

    if (projectId && !teamId) {
      return jsonError(
        req,
        "teamId is required when projectId is provided.",
        400,
      );
    }

    if (teamId && projectId) {
      const [sections, items] = await Promise.all([
        convexAny.query(apiAny.clipper.getShoppingListSections, {
          projectId: projectId as Id<"projects">,
          teamId: teamId as Id<"teams">,
        }),
        convexAny.query(apiAny.clipper.getShoppingListItemsForProject, {
          projectId: projectId as Id<"projects">,
          teamId: teamId as Id<"teams">,
        }),
      ]);
      return withCors(req, NextResponse.json({ sections, items }));
    }

    if (teamId) {
      const projects = await convexAny.query(
        apiAny.clipper.getProjectsForTeam,
        {
          teamId: teamId as Id<"teams">,
        },
      );
      return withCors(req, NextResponse.json({ projects }));
    }

    const data = await convexAny.query(apiAny.clipper.getTeamsAndProjects, {});
    return withCors(req, NextResponse.json(data));
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    const status = /not authenticated|authorization|token/i.test(message)
      ? 401
      : /not a member|forbidden/i.test(message)
        ? 403
        : 500;

    console.error("[CLIPPER_API_GET_ERROR]", { message });
    return jsonError(req, message, status);
  }
}

export async function POST(req: Request) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return jsonError(req, "Authorization token is missing.", 401);
  }

  try {
    const payload = validateClipperPostPayload(await req.json());

    const convex = getConvexClient(token);
    const convexAny = convex as typeof convex & {
      mutation: (ref: unknown, args: unknown) => Promise<unknown>;
    };

    const newItem = await convexAny.mutation(
      apiAny.clipper.addShoppingListItem,
      payload,
    );
    return withCors(req, NextResponse.json(newItem));
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    const status = /invalid|required|field/i.test(message)
      ? 400
      : /not a member|forbidden/i.test(message)
        ? 403
        : /not authenticated|authorization|token/i.test(message)
          ? 401
          : 500;

    console.error("[CLIPPER_API_POST_ERROR]", { message });
    return jsonError(req, message, status);
  }
}

export async function OPTIONS(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
