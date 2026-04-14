# Local and Main Workflow

This project works best with a simple two-lane setup:

- `local` uses the Convex development deployment
- `main` / production deploys use the Convex production deployment

You do not need a separate Preview workflow unless you actually use preview deploys.

## Recommended Environment Split

### Local machine (`.env.local`)

Use your development Convex deployment:

- `CONVEX_DEPLOYMENT=dev:<your-dev-deployment>`
- `NEXT_PUBLIC_CONVEX_URL=https://<your-dev-deployment>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-dev-deployment>.convex.site`

Use the Clerk instance you want to develop against locally. The important rule is consistency:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_JWT_ISSUER_DOMAIN` must all come from the same Clerk instance
- `CLERK_JWT_ISSUER_DOMAIN` must match that instance, not an old `accounts.dev` value from another one

### Vercel Production (`main`)

Use your production Convex deployment:

- `CONVEX_DEPLOYMENT=prod:<your-prod-deployment>`
- `NEXT_PUBLIC_CONVEX_URL=https://<your-prod-deployment>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-prod-deployment>.convex.site`

Use your production Clerk instance:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
- `CLERK_SECRET_KEY=sk_live_...`
- `CLERK_JWT_ISSUER_DOMAIN=https://<your-production-clerk-issuer>`

## Vercel Environments

Vercel always has three environment buckets:

- `Development`
- `Preview`
- `Production`

Even if you only think in terms of `local` and `main`, those buckets still exist.

If you do not use Preview intentionally, the cleanest setup is:

- `Production`: real production values
- `Preview`: same values as production, or left unused on purpose
- `Development`: optional mirror of local, mainly for `vercel env pull` / `vercel dev`

## Daily Workflow

### 1. Work locally

Start local development against the Convex development deployment:

```bash
pnpm run dev
```

This uses:

- Next.js locally
- `convex dev` locally
- the dev deployment from `.env.local`

### 2. Test changes

Keep all experiments, schema changes, and AI feature testing on the Convex development deployment first.

### 3. Promote backend changes

When the backend is ready, deploy Convex to production intentionally:

```bash
npx convex deploy
```

Run this only when you want production data/functions updated.

### 4. Deploy frontend from `main`

After Convex production is current, deploy the frontend from `main` to Vercel production.

## Practical Rule of Thumb

- `local` -> safe place for testing on dev Convex
- `main` -> production frontend + production Convex
- do not point production frontend at dev Convex
- do not mix Clerk keys from one instance with the issuer domain of another instance

## Minimal Setup If You Want It Simple

If you want the least confusing setup possible:

- local machine: dev Convex
- Vercel production: prod Convex
- Vercel preview: same as production or not used
- one consistent Clerk setup per environment group
