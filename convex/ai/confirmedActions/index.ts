/**
 * Confirmed Actions - Barrel Export
 * 
 * Re-exports all confirmed action functions for AI suggestions.
 * These actions require user confirmation before execution.
 */

// Helpers (for internal use)
export { requireIdentity, ensureProjectAccess, ensureTeamMembership } from "./helpers";

// Task actions
export { createConfirmedTask, editConfirmedTask, deleteConfirmedTask } from "./tasks";

// Note actions
export { createConfirmedNote, editConfirmedNote, deleteConfirmedNote } from "./notes";

// Shopping actions
export {
  createConfirmedShoppingItem,
  createConfirmedShoppingSection,
  editConfirmedShoppingItem,
  editConfirmedShoppingSection,
  deleteConfirmedShoppingItem,
  deleteConfirmedShoppingSection,
} from "./shopping";

// Labor actions
export {
  createConfirmedLaborItem,
  createConfirmedLaborSection,
  editConfirmedLaborItem,
  editConfirmedLaborSection,
  deleteConfirmedLaborItem,
  deleteConfirmedLaborSection,
} from "./labor";

// Survey actions
export { createConfirmedSurvey, editConfirmedSurvey, deleteConfirmedSurvey } from "./surveys";

// Contact actions
export { createConfirmedContact, editConfirmedContact, deleteConfirmedContact } from "./contacts";

// Moodboard actions
export {
  createConfirmedMoodboardSection,
  editConfirmedMoodboardSection,
  deleteConfirmedMoodboardSection,
} from "./moodboard";

















