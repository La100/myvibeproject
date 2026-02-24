# AI Assistant Playwright Workflow

This workflow automates end-to-end browser checks for the AI assistant using the Playwright CLI wrapper (`$PWCLI`).

## What it covers

- Assistant page load and readiness checks
- Quick prompt flow ("Status Check") or fallback prompt
- Standard prompt/response flow
- Stop generation flow
- Auto-confirm switch toggle
- CRUD confirmation flow (Confirm/Confirm All/Create/Update/Delete button paths)
- Attachment upload + follow-up prompt
- Reset chat flow
- Screenshots and snapshots for debugging

## Prerequisites

1. Start the app:

```bash
cd /Users/cinu/Desktop/myvibeproject
npm run dev
```

2. Ensure you can access the AI page in browser (auth + team/project context).

3. Ensure `npx` exists:

```bash
command -v npx >/dev/null 2>&1 && echo "npx ok"
```

## Run

Option A (recommended): pass direct AI URL

```bash
cd /Users/cinu/Desktop/myvibeproject
AI_PROJECT_URL="http://127.0.0.1:3001/organisation/projects/<project-slug>/ai" \
bash output/playwright/ai-assistant/full-workflow.sh
```

Option B: pass slug only

```bash
cd /Users/cinu/Desktop/myvibeproject
PROJECT_SLUG="<project-slug>" \
bash output/playwright/ai-assistant/full-workflow.sh
```

## Useful env flags

- `HEADED=1` (default): run with visible browser
- `MANUAL_LOGIN=1` (default): allow manual login pause if session is not authenticated
- `KEEP_BROWSER_OPEN=1` (default): keep browser open after completion
- `PROMPT_TIMEOUT_MS=180000` (default): max wait for assistant responses
- `PLAYWRIGHT_CLI_SESSION=<name>`: stable session name for reruns (default in script: `ai1`)
  - Keep it short (recommended <= 16 chars) to avoid Unix socket path errors on macOS.
- `PWCLI_STATE_FILE=<path>`: persisted auth state file (default: `output/playwright/ai-assistant/storage-state.json`)
- `PWCLI_CONFIG=<path>`: Playwright CLI config path (default: `output/playwright/ai-assistant/playwright-cli.json`)

Example (headless-style run and auto-close):

```bash
cd /Users/cinu/Desktop/myvibeproject
AI_PROJECT_URL="http://127.0.0.1:3001/organisation/projects/<project-slug>/ai" \
HEADED=0 \
MANUAL_LOGIN=0 \
KEEP_BROWSER_OPEN=0 \
PLAYWRIGHT_CLI_SESSION="ai-assistant-ci" \
bash output/playwright/ai-assistant/full-workflow.sh
```

To avoid repeated Google re-login, keep one fixed session and do not close browser:

```bash
cd /Users/cinu/Desktop/myvibeproject
PLAYWRIGHT_CLI_SESSION=ai1 \
KEEP_BROWSER_OPEN=1 \
AI_PROJECT_URL="http://localhost:3001/organisation/projects/test/ai" \
bash output/playwright/ai-assistant/full-workflow.sh
```

Notes:

- First run may still require manual Google login.
- After login, script saves browser auth state to:
  `/Users/cinu/Desktop/myvibeproject/output/playwright/ai-assistant/storage-state.json`
- Next runs reuse this state automatically.
- If auth gets stale/corrupted, remove state file and run again:

```bash
rm -f /Users/cinu/Desktop/myvibeproject/output/playwright/ai-assistant/storage-state.json
```

## Artifacts

Saved under:

`/Users/cinu/Desktop/myvibeproject/output/playwright/ai-assistant`

Includes:

- `01-ready.png` ... `08-after-reset.png`
- `00-initial-snapshot.txt`
- `99-final-snapshot.txt`
- `assistant-context.txt`
