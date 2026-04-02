import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()

const targetDirs = ["app", "components", "lib", "hooks"]
const excludedPathFragments = [
  `components${path.sep}ui${path.sep}`,
  `tests${path.sep}`,
  `chrome-extension${path.sep}`,
]

const forbiddenRules = [
  {
    name: "legacy-ui-token-override",
    regex: /\b(?:bg|text|border|from|via|to)-\[(?:color:)?var\(--ui[^)]*\)\]/g,
    message: "Use shadcn semantic variants/components instead of legacy --ui* token styling.",
  },
  {
    name: "legacy-font-token-override",
    regex: /\bfont-\[var\(--font[^)]*\)\]/g,
    message: "Do not set typography from app code; use the theme fonts and component APIs.",
  },
  {
    name: "space-stack-utilities",
    regex: /\bspace-[xy]-\d+\b/g,
    message: "Use flex/grid with gap-* instead of space-x/space-y utilities.",
  },
  {
    name: "raw-gray-palette",
    regex: /\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone)-\d{2,3}\b/g,
    message: "Use semantic shadcn tokens like bg-muted, text-muted-foreground, border-border.",
  },
  {
    name: "raw-brand-palette",
    regex: /\b(?:bg|text|border|from|via|to)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-\d{2,3}\b/g,
    message: "Use semantic variants or shared UI components instead of raw palette classes.",
  },
  {
    name: "custom-shadow",
    regex: /\bshadow-(?:soft-[a-z]+|\[[^\]]+\])/g,
    message: "Do not apply custom shadows from feature code; use component defaults.",
  },
  {
    name: "arbitrary-radius",
    regex: /\brounded-\[[^\]]+\]/g,
    message: "Use shadcn radius scale/variants instead of arbitrary rounded values.",
  },
]

function getFiles() {
  const output = execSync(
    `rg --files ${targetDirs.map((dir) => `"${dir}"`).join(" ")}`,
    { cwd, encoding: "utf8" },
  )

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => !excludedPathFragments.some((fragment) => file.includes(fragment)))
    .filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file))
}

function getLineNumber(source, index) {
  return source.slice(0, index).split("\n").length
}

const findings = []

for (const file of getFiles()) {
  const absolutePath = path.join(cwd, file)
  const source = fs.readFileSync(absolutePath, "utf8")

  for (const rule of forbiddenRules) {
    for (const match of source.matchAll(rule.regex)) {
      findings.push({
        file,
        line: getLineNumber(source, match.index ?? 0),
        value: match[0],
        rule: rule.name,
        message: rule.message,
      })
    }
  }
}

if (findings.length === 0) {
  console.log("shadcn-discipline: OK")
  process.exit(0)
}

console.error("shadcn-discipline: found forbidden manual styling outside components/ui")
for (const finding of findings.slice(0, 200)) {
  console.error(
    `${finding.file}:${finding.line} [${finding.rule}] ${finding.value}\n  ${finding.message}`,
  )
}

if (findings.length > 200) {
  console.error(`...and ${findings.length - 200} more violations`)
}

process.exit(1)
