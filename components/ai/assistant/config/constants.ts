type QuickPrompt = {
  label: string;
  prompt: string;
};

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    label: "Set Up Phases",
    prompt: "Create 6 renovation tasks in sequence: demolition, rough-in electrical, rough-in plumbing, finishing (tiling/painting), fixture installation, and final inspection. Set status to todo, assign priorities, and include dependency notes.",
  },
  {
    label: "Material List",
    prompt: "Create shopping sections by phase (demolition, rough-in, finishing, fixtures) and add a starter material list with estimated quantities and unit prices in project currency. Use quantity=1 when unknown and mark unclear prices as TBD.",
  },
  {
    label: "Labor Costs",
    prompt: "Create labor items by trade (electrician, plumber, tiler, painter, carpenter) with estimated hours, unit=hour, and unitPrice in project currency. Add a note with the total estimated labor cost.",
  },
  {
    label: "Add Contractors",
    prompt: "Create contacts for electrician, plumber, tiler, painter, and general contractor. Set type=contractor and leave unknown fields empty instead of inventing placeholder details.",
  },
  {
    label: "Week Plan",
    prompt: "Starting from next Monday, create a week-by-week renovation plan with start/end dates and milestones for demolition, rough-in, installations, finishing, and handover.",
  },
  {
    label: "Status Check",
    prompt: "Load the full project context and provide a concise status report: completed, in progress, overdue/blocked, top 3 risks, and recommended actions for this week.",
  },
];

export const MAX_FILE_SIZE_MB = 32;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
