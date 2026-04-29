export type QuickPrompt = {
  label: string;
  prompt: string;
};

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: "Project Status",
    prompt: "Review the current project and give me a concise status update: what is done, what is in progress, what is blocked, what is overdue, and the top 3 priorities for this week.",
  },
  {
    label: "Next Steps",
    prompt: "Based on the current project state, suggest the next practical steps. If tasks are missing, prepare a short action plan grouped by phase and priority.",
  },
  {
    label: "Budget Check",
    prompt: "Review the project budget, shopping items, and labor costs. Flag overspend risks, missing estimates, and the biggest cost drivers, then recommend corrective actions.",
  },
];

const MAX_FILE_SIZE_MB = 32;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export { MAX_FILE_SIZE_MB };
