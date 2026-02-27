/**
 * Stream Response Builder Helpers
 * 
 * Utility functions for parsing and summarizing tool results
 * from AI streaming responses.
 */

// ==================== TYPES ====================

export type ToolCallRecord = {
  toolName?: string;
  name?: string;
  args?: unknown;
};

export type ToolResultRecord = {
  result?: unknown;
  output?: unknown;
};

// ==================== JSON PARSING ====================

export const safeParseJSON = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ==================== TASK SUMMARIZATION ====================

export const summarizeTasksFromSearch = (data: any): string | null => {
  if (!data) return null;
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.found === "number"
      ? data.found
      : Array.isArray(data.tasks)
      ? data.tasks.length
      : null;

  if (total === null) {
    return null;
  }

  const parts: string[] = [`I found ${total} tasks in this project.`];

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    const statusCounts = data.tasks.reduce(
      (acc: Record<string, number>, task: any) => {
        const status = typeof task.status === "string" ? task.status : "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {},
    );

    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ");

    if (statusSummary.length > 0) {
      parts.push(`Status breakdown: ${statusSummary}.`);
    }

    const examples = data.tasks.slice(0, 3);
    if (examples.length > 0) {
      const exampleLines = examples
        .map((task: any) => {
          const title = typeof task.title === "string" ? task.title : "Untitled";
          const status = typeof task.status === "string" ? task.status : "unknown";
          return `• ${title} (${status})`;
        })
        .join("\n");
      parts.push(`Examples:\n${exampleLines}`);
    }
  }

  return parts.join(" ");
};

// ==================== PROJECT SUMMARIZATION ====================

export const summarizeProjectCounts = (data: any): string | null => {
  if (!data || !data.counts) return null;
  const counts = data.counts;
  if (typeof counts.tasks !== "number") return null;

  const parts: string[] = [`You have ${counts.tasks} tasks in this project.`];

  const otherSections: Array<{ label: string; value?: number }> = [
    { label: "notes", value: counts.notes },
    { label: "shopping items", value: counts.shoppingItems },
    { label: "contacts", value: counts.contacts },
    { label: "surveys", value: counts.surveys },
  ];

  const extras = otherSections
    .filter((entry) => typeof entry.value === "number")
    .map((entry) => `${entry.value} ${entry.label}`);

  if (extras.length > 0) {
    parts.push(`Also: ${extras.join(", ")}.`);
  }

  return parts.join(" ");
};

// ==================== SHOPPING SUMMARIZATION ====================

export const summarizeShoppingSearch = (data: any): string | null => {
  if (!data) return null;
  const total = typeof data.total === "number" ? data.total : data.items?.length;
  if (typeof total !== "number") return null;

  const parts: string[] = [`I found ${total} shopping list items.`];

  if (Array.isArray(data.items) && data.items.length > 0) {
    const examples = data.items.slice(0, 3);
    const exampleLines = examples
      .map((item: any) => {
        const name = typeof item.name === "string" ? item.name : "(unnamed)";
        const section =
          typeof item.sectionName === "string"
            ? item.sectionName
            : typeof item.sectionId === "string"
            ? `section ${item.sectionId}`
            : "no section";
        return `• ${name} (${section})`;
      })
      .join("\n");
    parts.push(`Examples:\n${exampleLines}`);
  }

  return parts.join(" ");
};

// ==================== FALLBACK RESPONSE BUILDER ====================

export const buildFallbackResponseFromTools = (
  toolCalls: ToolCallRecord[],
  toolResults: ToolResultRecord[],
): string | null => {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const toolName = toolCalls[i]?.toolName || toolCalls[i]?.name;
    if (!toolName) continue;

    const rawResult =
      toolResults[i]?.result ?? toolResults[i]?.output ?? toolResults[i];
    const parsedResult = safeParseJSON(rawResult);

    if (toolName === "load_full_project_context") {
      const summary = summarizeProjectCounts(parsedResult);
      if (summary) {
        return summary;
      }
    }

    if (toolName === "search_items") {
      const parsedArgs = safeParseJSON(toolCalls[i]?.args) as
        | { type?: string }
        | null;
      const searchType = parsedArgs?.type;

      if (searchType === "task") {
        const summary = summarizeTasksFromSearch(parsedResult);
        if (summary) {
          return summary;
        }
      }

      if (searchType === "shopping") {
        const summary = summarizeShoppingSearch(parsedResult);
        if (summary) {
          return summary;
        }
      }
    }
  }

  return null;
};
















