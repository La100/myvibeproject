#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/output/playwright/ai-assistant"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"

RAW_SESSION="${PLAYWRIGHT_CLI_SESSION:-ai1}"
APP_URL="${APP_URL:-http://127.0.0.1:3001}"
PROJECT_SLUG="${PROJECT_SLUG:-}"
AI_PROJECT_URL="${AI_PROJECT_URL:-}"
PWCLI_CONFIG="${PWCLI_CONFIG:-${ARTIFACT_DIR}/playwright-cli.json}"
PWCLI_STATE_FILE="${PWCLI_STATE_FILE:-${ARTIFACT_DIR}/storage-state.json}"
HEADED="${HEADED:-1}"
MANUAL_LOGIN="${MANUAL_LOGIN:-1}"
KEEP_BROWSER_OPEN="${KEEP_BROWSER_OPEN:-1}"
PROMPT_TIMEOUT_MS="${PROMPT_TIMEOUT_MS:-180000}"

# Playwright CLI uses Unix sockets for sessions; on macOS the socket path length is limited.
# Keep session name short to avoid: listen EINVAL ... .sock
sanitize_session() {
  local raw="$1"
  local cleaned hash suffix
  cleaned="$(printf '%s' "$raw" | tr -cd '[:alnum:]_-')"
  if [[ -z "$cleaned" ]]; then
    cleaned="ai$(date +%H%M%S)"
  fi

  if [[ ${#cleaned} -le 16 ]]; then
    printf '%s\n' "$cleaned"
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    hash="$(printf '%s' "$cleaned" | shasum | awk '{print $1}')"
    suffix="${hash:0:4}"
  else
    suffix="$(date +%S)"
  fi
  printf '%s-%s\n' "${cleaned:0:11}" "$suffix"
}

SESSION="$(sanitize_session "$RAW_SESSION")"

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required but not found on PATH."
  exit 1
fi

if [[ ! -x "$PWCLI" ]]; then
  echo "Error: Playwright wrapper not found: $PWCLI"
  echo "Set PWCLI explicitly or install the skill under \$CODEX_HOME/skills/playwright."
  exit 1
fi

if [[ -z "$AI_PROJECT_URL" ]]; then
  if [[ -z "$PROJECT_SLUG" ]]; then
    echo "Error: set AI_PROJECT_URL or PROJECT_SLUG."
    echo "Example: PROJECT_SLUG=my-project-slug $0"
    exit 1
  fi
  AI_PROJECT_URL="${APP_URL%/}/organisation/projects/${PROJECT_SLUG}/ai"
fi

mkdir -p "$ARTIFACT_DIR"

ATTACHMENT_FILE="${ARTIFACT_DIR}/assistant-context.txt"
cat >"$ATTACHMENT_FILE" <<'TXT'
Project context for AI smoke test:
- Focus: bathroom renovation.
- Budget target: 18,000.
- Deadline: 8 weeks.
- Team: electrician, plumber, tiler.
TXT

write_pwcli_config() {
  if [[ -f "$PWCLI_STATE_FILE" ]]; then
    cat >"$PWCLI_CONFIG" <<JSON
{
  "browser": {
    "contextOptions": {
      "storageState": "$PWCLI_STATE_FILE",
      "viewport": { "width": 1440, "height": 900 }
    }
  }
}
JSON
  else
    cat >"$PWCLI_CONFIG" <<JSON
{
  "browser": {
    "contextOptions": {
      "viewport": { "width": 1440, "height": 900 }
    }
  }
}
JSON
  fi
}

write_pwcli_config

pw() {
  "$PWCLI" --config "$PWCLI_CONFIG" --session "$SESSION" "$@"
}

pw_try() {
  set +e
  pw "$@"
  local status=$?
  set -e
  return "$status"
}

echo "==> Session: $SESSION"
echo "==> URL: $AI_PROJECT_URL"
echo "==> Artifacts: $ARTIFACT_DIR"
if [[ -f "$PWCLI_STATE_FILE" ]]; then
  echo "==> Auth state: $PWCLI_STATE_FILE"
else
  echo "==> Auth state: none (first run may require login)"
fi

open_args=(open "$AI_PROJECT_URL")
if [[ "$HEADED" == "1" ]]; then
  open_args+=(--headed)
fi
pw "${open_args[@]}"

INITIAL_WAIT_JS="$(cat <<'JS'
const timeoutMs = 20000;
const handle = await page.waitForFunction(
  () => {
    const text = document.body?.innerText ?? "";
    if (/No AI tokens available|Tokens exhausted/i.test(text)) {
      return "quota-blocked";
    }
    const input = document.querySelector("#assistant-chat-input");
    if (input && input instanceof HTMLTextAreaElement && !input.disabled && input.offsetParent !== null) {
      return "ready";
    }
    return null;
  },
  { timeout: timeoutMs },
);
const result = await handle.jsonValue();
if (result !== "ready") {
  throw new Error(`assistant-not-ready:${result}`);
}
JS
)"

if ! pw_try run-code "$INITIAL_WAIT_JS"; then
  if [[ "$MANUAL_LOGIN" != "1" ]]; then
    echo "Assistant input is not ready and MANUAL_LOGIN=0."
    exit 1
  fi

  echo "==> Login/manual step required."
  echo "    Complete sign-in in the opened browser and return to the AI Assistant page."
  read -r -p "    Press Enter to continue..."

  pw run-code "$(cat <<'JS'
const timeoutMs = 120000;
const handle = await page.waitForFunction(
  () => {
    const text = document.body?.innerText ?? "";
    if (/No AI tokens available|Tokens exhausted/i.test(text)) {
      return "quota-blocked";
    }
    const input = document.querySelector("#assistant-chat-input");
    if (input && input instanceof HTMLTextAreaElement && !input.disabled && input.offsetParent !== null) {
      return "ready";
    }
    return null;
  },
  { timeout: timeoutMs },
);
const result = await handle.jsonValue();
if (result !== "ready") {
  throw new Error(`assistant-not-ready:${result}`);
}
JS
)"
fi

# Persist authenticated browser state for future runs.
PWCLI_STATE_FILE="$PWCLI_STATE_FILE" pw run-code "$(cat <<'JS'
const stateFile = process.env.PWCLI_STATE_FILE;
if (!stateFile) {
  throw new Error("missing-state-file-path");
}
await page.context().storageState({ path: stateFile });
JS
)"
write_pwcli_config

