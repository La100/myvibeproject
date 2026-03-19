"use client";

import { useCallback } from "react";
import { useConvex } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";

type ToolCall = {
  name: string;
  params: Record<string, unknown>;
};

type UseChatKitClientToolsArgs = {
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  teamSlug: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function asTaskStatus(value: unknown): "todo" | "in_progress" | "review" | "done" | undefined {
  if (value === "todo" || value === "in_progress" || value === "review" || value === "done") {
    return value;
  }
  return undefined;
}

function asTaskPriority(
  value: unknown,
): "low" | "medium" | "high" | "urgent" | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }
  return undefined;
}

function asShoppingStatus(
  value: unknown,
): "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED" | undefined {
  if (
    value === "PLANNED" ||
    value === "ORDERED" ||
    value === "IN_TRANSIT" ||
    value === "DELIVERED" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return undefined;
}

function asSurveyQuestionType(
  value: unknown,
):
  | "text_short"
  | "text_long"
  | "multiple_choice"
  | "single_choice"
  | "rating"
  | "yes_no"
  | "number"
  | "file"
  | undefined {
  if (
    value === "text_short" ||
    value === "text_long" ||
    value === "multiple_choice" ||
    value === "single_choice" ||
    value === "rating" ||
    value === "yes_no" ||
    value === "number" ||
    value === "file"
  ) {
    return value;
  }
  return undefined;
}

function asTimestamp(value: unknown): number | undefined {
  const direct = asNumber(value);
  if (direct !== undefined) return direct;

  const text = asNonEmptyString(value);
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
  return normalized.length > 0 ? normalized : undefined;
}

function extractSurveyQuestions(value: unknown) {
  const items = asRecordArray(value);
  if (!items) return undefined;

  const questions = items
    .map((item) => {
      const questionText = asNonEmptyString(item.questionText) ?? asNonEmptyString(item.title);
      const questionType =
        asSurveyQuestionType(item.questionType) ?? asSurveyQuestionType(item.type);

      return {
        questionId: asNonEmptyString(item.questionId),
        operation: asNonEmptyString(item.operation) as "create" | "edit" | "delete" | undefined,
        questionText,
        questionType,
        options: asStringArray(item.options),
        isRequired: asBoolean(item.isRequired),
        order: asNumber(item.order),
      };
    })
    .filter((item) => item.questionText || item.questionId || item.operation);

  return questions.length > 0 ? questions : undefined;
}

function extractTaskTitle(params: Record<string, unknown>): string | undefined {
  return (
    asNonEmptyString(params.title) ??
    asNonEmptyString(params.taskTitle) ??
    asNonEmptyString(params.name)
  );
}

function extractShoppingName(params: Record<string, unknown>): string | undefined {
  return (
    asNonEmptyString(params.name) ??
    asNonEmptyString(params.productName) ??
    asNonEmptyString(params.selectedItemName) ??
    asNonEmptyString(params.itemName) ??
    asNonEmptyString(params.title)
  );
}

function joinNotes(...parts: Array<string | undefined>): string | undefined {
  const normalized = parts
    .map((part) => asNonEmptyString(part))
    .filter((part): part is string => Boolean(part));

  if (normalized.length === 0) return undefined;
  return normalized.join("\n");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "Unknown client tool error.";
}

function truncate(value: string | undefined, maxLength = 160): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function summarizeTask(task: Record<string, unknown>) {
  return {
    id: typeof task._id === "string" ? task._id : undefined,
    title:
      asNonEmptyString(task.title) ??
      asNonEmptyString(task.name) ??
      asNonEmptyString(task.description) ??
      "Untitled task",
    status: asNonEmptyString(task.status) ?? "todo",
    priority: asNonEmptyString(task.priority) ?? "medium",
    assignedTo: asNonEmptyString(task.assignedTo),
    endDate: asNumber(task.endDate),
    sectionId: asNonEmptyString(task.sectionId),
    description: truncate(asNonEmptyString(task.description) ?? asNonEmptyString(task.content)),
  };
}

function summarizeNote(note: Record<string, unknown>) {
  return {
    id: typeof note._id === "string" ? note._id : undefined,
    title: asNonEmptyString(note.title) ?? "Untitled note",
    excerpt: truncate(asNonEmptyString(note.content) ?? asNonEmptyString(note.description)),
  };
}

function summarizeShoppingItem(item: Record<string, unknown>) {
  return {
    id: typeof item._id === "string" ? item._id : undefined,
    name: asNonEmptyString(item.name) ?? "Unnamed item",
    quantity: asNumber(item.quantity) ?? 1,
    priority: asNonEmptyString(item.priority) ?? "medium",
    status: asNonEmptyString(item.realizationStatus) ?? "PLANNED",
    supplier: asNonEmptyString(item.supplier),
    unitPrice: asNumber(item.unitPrice),
    productLink: asNonEmptyString(item.productLink),
    notes: truncate(asNonEmptyString(item.notes)),
  };
}

function summarizeContact(contact: Record<string, unknown>) {
  return {
    id: typeof contact._id === "string" ? contact._id : undefined,
    name: asNonEmptyString(contact.name) ?? "Unnamed contact",
    companyName: asNonEmptyString(contact.companyName),
    email: asNonEmptyString(contact.email),
    phone: asNonEmptyString(contact.phone),
    specialization: asNonEmptyString(contact.specialization),
  };
}

function summarizeLaborItem(item: Record<string, unknown>) {
  return {
    id: typeof item._id === "string" ? item._id : undefined,
    name: asNonEmptyString(item.name) ?? "Unnamed labor item",
    quantity: asNumber(item.quantity) ?? 1,
    unit: asNonEmptyString(item.unit) ?? "item",
    assignedTo: asNonEmptyString(item.assignedTo),
    unitPrice: asNumber(item.unitPrice),
    totalPrice: asNumber(item.totalPrice),
    notes: truncate(asNonEmptyString(item.notes)),
  };
}

function summarizeSurvey(survey: Record<string, unknown>) {
  const questions = Array.isArray(survey.questions) ? survey.questions : [];

  return {
    id: typeof survey._id === "string" ? survey._id : undefined,
    title: asNonEmptyString(survey.title) ?? "Untitled survey",
    description: truncate(asNonEmptyString(survey.description)),
    status: asNonEmptyString(survey.status) ?? "draft",
    isRequired: asBoolean(survey.isRequired) ?? false,
    questionCount: questions.length,
  };
}

function summarizeProject(project: Record<string, unknown> | null) {
  if (!project) return null;

  return {
    id: typeof project._id === "string" ? project._id : undefined,
    title:
      asNonEmptyString(project.name) ??
      asNonEmptyString(project.title) ??
      "Project",
    description: truncate(asNonEmptyString(project.description)),
    status: asNonEmptyString(project.status),
    address: asNonEmptyString(project.address),
    budget: asNumber(project.budget),
  };
}

export function useChatKitClientTools({
  projectId,
  teamId,
  teamSlug,
}: UseChatKitClientToolsArgs) {
  const convex = useConvex();

  return useCallback(
    async ({ name, params }: ToolCall): Promise<Record<string, unknown>> => {
      try {
        switch (name) {
          case "create_task": {
            const title = extractTaskTitle(params);
            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_task.",
              };
            }

            const taskId = await convex.mutation(apiAny.tasks.createTask, {
              title,
              projectId,
              teamId,
              description: asNonEmptyString(params.description),
              content: asNonEmptyString(params.content),
              status: asTaskStatus(params.status) ?? "todo",
              priority: asTaskPriority(params.priority) ?? "medium",
              assignedTo: asNonEmptyString(params.assignedTo),
              startDate: asTimestamp(params.startDate),
              endDate: asTimestamp(params.endDate),
              tags: asStringArray(params.tags) ?? [],
              sectionId: asNonEmptyString(params.sectionId) ?? null,
              milestoneId: asNonEmptyString(params.milestoneId) ?? null,
            });

            return {
              ok: true,
              taskId,
              title,
              message: `Created task: ${title}`,
            };
          }

          case "update_task": {
            const taskId = asNonEmptyString(params.taskId);
            if (!taskId) {
              return {
                ok: false,
                error: "Missing required `taskId` for update_task.",
              };
            }

            const updates: Record<string, unknown> = {
              taskId,
            };

            const title = extractTaskTitle(params);
            if (title) updates.title = title;

            const description = asNonEmptyString(params.description);
            if (description !== undefined) updates.description = description;

            const content = asNonEmptyString(params.content);
            if (content !== undefined) updates.content = content;

            const status = asTaskStatus(params.status);
            if (status !== undefined) updates.status = status;

            const priority = asTaskPriority(params.priority);
            if (priority !== undefined) updates.priority = priority;

            const assignedTo = asNonEmptyString(params.assignedTo);
            if (assignedTo !== undefined) updates.assignedTo = assignedTo;

            const startDate = asTimestamp(params.startDate);
            if (startDate !== undefined) updates.startDate = startDate;

            const endDate = asTimestamp(params.endDate);
            if (endDate !== undefined) updates.endDate = endDate;

            const tags = asStringArray(params.tags);
            if (tags !== undefined) updates.tags = tags;

            await convex.mutation(apiAny.tasks.updateTask, updates);

            return {
              ok: true,
              taskId,
              message: "Task updated successfully.",
            };
          }

          case "delete_task": {
            const taskId = asNonEmptyString(params.taskId);
            if (!taskId) {
              return {
                ok: false,
                error: "Missing required `taskId` for delete_task.",
              };
            }

            await convex.mutation(apiAny.tasks.deleteTask, { taskId });

            return {
              ok: true,
              taskId,
              message: "Task deleted successfully.",
            };
          }

          case "create_shopping_item": {
            const name = extractShoppingName(params);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_shopping_item.",
              };
            }

            const quantity = asNumber(params.quantity) ?? 1;
            const unitPrice = asNumber(params.unitPrice) ?? asNumber(params.price);
            const supplier =
              asNonEmptyString(params.supplier) ??
              asNonEmptyString(params.store) ??
              asNonEmptyString(params.vendor);
            const productLink =
              asNonEmptyString(params.productLink) ??
              asNonEmptyString(params.url) ??
              asNonEmptyString(params.link);
            const notes = joinNotes(
              asNonEmptyString(params.notes),
              asNonEmptyString(params.storeAddress),
              asNonEmptyString(params.address),
              asNonEmptyString(params.selectionReason),
              asNonEmptyString(params.sourceSummary),
            );

            const itemId = await convex.mutation(apiAny.shopping.createShoppingListItem, {
              projectId,
              name,
              quantity,
              notes,
              buyBefore: asTimestamp(params.buyBefore),
              priority: asTaskPriority(params.priority) ?? "medium",
              imageUrl: asNonEmptyString(params.imageUrl),
              productLink,
              supplier,
              catalogNumber: asNonEmptyString(params.catalogNumber),
              category: asNonEmptyString(params.category),
              dimensions: asNonEmptyString(params.dimensions),
              unitPrice,
              alternativeToItemId: asNonEmptyString(params.alternativeToItemId) ?? null,
              selectedAlternativeItemId:
                asNonEmptyString(params.selectedAlternativeItemId) ?? null,
              realizationStatus: asShoppingStatus(params.realizationStatus) ?? "PLANNED",
              sectionId: asNonEmptyString(params.sectionId) ?? null,
              assignedTo: asNonEmptyString(params.assignedTo),
            });

            return {
              ok: true,
              itemId,
              name,
              quantity,
              message: `Created shopping item: ${name}`,
            };
          }

          case "update_shopping_item": {
            const itemId = asNonEmptyString(params.itemId);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for update_shopping_item.",
              };
            }

            const updates: Record<string, unknown> = {
              itemId,
            };

            const name = extractShoppingName(params);
            if (name !== undefined) updates.name = name;

            const notes = joinNotes(
              asNonEmptyString(params.notes),
              asNonEmptyString(params.storeAddress),
              asNonEmptyString(params.address),
              asNonEmptyString(params.selectionReason),
              asNonEmptyString(params.sourceSummary),
            );
            if (notes !== undefined) updates.notes = notes;

            const buyBefore = asTimestamp(params.buyBefore);
            if (buyBefore !== undefined) updates.buyBefore = buyBefore;

            const priority = asTaskPriority(params.priority);
            if (priority !== undefined) updates.priority = priority;

            const imageUrl = asNonEmptyString(params.imageUrl);
            if (imageUrl !== undefined) updates.imageUrl = imageUrl;

            const productLink =
              asNonEmptyString(params.productLink) ??
              asNonEmptyString(params.url) ??
              asNonEmptyString(params.link);
            if (productLink !== undefined) updates.productLink = productLink;

            const supplier =
              asNonEmptyString(params.supplier) ??
              asNonEmptyString(params.store) ??
              asNonEmptyString(params.vendor);
            if (supplier !== undefined) updates.supplier = supplier;

            const catalogNumber = asNonEmptyString(params.catalogNumber);
            if (catalogNumber !== undefined) updates.catalogNumber = catalogNumber;

            const category = asNonEmptyString(params.category);
            if (category !== undefined) updates.category = category;

            const dimensions = asNonEmptyString(params.dimensions);
            if (dimensions !== undefined) updates.dimensions = dimensions;

            const quantity = asNumber(params.quantity);
            if (quantity !== undefined) updates.quantity = quantity;

            const unitPrice = asNumber(params.unitPrice) ?? asNumber(params.price);
            if (unitPrice !== undefined) updates.unitPrice = unitPrice;

            const alternativeToItemId = asNonEmptyString(params.alternativeToItemId);
            if (alternativeToItemId !== undefined) updates.alternativeToItemId = alternativeToItemId;

            const selectedAlternativeItemId = asNonEmptyString(params.selectedAlternativeItemId);
            if (selectedAlternativeItemId !== undefined) {
              updates.selectedAlternativeItemId = selectedAlternativeItemId;
            }

            const realizationStatus = asShoppingStatus(params.realizationStatus);
            if (realizationStatus !== undefined) updates.realizationStatus = realizationStatus;

            const sectionId = asNonEmptyString(params.sectionId);
            if (sectionId !== undefined) updates.sectionId = sectionId;

            const assignedTo = asNonEmptyString(params.assignedTo);
            if (assignedTo !== undefined) updates.assignedTo = assignedTo;

            await convex.mutation(apiAny.shopping.updateShoppingListItem, updates);

            return {
              ok: true,
              itemId,
              message: "Shopping item updated successfully.",
            };
          }

          case "delete_shopping_item": {
            const itemId = asNonEmptyString(params.itemId);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for delete_shopping_item.",
              };
            }

            await convex.mutation(apiAny.shopping.deleteShoppingListItem, { itemId });

            return {
              ok: true,
              itemId,
              message: "Shopping item deleted successfully.",
            };
          }

          case "create_note": {
            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(params.name) ??
              asNonEmptyString(params.subject);

            const content =
              asNonEmptyString(params.content) ??
              asNonEmptyString(params.description) ??
              title;

            if (!title || !content) {
              return {
                ok: false,
                error: "Missing required `title` or `content` for create_note.",
              };
            }

            const noteId = await convex.mutation(apiAny.notes.createNote, {
              projectId,
              title,
              content,
            });

            return {
              ok: true,
              noteId,
              title,
              message: `Created note: ${title}`,
            };
          }

          case "update_note": {
            const noteId = asNonEmptyString(params.noteId);
            if (!noteId) {
              return {
                ok: false,
                error: "Missing required `noteId` for update_note.",
              };
            }

            const existingNote = await convex.query(apiAny.notes.getNote, { noteId });
            if (!existingNote) {
              return {
                ok: false,
                error: "Note not found.",
              };
            }

            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(existingNote.title) ??
              "Untitled note";
            const content =
              asNonEmptyString(params.content) ??
              asNonEmptyString(params.description) ??
              asNonEmptyString(existingNote.content) ??
              "";

            await convex.mutation(apiAny.notes.updateNote, {
              noteId,
              title,
              content,
            });

            return {
              ok: true,
              noteId,
              message: "Note updated successfully.",
            };
          }

          case "delete_note": {
            const noteId = asNonEmptyString(params.noteId);
            if (!noteId) {
              return {
                ok: false,
                error: "Missing required `noteId` for delete_note.",
              };
            }

            await convex.mutation(apiAny.notes.deleteNote, { noteId });

            return {
              ok: true,
              noteId,
              message: "Note deleted successfully.",
            };
          }

          case "create_contact": {
            const name =
              asNonEmptyString(params.name) ??
              asNonEmptyString(params.contactName) ??
              asNonEmptyString(params.title);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_contact.",
              };
            }

            const type =
              asNonEmptyString(params.type) ?? "other";

            const contactId = await convex.mutation(apiAny.contacts.createContact, {
              teamSlug,
              name,
              companyName: asNonEmptyString(params.companyName),
              email: asNonEmptyString(params.email),
              phone: asNonEmptyString(params.phone),
              address: asNonEmptyString(params.address),
              city: asNonEmptyString(params.city),
              postalCode: asNonEmptyString(params.postalCode),
              website: asNonEmptyString(params.website),
              taxId: asNonEmptyString(params.taxId),
              type,
              notes: asNonEmptyString(params.notes),
            });

            return {
              ok: true,
              contactId,
              name,
              message: `Created contact: ${name}`,
            };
          }

          case "update_contact": {
            const contactId = asNonEmptyString(params.contactId);
            if (!contactId) {
              return {
                ok: false,
                error: "Missing required `contactId` for update_contact.",
              };
            }

            const existingContact = await convex.query(apiAny.contacts.getContact, { contactId });
            if (!existingContact) {
              return {
                ok: false,
                error: "Contact not found.",
              };
            }

            await convex.mutation(apiAny.contacts.updateContact, {
              contactId,
              name:
                asNonEmptyString(params.name) ??
                asNonEmptyString(params.contactName) ??
                asNonEmptyString(existingContact.name) ??
                "Unnamed contact",
              companyName:
                asNonEmptyString(params.companyName) ??
                asNonEmptyString(existingContact.companyName),
              email: asNonEmptyString(params.email) ?? asNonEmptyString(existingContact.email),
              phone: asNonEmptyString(params.phone) ?? asNonEmptyString(existingContact.phone),
              address:
                asNonEmptyString(params.address) ?? asNonEmptyString(existingContact.address),
              city: asNonEmptyString(params.city) ?? asNonEmptyString(existingContact.city),
              postalCode:
                asNonEmptyString(params.postalCode) ??
                asNonEmptyString(existingContact.postalCode),
              website:
                asNonEmptyString(params.website) ?? asNonEmptyString(existingContact.website),
              taxId: asNonEmptyString(params.taxId) ?? asNonEmptyString(existingContact.taxId),
              type:
                asNonEmptyString(params.type) ??
                asNonEmptyString(existingContact.type) ??
                "other",
              notes: asNonEmptyString(params.notes) ?? asNonEmptyString(existingContact.notes),
            });

            return {
              ok: true,
              contactId,
              message: "Contact updated successfully.",
            };
          }

          case "delete_contact": {
            const contactId = asNonEmptyString(params.contactId);
            if (!contactId) {
              return {
                ok: false,
                error: "Missing required `contactId` for delete_contact.",
              };
            }

            await convex.mutation(apiAny.contacts.deleteContact, { contactId });

            return {
              ok: true,
              contactId,
              message: "Contact deleted successfully.",
            };
          }

          case "update_project_settings": {
            const payload: Record<string, unknown> = {
              projectId,
            };

            const name = asNonEmptyString(params.name);
            if (name !== undefined) payload.name = name;

            const description = asNonEmptyString(params.description);
            if (description !== undefined) payload.description = description;

            const coverImageUrl = asNonEmptyString(params.coverImageUrl);
            if (coverImageUrl !== undefined) payload.coverImageUrl = coverImageUrl;

            const status = asNonEmptyString(params.status);
            if (status !== undefined) payload.status = status;

            const customer = asNonEmptyString(params.customer);
            if (customer !== undefined) payload.customer = customer;

            const location = asNonEmptyString(params.location);
            if (location !== undefined) payload.location = location;

            const budget = asNumber(params.budget);
            if (budget !== undefined) payload.budget = budget;

            const currency = asNonEmptyString(params.currency);
            if (currency !== undefined) payload.currency = currency;

            const result = await convex.mutation(apiAny.projects.updateProject, payload);

            return {
              ok: true,
              slug: typeof result?.slug === "string" ? result.slug : undefined,
              message: "Project settings updated successfully.",
            };
          }

          case "create_shopping_section": {
            const name = asNonEmptyString(params.name);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_shopping_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.createConfirmedShoppingSection, {
              projectId,
              sectionData: { name },
            });

            return {
              ok: Boolean(result?.success),
              sectionId: typeof result?.sectionId === "string" ? result.sectionId : undefined,
              message:
                asNonEmptyString(result?.message) ?? `Created shopping section: ${name}`,
            };
          }

          case "update_shopping_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for update_shopping_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.editConfirmedShoppingSection, {
              sectionId,
              updates: {
                name: asNonEmptyString(params.name),
              },
            });

            return {
              ok: Boolean(result?.success),
              sectionId,
              message:
                asNonEmptyString(result?.message) ??
                "Shopping section updated successfully.",
            };
          }

          case "delete_shopping_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for delete_shopping_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.deleteConfirmedShoppingSection, {
              sectionId,
            });

            return {
              ok: Boolean(result?.success),
              sectionId,
              message:
                asNonEmptyString(result?.message) ??
                "Shopping section deleted successfully.",
            };
          }

          case "create_labor_item": {
            const name = asNonEmptyString(params.name);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_labor_item.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.createConfirmedLaborItem, {
              projectId,
              itemData: {
                name,
                quantity: asNumber(params.quantity) ?? 1,
                unit: asNonEmptyString(params.unit) ?? "item",
                notes: asNonEmptyString(params.notes),
                unitPrice: asNumber(params.unitPrice) ?? asNumber(params.price),
                sectionId: asNonEmptyString(params.sectionId) ?? undefined,
                assignedTo: asNonEmptyString(params.assignedTo),
              },
            });

            return {
              ok: Boolean(result?.success),
              itemId: typeof result?.itemId === "string" ? result.itemId : undefined,
              name,
              message:
                asNonEmptyString(result?.message) ?? `Created labor item: ${name}`,
            };
          }

          case "update_labor_item": {
            const itemId = asNonEmptyString(params.itemId);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for update_labor_item.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.editConfirmedLaborItem, {
              projectId,
              itemId,
              updates: {
                name: asNonEmptyString(params.name),
                notes: asNonEmptyString(params.notes),
                quantity: asNumber(params.quantity),
                unit: asNonEmptyString(params.unit),
                unitPrice: asNumber(params.unitPrice) ?? asNumber(params.price),
                sectionId: asNonEmptyString(params.sectionId) ?? undefined,
                assignedTo: asNonEmptyString(params.assignedTo),
              },
            });

            return {
              ok: Boolean(result?.success),
              itemId,
              message:
                asNonEmptyString(result?.message) ?? "Labor item updated successfully.",
            };
          }

          case "delete_labor_item": {
            const itemId = asNonEmptyString(params.itemId);
            if (!itemId) {
              return {
                ok: false,
                error: "Missing required `itemId` for delete_labor_item.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.deleteConfirmedLaborItem, {
              itemId,
              reason: asNonEmptyString(params.reason),
            });

            return {
              ok: Boolean(result?.success),
              itemId,
              message:
                asNonEmptyString(result?.message) ?? "Labor item deleted successfully.",
            };
          }

          case "create_labor_section": {
            const name = asNonEmptyString(params.name);
            if (!name) {
              return {
                ok: false,
                error: "Missing required `name` for create_labor_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.createConfirmedLaborSection, {
              projectId,
              sectionData: { name },
            });

            return {
              ok: Boolean(result?.success),
              sectionId: typeof result?.sectionId === "string" ? result.sectionId : undefined,
              message:
                asNonEmptyString(result?.message) ?? `Created labor section: ${name}`,
            };
          }

          case "update_labor_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for update_labor_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.editConfirmedLaborSection, {
              sectionId,
              updates: {
                name: asNonEmptyString(params.name),
              },
            });

            return {
              ok: Boolean(result?.success),
              sectionId,
              message:
                asNonEmptyString(result?.message) ??
                "Labor section updated successfully.",
            };
          }

          case "delete_labor_section": {
            const sectionId = asNonEmptyString(params.sectionId);
            if (!sectionId) {
              return {
                ok: false,
                error: "Missing required `sectionId` for delete_labor_section.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.deleteConfirmedLaborSection, {
              sectionId,
            });

            return {
              ok: Boolean(result?.success),
              sectionId,
              message:
                asNonEmptyString(result?.message) ??
                "Labor section deleted successfully.",
            };
          }

          case "create_survey": {
            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(params.name);
            if (!title) {
              return {
                ok: false,
                error: "Missing required `title` for create_survey.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.createConfirmedSurvey, {
              projectId,
              surveyData: {
                title,
                description: asNonEmptyString(params.description),
                isRequired: asBoolean(params.isRequired),
                allowMultipleResponses: asBoolean(params.allowMultipleResponses),
                startDate: asNonEmptyString(params.startDate),
                endDate: asNonEmptyString(params.endDate),
                questions: extractSurveyQuestions(params.questions),
              },
            });

            return {
              ok: Boolean(result?.success),
              surveyId: typeof result?.surveyId === "string" ? result.surveyId : undefined,
              title,
              message:
                asNonEmptyString(result?.message) ?? `Created survey: ${title}`,
            };
          }

          case "update_survey": {
            const surveyId = asNonEmptyString(params.surveyId);
            if (!surveyId) {
              return {
                ok: false,
                error: "Missing required `surveyId` for update_survey.",
              };
            }

            const result = await convex.action(apiAny.ai.confirmedActions.editConfirmedSurvey, {
              projectId,
              surveyId,
              updates: {
                title: asNonEmptyString(params.title),
                description: asNonEmptyString(params.description),
                isRequired: asBoolean(params.isRequired),
                allowMultipleResponses: asBoolean(params.allowMultipleResponses),
                startDate: asNonEmptyString(params.startDate),
                endDate: asNonEmptyString(params.endDate),
                questions: extractSurveyQuestions(params.questions),
              },
            });

            return {
              ok: Boolean(result?.success),
              surveyId,
              message:
                asNonEmptyString(result?.message) ?? "Survey updated successfully.",
            };
          }

          case "delete_survey": {
            const surveyId = asNonEmptyString(params.surveyId);
            if (!surveyId) {
              return {
                ok: false,
                error: "Missing required `surveyId` for delete_survey.",
              };
            }

            const existingSurvey = await convex.query(apiAny.surveys.getSurvey, { surveyId });
            const title =
              asNonEmptyString(params.title) ??
              asNonEmptyString(existingSurvey?.title) ??
              "Survey";

            const result = await convex.action(apiAny.ai.confirmedActions.deleteConfirmedSurvey, {
              surveyId,
              title,
              reason: asNonEmptyString(params.reason),
            });

            return {
              ok: Boolean(result?.success),
              surveyId,
              message:
                asNonEmptyString(result?.message) ?? `Deleted survey: ${title}`,
            };
          }

          case "generate_moodboard_image": {
            const prompt = asNonEmptyString(params.prompt);
            if (!prompt) {
              return {
                ok: false,
                error: "Missing required `prompt` for generate_moodboard_image.",
              };
            }

            const result = await convex.action(
              apiAny.ai.imageGen.generation.generateMoodboardImageForAssistant,
              {
                prompt,
                projectId,
                section: asNonEmptyString(params.section),
              },
            );

            return {
              ok: Boolean(result?.success),
              imageUrl: asNonEmptyString(result?.imageUrl),
              fileId: typeof result?.fileId === "string" ? result.fileId : undefined,
              fileName: asNonEmptyString(result?.fileName),
              sectionKey: asNonEmptyString(result?.sectionKey),
              sectionLabel: asNonEmptyString(result?.sectionLabel),
              markdown: asNonEmptyString(result?.markdown),
              message:
                asNonEmptyString(result?.message) ??
                "Moodboard image generated successfully.",
              error: asNonEmptyString(result?.error),
            };
          }

          case "search_items": {
            const query = asNonEmptyString(params.query)?.toLowerCase() ?? "";
            const scope = asNonEmptyString(params.scope) ?? "all";
            const limit = asNumber(params.limit) ?? 8;

            const [tasks, notes, shoppingItems, laborItems, surveys, contacts] = await Promise.all([
              scope === "all" || scope === "tasks"
                ? convex.query(apiAny.tasks.listProjectTasks, {
                    projectId,
                    filters: query ? { searchQuery: query } : undefined,
                  })
                : Promise.resolve([]),
              scope === "all" || scope === "notes"
                ? convex.query(apiAny.notes.getProjectNotes, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "shopping"
                ? convex.query(apiAny.shopping.getShoppingListItemsByProject, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "labor"
                ? convex.query(apiAny.labor.getLaborItemsByProject, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "survey" || scope === "surveys"
                ? convex.query(apiAny.surveys.getSurveysByProject, { projectId })
                : Promise.resolve([]),
              scope === "all" || scope === "contacts"
                ? convex.query(apiAny.contacts.getProjectContacts, { projectId })
                : Promise.resolve([]),
            ]);

            const includes = (value: string | undefined | null) =>
              !query || (value ?? "").toLowerCase().includes(query);

            const filteredTasks = (tasks as Array<Record<string, unknown>>)
              .map(summarizeTask)
              .filter(
                (task) =>
                  includes(task.title) ||
                  includes(task.description) ||
                  includes(task.assignedTo) ||
                  includes(task.priority) ||
                  includes(task.status),
              )
              .slice(0, limit);

            const filteredNotes = (notes as Array<Record<string, unknown>>)
              .map(summarizeNote)
              .filter((note) => includes(note.title) || includes(note.excerpt))
              .slice(0, limit);

            const filteredShopping = (shoppingItems as Array<Record<string, unknown>>)
              .map(summarizeShoppingItem)
              .filter(
                (item) =>
                  includes(item.name) ||
                  includes(item.notes) ||
                  includes(item.supplier) ||
                  includes(item.status),
              )
              .slice(0, limit);

            const filteredLabor = (laborItems as Array<Record<string, unknown>>)
              .map(summarizeLaborItem)
              .filter(
                (item) =>
                  includes(item.name) ||
                  includes(item.notes) ||
                  includes(item.assignedTo) ||
                  includes(item.unit),
              )
              .slice(0, limit);

            const filteredSurveys = (surveys as Array<Record<string, unknown>>)
              .map(summarizeSurvey)
              .filter(
                (survey) =>
                  includes(survey.title) ||
                  includes(survey.description) ||
                  includes(survey.status),
              )
              .slice(0, limit);

            const filteredContacts = (contacts as Array<Record<string, unknown>>)
              .map(summarizeContact)
              .filter(
                (contact) =>
                  includes(contact.name) ||
                  includes(contact.companyName) ||
                  includes(contact.email) ||
                  includes(contact.specialization),
              )
              .slice(0, limit);

            return {
              ok: true,
              query,
              scope,
              results: {
                tasks: filteredTasks,
                notes: filteredNotes,
                shopping: filteredShopping,
                labor: filteredLabor,
                surveys: filteredSurveys,
                contacts: filteredContacts,
              },
              counts: {
                tasks: filteredTasks.length,
                notes: filteredNotes.length,
                shopping: filteredShopping.length,
                labor: filteredLabor.length,
                surveys: filteredSurveys.length,
                contacts: filteredContacts.length,
              },
            };
          }

          case "load_full_project_context": {
            const [project, tasks, notes, shoppingItems, laborItems, surveys, contacts] =
              await Promise.all([
              convex.query(apiAny.projects.getProject, { projectId }),
              convex.query(apiAny.tasks.listProjectTasks, { projectId }),
              convex.query(apiAny.notes.getProjectNotes, { projectId }),
              convex.query(apiAny.shopping.getShoppingListItemsByProject, { projectId }),
              convex.query(apiAny.labor.getLaborItemsByProject, { projectId }),
              convex.query(apiAny.surveys.getSurveysByProject, { projectId }),
              convex.query(apiAny.contacts.getProjectContacts, { projectId }),
            ]);

            const taskSummaries = (tasks as Array<Record<string, unknown>>).map(summarizeTask);
            const noteSummaries = (notes as Array<Record<string, unknown>>).map(summarizeNote);
            const shoppingSummaries = (shoppingItems as Array<Record<string, unknown>>).map(
              summarizeShoppingItem,
            );
            const laborSummaries = (laborItems as Array<Record<string, unknown>>).map(
              summarizeLaborItem,
            );
            const surveySummaries = (surveys as Array<Record<string, unknown>>).map(
              summarizeSurvey,
            );
            const contactSummaries = (contacts as Array<Record<string, unknown>>).map(
              summarizeContact,
            );

            const openTasks = taskSummaries.filter((task) => task.status !== "done");

            return {
              ok: true,
              project: summarizeProject((project as Record<string, unknown> | null) ?? null),
              counts: {
                tasks: taskSummaries.length,
                openTasks: openTasks.length,
                notes: noteSummaries.length,
                shoppingItems: shoppingSummaries.length,
                laborItems: laborSummaries.length,
                surveys: surveySummaries.length,
                contacts: contactSummaries.length,
              },
              tasks: {
                open: openTasks.slice(0, 8),
                recent: taskSummaries.slice(0, 8),
              },
              notes: noteSummaries.slice(0, 6),
              shoppingItems: shoppingSummaries.slice(0, 6),
              laborItems: laborSummaries.slice(0, 6),
              surveys: surveySummaries.slice(0, 6),
              contacts: contactSummaries.slice(0, 6),
            };
          }

          default:
            return {
              ok: false,
              error: `Unsupported client tool: ${name}`,
            };
        }
      } catch (error) {
        const message = extractErrorMessage(error);
        console.error("[chatkit-client-tool] tool failed", {
          name,
          params,
          error,
        });

        return {
          ok: false,
          tool: name,
          error: message,
        };
      }
    },
    [convex, projectId, teamId, teamSlug],
  );
}
