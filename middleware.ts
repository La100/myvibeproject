import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/help(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/onboarding(.*)",
  "/client-panel(.*)",
  "/api/healthz(.*)",
  "/api/clipper(.*)",
  "/auth(.*)",
]);

const clerkProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
const clerkProxyHost = clerkProxyUrl ? new URL(clerkProxyUrl).host : null;

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) await auth.protect();
  },
  clerkProxyHost
    ? {
        frontendApiProxy: {
          enabled: (url) => url.host === clerkProxyHost,
          path: "/__clerk",
        },
      }
    : undefined,
);

export const config = {
  matcher: [
    "/__clerk(.*)",
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
