# Myvibe Project

Myvibe Project is a project management app for interior and architectural teams. It covers projects, teams, tasks, files, shopping lists, labor, estimations, payments, client panels, surveys, AI assistants, and AI visualizations.

## Stack

- **App**: Next.js 15, React 19, App Router
- **Backend/database**: Convex
- **Auth**: Clerk organizations mapped to app teams
- **UI**: Tailwind CSS, shadcn/ui, Radix primitives
- **Payments**: Stripe Billing and Stripe Connect
- **Storage**: Cloudflare R2 / S3-compatible storage through Convex actions
- **Email**: Resend
- **AI**: OpenAI plus self-hosted ChatKit proxy
- **Deploy**: Vercel/main hosting for the Next.js app; Convex deploys separately; Railway is used only for the self-hosted ChatKit backend

## Repository Map

- `app/` - Next.js pages, layouts, and API routes.
- `components/` - shared UI and feature components.
- `convex/` - Convex schema, queries, mutations, actions, HTTP routes, cron jobs, and AI tools.
- `docs/` - deployment and operational notes.
- `chrome-extension/` - browser clipper extension.

## Requirements

- Node.js **24.x**. This is enforced in `package.json`.
- pnpm **9.15.5** or compatible.
- Convex account and project.
- Clerk application with Organizations enabled.
- Stripe account for subscriptions/payments.
- R2/S3-compatible bucket for files and generated images.
- OpenAI API key for AI features.
- Resend account if email notifications/contact forms should send mail.
- Railway project only if you run the self-hosted ChatKit backend there.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create local env:

```bash
cp .env.example .env.local
```

Then fill `.env.local` with local app variables. Do not put every secret only in `.env.local`: Convex functions run in Convex and need their own environment variables set with `npx convex env set`.

Start local development:

```bash
pnpm run dev
```

This runs:

- `next dev -p 3001`
- `convex dev`

Open:

```text
http://localhost:3001
```

## Environment Variables

There are four places for environment variables:

1. `.env.local` - used by the local Next.js process and Convex CLI.
2. Convex environment - used by Convex actions, mutations, HTTP routes, cron jobs, and auth config.
3. Production Next.js hosting variables - used by the deployed web app, for example on Vercel.
4. Railway service variables - used only by the self-hosted ChatKit backend service.

If a variable is read inside `convex/`, set it in Convex. If it is read inside `app/`, `components/`, `lib/`, or `middleware.ts`, set it in `.env.local` locally and in the production Next.js host. Railway variables are for the ChatKit service only.

### `.env.local` for Local Next.js

Required for the app shell:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_CONVEX_URL=https://<your-dev-deployment>.convex.cloud
CONVEX_DEPLOYMENT=dev:<your-dev-deployment>
```

Required for Clerk in Next.js:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-issuer>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

Required for self-hosted ChatKit proxy pages:

```bash
NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL=/api/chatkit/self-hosted
NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY=<chatkit-domain-key>
CHATKIT_SELF_HOSTED_SERVER_URL=http://127.0.0.1:8011/chatkit
CHATKIT_SELF_HOSTED_INTERNAL_SECRET=<shared-secret>

NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_URL=/api/chatkit/visualizations
NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_DOMAIN_KEY=<visualizations-domain-key>
CHATKIT_VISUALIZATIONS_SERVER_URL=http://127.0.0.1:8011/visualizations/chatkit
CHATKIT_VISUALIZATIONS_INTERNAL_SECRET=<same-or-separate-shared-secret>
```

Optional for Next.js:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_UI_VIBE=
CLIPPER_ALLOWED_ORIGINS=http://localhost:3001
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

### Convex Environment

Set these on the matching Convex deployment. For local development, use your dev Convex deployment. For production, use the production Convex deployment.

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<your-clerk-issuer>"
npx convex env set CLERK_WEBHOOK_SECRET "whsec_..."
npx convex env set CLERK_SECRET_KEY "sk_..."

npx convex env set NEXT_PUBLIC_BASE_URL "http://localhost:3001"
npx convex env set OPENAI_API_KEY "sk-proj-..."
npx convex env set OPENAI_WEB_SEARCH_MODEL "gpt-4.1-mini"
npx convex env set AI_DEBUG_LOGS "false"

npx convex env set STRIPE_SECRET_KEY "sk_test_..."
npx convex env set STRIPE_CORE_USER_USD_PRICE_ID "price_..."
npx convex env set STRIPE_CORE_USER_PLN_PRICE_ID "price_..."
npx convex env set STRIPE_AI_USER_USD_PRICE_ID "price_..."
npx convex env set STRIPE_AI_USER_PLN_PRICE_ID "price_..."
npx convex env set STRIPE_AI_SCALE_USER_USD_PRICE_ID "price_..."
npx convex env set STRIPE_AI_SCALE_USER_PLN_PRICE_ID "price_..."
npx convex env set STRIPE_CONNECT_DEFAULT_COUNTRY "PL"

npx convex env set RESEND_API_KEY "re_..."
npx convex env set RESEND_FROM_EMAIL "Myvibe <notifications@yourdomain.com>"

npx convex env set R2_ACCESS_KEY_ID "..."
npx convex env set R2_SECRET_ACCESS_KEY "..."
npx convex env set R2_BUCKET "..."
npx convex env set R2_ENDPOINT "https://<account-id>.r2.cloudflarestorage.com"
npx convex env set R2_PUBLIC_URL "https://<public-r2-domain>"
npx convex env set NEXT_PUBLIC_R2_PUBLIC_URL "https://<public-r2-domain>"
```