pw snapshot >"${ARTIFACT_DIR}/00-initial-snapshot.txt" || true

ARTIFACT_DIR="$ARTIFACT_DIR" \
ATTACHMENT_FILE="$ATTACHMENT_FILE" \
PROMPT_TIMEOUT_MS="$PROMPT_TIMEOUT_MS" \
pw run-code "$(cat <<'JS'
const artifactDir = process.env.ARTIFACT_DIR;
const attachmentPath = process.env.ATTACHMENT_FILE;
const promptTimeoutMs = Number(process.env.PROMPT_TIMEOUT_MS || "180000");

const wait = (ms) => page.waitForTimeout(ms);

async function screenshot(name) {
  await page.screenshot({ path: `${artifactDir}/${name}`, fullPage: true });
}

async function isVisible(locator, timeout = 1500) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

async function ensureAssistantReady(timeoutMs = 90000) {
  const handle = await page.waitForFunction(
    () => {
      const bodyText = document.body?.innerText ?? "";
      if (/No AI tokens available|Tokens exhausted/i.test(bodyText)) {
        return "quota-blocked";
      }
      const input = document.querySelector("#assistant-chat-input");
      if (input && input instanceof HTMLTextAreaElement && !input.disabled && input.offsetParent !== null) {
        return "ready";
      }
      return null;
    },
    { timeout: timeoutMs },
  );
  const result = await handle.jsonValue();
  if (result !== "ready") {
    throw new Error(`assistant-not-ready:${result}`);
  }
}

async function sendMessage(prompt, options = {}) {
  const { stopEarly = false, expectReply = true } = options;

  const userBefore = await page.evaluate(
    () => document.querySelectorAll("[data-role='user']").length,
  );
  const assistantBefore = await page.evaluate(
    () => document.querySelectorAll("[data-role='assistant']").length,
  );

  const input = page.locator("#assistant-chat-input");
  await input.waitFor({ state: "visible", timeout: 30000 });
  await input.fill(prompt);

  const sendButton = page.getByRole("button", { name: /Send message/i });
  await sendButton.waitFor({ state: "visible", timeout: 10000 });
  await sendButton.click();

  await page.waitForFunction(
    (baseline) => document.querySelectorAll("[data-role='user']").length > baseline,
    userBefore,
    { timeout: 20000 },
  );

  if (stopEarly) {
    const stopButton = page.getByRole("button", { name: /Stop generating/i });
    if (await isVisible(stopButton, 15000)) {
      await stopButton.first().click();
    }
  }

  if (!expectReply) {
    return;
  }

  await page.waitForFunction(
    (baseline) => document.querySelectorAll("[data-role='assistant']").length > baseline,
    assistantBefore,
    { timeout: promptTimeoutMs },
  );

  const stopButton = page.getByRole("button", { name: /Stop generating/i });
  try {
    await stopButton.waitFor({ state: "hidden", timeout: promptTimeoutMs });
  } catch {
    // If hidden wait fails, continue with content check below.
  }

  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll(
        "[data-role='assistant'] .aui-assistant-message-content",
      );
      if (!nodes.length) return false;
      const last = nodes[nodes.length - 1];
      return (last.textContent ?? "").trim().length > 0;
    },
    { timeout: promptTimeoutMs },
  );
}

