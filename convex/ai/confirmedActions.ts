/**
 * Confirmed Actions - Re-exports
 * 
 * This file re-exports all confirmed actions from the confirmedActions/ folder.
 * 
 * The actual implementations are now organized by entity type:
 * - confirmedActions/tasks.ts - Task CRUD
 * - confirmedActions/notes.ts - Note CRUD
 * - confirmedActions/shopping.ts - Shopping items, sets, and sections CRUD
 * - confirmedActions/surveys.ts - Survey CRUD
 * - confirmedActions/contacts.ts - Contact CRUD
 * - confirmedActions/payments.ts - Payment CRUD
 * - confirmedActions/moodboard.ts - Moodboard section CRUD
 * - confirmedActions/helpers.ts - Access control helpers
 */

export {
  // Tasks
  createConfirmedTask,
  editConfirmedTask,
  deleteConfirmedTask,
  
  // Notes
  createConfirmedNote,
  editConfirmedNote,
  deleteConfirmedNote,
  
  // Shopping
  createConfirmedShoppingItem,
  createConfirmedShoppingSet,
  createConfirmedShoppingSection,
  editConfirmedShoppingItem,
  editConfirmedShoppingSet,
  editConfirmedShoppingSection,
  deleteConfirmedShoppingItem,
  deleteConfirmedShoppingSet,
  deleteConfirmedShoppingSection,
  
  // Labor
  createConfirmedLaborItem,
  createConfirmedLaborSection,
  editConfirmedLaborItem,
  editConfirmedLaborSection,
  deleteConfirmedLaborItem,
  deleteConfirmedLaborSection,
  
  // Surveys
  createConfirmedSurvey,
  editConfirmedSurvey,
  deleteConfirmedSurvey,
  
  // Contacts
  createConfirmedContact,
  editConfirmedContact,
  deleteConfirmedContact,

  // Payments
  createConfirmedPayment,
  editConfirmedPayment,
  deleteConfirmedPayment,

  // Moodboard
  createConfirmedMoodboardSection,
  editConfirmedMoodboardSection,
  deleteConfirmedMoodboardSection,
} from "./confirmedActions/index";
