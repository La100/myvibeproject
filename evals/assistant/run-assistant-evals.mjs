import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const cases = JSON.parse(
  readFileSync(join(root, "evals/assistant/shopping-sourcing.cases.json"), "utf8"),
);

const files = {
  prompt: readFileSync(join(root, "convex/ai/prompt.ts"), "utf8"),
  clientTools: readFileSync(
    join(root, "components/ai/assistant/chatkit/useChatKitClientTools.ts"),
    "utf8",
  ),
  hostedChatKit: readFileSync(
    join(root, "components/ai/chatkit/HostedChatKit.tsx"),
    "utf8",
  ),
  railwayChatKit: readFileSync(join(root, "myvibe-chatkit/main.py"), "utf8"),
  convexTools: readFileSync(join(root, "convex/ai/tools.ts"), "utf8"),
};

const policyText = Object.values(files).join("\n").replaceAll("\\`", "`");
const failures = [];

for (const testCase of cases) {
  if (/[ąćęłńóśźż]/i.test(testCase.prompt ?? "")) {
    failures.push(`${testCase.id}: prompt must stay English-only`);
  }
  if (/\b(jutro|dzisiaj|pojutrze|lista|zakup|zakupy|usuń|usun|przypisz)\b/i.test(testCase.prompt ?? "")) {
    failures.push(`${testCase.id}: prompt must stay focused on English workflow cases`);
  }

  for (const required of testCase.mustContainPolicy ?? []) {
    if (!policyText.includes(required)) {
      failures.push(`${testCase.id}: missing required policy text "${required}"`);
    }
  }
}

const globalRequired = [
  ["failed sourcing guard", "isFailedSourcingPlaceholder"],
  ["generic product URL rejection", "isGenericProductSourceUrl"],
  ["client tool argument summary", "summarizeClientToolArgs"],
  ["Railway tool argument summary", "summarize_tool_payload"],
  ["Railway emit arg summary", "arg_summary=summarize_tool_payload"],
  ["server retail sourcing tool", "source_retail_products"],
  ["server retail sourcing helper", "build_retail_source_query"],
  ["retail-first runtime policy", "search retail stores and official brand sites first"],
  ["sourced productLink description", "Required when creating an item found through external product sourcing"],
];

for (const [label, needle] of globalRequired) {
  if (!policyText.includes(needle)) {
    failures.push(`${label}: missing "${needle}"`);
  }
}

if (failures.length > 0) {
  console.error("Assistant evals failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Assistant evals passed (${cases.length} sourcing cases).`);