await ensureAssistantReady(90000);
await screenshot("01-ready.png");

// Scenario 1: quick prompt when available, otherwise fallback prompt.
const quickPrompt = page.getByRole("button", { name: /Status Check/i });
if (await isVisible(quickPrompt, 3000)) {
  const assistantBefore = await page.evaluate(
    () => document.querySelectorAll("[data-role='assistant']").length,
  );
  await quickPrompt.first().click();
  await page.waitForFunction(
    (baseline) => document.querySelectorAll("[data-role='assistant']").length > baseline,
    assistantBefore,
    { timeout: promptTimeoutMs },
  );
} else {
  await sendMessage(
    "Provide a concise status check for this project with risks and next actions.",
  );
}
await screenshot("02-after-quick-prompt.png");

// Scenario 2: standard prompt/response.
await sendMessage(
  "List the top 3 renovation risks this week and give one mitigation for each.",
);
await screenshot("03-after-standard-prompt.png");

// Scenario 3: streaming stop flow.
await sendMessage(
  "Write a very long renovation plan with 100 numbered points and detailed explanations.",
  { stopEarly: true, expectReply: true },
);
await screenshot("04-after-stop-generation.png");

// Scenario 4: toggle auto-confirm mode on and off.
const autoConfirmSwitch = page.getByRole("switch", {
  name: /Auto accept CRUD actions/i,
});
if (await isVisible(autoConfirmSwitch, 6000)) {
  await autoConfirmSwitch.first().click();
  await wait(1000);
  await autoConfirmSwitch.first().click();
  await wait(1000);
}
await screenshot("05-after-toggle-mode.png");

// Scenario 5: confirmation flow for CRUD action.
await sendMessage(
  "Create exactly one task titled Playwright Smoke Task with status todo and medium priority.",
);
await wait(2000);

const confirmAllButton = page.getByRole("button", { name: /^Confirm All$/i });
const createButton = page.getByRole("button", { name: /^(Create|Update|Delete) /i });
const confirmButton = page.getByRole("button", { name: /^Confirm$/i });

if (await isVisible(confirmAllButton, 3000)) {
  await confirmAllButton.first().click();
} else if (await isVisible(createButton, 3000)) {
  await createButton.first().click();
} else if (await isVisible(confirmButton, 3000)) {
  await confirmButton.first().click();
}

await wait(2000);
await screenshot("06-after-confirmation.png");

// Scenario 6: attachment + question.
let fileInput = page.locator("input[type='file']");
if ((await fileInput.count()) === 0) {
  const addAttachment = page.getByRole("button", { name: /Add Attachment/i });
  await addAttachment.waitFor({ state: "visible", timeout: 15000 });
  await addAttachment.click();
  await wait(250);
  fileInput = page.locator("input[type='file']");
}
if ((await fileInput.count()) === 0) {
  throw new Error("file-input-not-found");
}
await fileInput.first().setInputFiles(attachmentPath);
await sendMessage(
  "Read the attached file and summarize key project constraints in 3 bullet points.",
);
await screenshot("07-after-attachment-flow.png");

// Scenario 7: reset chat and verify welcome view.
const resetButton = page.getByRole("button", { name: /Reset chat/i });
await resetButton.waitFor({ state: "visible", timeout: 15000 });
await resetButton.click();
await page.getByText("Hi, I'm Vibe.").first().waitFor({ state: "visible", timeout: 30000 });
await screenshot("08-after-reset.png");

return "workflow-complete";
JS
)"

pw snapshot >"${ARTIFACT_DIR}/99-final-snapshot.txt" || true

if [[ "$KEEP_BROWSER_OPEN" != "1" ]]; then
  pw close || true
fi

echo "==> Done. Artifacts saved in: $ARTIFACT_DIR"