Convex also needs Stripe webhook signing secrets through the `@convex-dev/stripe` component setup. Keep the Convex Stripe component configuration aligned with the Stripe endpoint described below.

For production Convex, set production values:

```bash
npx convex deploy
```

Then set or verify production env in the Convex dashboard or with `npx convex env set` while targeting the production deployment.

### Production Next.js Environment

Set these in the production host for the web app, for example Vercel. These variables are for Next.js, not for the Railway ChatKit service.

Required production web app variables:

```bash
NEXT_PUBLIC_BASE_URL=https://<your-app-domain>
NEXT_PUBLIC_APP_URL=https://<your-app-domain>
NEXT_PUBLIC_CONVEX_URL=https://<your-prod-deployment>.convex.cloud

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWT_ISSUER_DOMAIN=https://<your-production-clerk-issuer>

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL=/api/chatkit/self-hosted
NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY=<domain-key>
CHATKIT_SELF_HOSTED_SERVER_URL=https://<chatkit-railway-domain>/chatkit
CHATKIT_SELF_HOSTED_INTERNAL_SECRET=<shared-secret>

NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_URL=/api/chatkit/visualizations
NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_DOMAIN_KEY=<domain-key>
CHATKIT_VISUALIZATIONS_SERVER_URL=https://<chatkit-railway-domain>/visualizations/chatkit
CHATKIT_VISUALIZATIONS_INTERNAL_SECRET=<shared-secret>
```

Optional production web app variables:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_UI_VIBE=
CLIPPER_ALLOWED_ORIGINS=https://<your-app-domain>
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Set production secrets that Convex uses in Convex, not only in the web app host. For example `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, and R2 credentials are used by Convex actions and must exist in the Convex production environment.

## Web App Deploy

Recommended deploy flow for the web app:

```bash
pnpm lint
pnpm build
npx convex deploy
```

Run `npx convex deploy` before releasing the web app whenever Convex schema/functions changed. The production web app must point at the production Convex deployment.

## Self-Hosted ChatKit on Railway

Railway is used for the self-hosted ChatKit backend, not for the main Next.js app. The Next.js app does not expose ChatKit directly to the browser; browser traffic goes through these trusted proxy routes:

- `/api/chatkit/self-hosted`
- `/api/chatkit/visualizations`

Production shape:

- Web app: deployed separately, for example on Vercel.
- Railway service: self-hosted ChatKit backend.
- Next.js talks to the ChatKit backend through `CHATKIT_SELF_HOSTED_SERVER_URL` and `CHATKIT_VISUALIZATIONS_SERVER_URL`.
- Both proxy routes send `x-chatkit-internal-secret`; the backend must reject requests without it.

More details are in `docs/railway-self-hosted-chatkit.md`.

## Webhooks

### Clerk

Convex exposes the Clerk webhook route:

```text
https://<your-convex-deployment>.convex.site/clerk
```

Configure this endpoint in Clerk and set `CLERK_WEBHOOK_SECRET` in Convex.

The app handles:

- organization created/updated/deleted
- organization membership created/updated/deleted
- user created/updated/deleted
- organization invitation created/accepted/revoked

### Stripe

Convex exposes the Stripe webhook route:

```text
https://<your-convex-deployment>.convex.site/stripe/webhook
```

Configure it in Stripe for subscription/payment events and keep the Stripe component configuration in Convex aligned with that endpoint.

## Storage

Files, product images, project assets, and AI visualization outputs use R2/S3-compatible storage from Convex functions. Set R2 variables in Convex. If images need public access, `R2_PUBLIC_URL` and `NEXT_PUBLIC_R2_PUBLIC_URL` must point to a public bucket domain or CDN.

## Useful Commands

```bash
pnpm run dev          # Next.js + Convex dev
pnpm lint             # design discipline + ESLint
pnpm typecheck        # TypeScript check
pnpm build            # production Next.js build
pnpm start            # start built app on port 3001
npx convex dev        # Convex dev only
npx convex deploy     # deploy Convex functions/schema
```

## Local vs Production Rule

- Local development should point at a Convex development deployment.
- Production web app should point at a Convex production deployment.
- Clerk keys and `CLERK_JWT_ISSUER_DOMAIN` must come from the same Clerk instance.
- Do not point the production web app at a dev Convex deployment.
- Do not assume Railway ChatKit variables are available inside Convex or the web app.

See also `docs/local-main-workflow.md`.
