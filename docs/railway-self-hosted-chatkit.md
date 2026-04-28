# Railway self-hosted ChatKit

This repo now treats `AI` as a self-hosted ChatKit surface.

## Architecture

- Public web app: this Next.js app on Railway
- Private ChatKit backend: one Railway service with two ChatKit endpoints
- Browser traffic: `AI` calls `/api/chatkit/self-hosted`
- App proxy: forwards requests to `CHATKIT_SELF_HOSTED_SERVER_URL`
- Backend auth: the proxy attaches an internal secret plus user, team, project, and Convex context headers

## Why this shape

OpenAI's ChatKit advanced integration uses a custom API URL instead of hosted ChatKit sessions. In this repo that means:

- `app/organisation/projects/[projectSlug]/ai/page.tsx` is the primary assistant route
- `app/organisation/projects/[projectSlug]/ai2/page.tsx` redirects legacy `AI 2` links to `AI`
- `components/ai/chatkit/HostedChatKit.tsx` is now wired to the self-hosted API only
- `app/api/chatkit/self-hosted/[[...path]]/route.ts` is the trusted proxy between Clerk-authenticated users and your ChatKit backend
- `components/ai/chatkit/VisualizationChatKit.tsx` is a second ChatKit surface for organization-level visualizations
- `app/api/chatkit/visualizations/[[...path]]/route.ts` is the team-scoped proxy for visualization-only ChatKit traffic

## Railway service 1: Next.js app

Use the repo root as the service root.

Config is in [railway.json](/Users/cinu/Desktop/myvibeproject/railway.json).

Required variables:

- `NEXT_PUBLIC_BASE_URL=https://<your-app-domain>`
- `NEXT_PUBLIC_APP_URL=https://<your-app-domain>`
- `NEXT_PUBLIC_CONVEX_URL=<your-convex-deployment-url>`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>`
- `CLERK_SECRET_KEY=<your-clerk-secret-key>`
- `CLERK_JWT_ISSUER_DOMAIN=<your-clerk-jwt-issuer-domain>`
- `NEXT_PUBLIC_CHATKIT_SELF_HOSTED_URL=/api/chatkit/self-hosted`
- `NEXT_PUBLIC_CHATKIT_SELF_HOSTED_DOMAIN_KEY=<domain-key-issued-for-your-chatkit-backend>`
- `CHATKIT_SELF_HOSTED_SERVER_URL=http://<your-private-chatkit-service>:<port>/chatkit`
- `CHATKIT_SELF_HOSTED_INTERNAL_SECRET=<shared-secret>`
- `NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_URL=/api/chatkit/visualizations`
- `NEXT_PUBLIC_CHATKIT_VISUALIZATIONS_DOMAIN_KEY=<domain-key-issued-for-your-visualization-chatkit-backend>`
- `CHATKIT_VISUALIZATIONS_SERVER_URL=http://<your-private-chatkit-service>:<port>/visualizations/chatkit`
- `CHATKIT_VISUALIZATIONS_INTERNAL_SECRET=<shared-secret>`

Plus your existing app variables such as Stripe, R2, Resend, and OpenAI.

## Railway service 2: ChatKit backend

Use `myvibe-chatkit` as the service root. This one service exposes two ChatKit endpoints:

- `/chatkit` for the project assistant
- `/visualizations/chatkit` for organization visualizations

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

The backend should trust only requests that include:

- `x-chatkit-internal-secret`
- `x-chatkit-user-id`
- `x-chatkit-team-id`
- `x-chatkit-project-id`
- `x-chatkit-convex-token`
- `x-chatkit-can-make-changes`

Recommended backend environment:

- `CHATKIT_INTERNAL_SECRET=<same value as CHATKIT_SELF_HOSTED_INTERNAL_SECRET in the app service>`
- `CONVEX_URL=<same-convex-url>`
- `OPENAI_API_KEY=<server-side-openai-key>`
- `OPENAI_MODEL=gpt-5.5`
- `CHATKIT_ROUTER_MODEL=gpt-5.4-mini`
- `CHATKIT_SQLITE_PATH=/data/chatkit.sqlite3`
- `CHATKIT_ATTACHMENT_DIR=/data/attachments`

## Visualization ChatKit

The organization visualizations route uses a separate ChatKit UI so the model
profile, tool list, and prompt can stay focused on image generation instead of
general project operations. The proxy accepts team-scoped requests and forwards:

- `x-chatkit-surface=visualizations`
- `x-chatkit-user-id`
- `x-chatkit-team-id`
- `x-chatkit-convex-token`

Additional backend environment:

- `CHATKIT_VISUALIZATIONS_MODEL=gpt-5.4-mini`
- `CHATKIT_VISUALIZATIONS_REASONING_EFFORT=medium`

Because both ChatKits run in one service, the backend secret is still
`CHATKIT_INTERNAL_SECRET`. Set both app-side proxy secrets to the same value:

- `CHATKIT_SELF_HOSTED_INTERNAL_SECRET=<shared-secret>`
- `CHATKIT_VISUALIZATIONS_INTERNAL_SECRET=<same-shared-secret>`

The visualization backend exposes `generate_visualization_image`. The browser
executes that client tool through `components/ai/chatkit/VisualizationChatKit.tsx`,
which calls `api.ai.imageGen.generation.generateVisualization`. That Convex
action uses OpenAI `gpt-image-2` and stores generated files in the existing R2
visualization path.

Usage accounting is split intentionally:

- ChatKit text/reasoning usage: `feature=visualizations`, `mode=chatkit_visualizations`
- GPT Image generation usage: `feature=visualizations`, `mode=visualization`

## Railway networking

Use Railway private networking so the Next.js app can reach the ChatKit backend over an internal hostname. Railway documents both public and private networking here:

- [Networking](https://docs.railway.com/guides/networking)

If you expose the ChatKit backend publicly, keep the proxy in front of it anyway and reject all requests that do not contain the internal secret.

## Health checks

The app now exposes:

- `/api/healthz`

Use that as the Railway healthcheck path for the Next.js service.
