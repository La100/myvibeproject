import { internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";

type SurveyQuestionSnapshot = {
  _id: Id<"surveyQuestions">;
  questionText: string;
  questionType:
    | "text_short"
    | "text_long"
    | "multiple_choice"
    | "single_choice"
    | "rating"
    | "yes_no"
    | "number"
    | "file";
  options?: string[];
  isRequired: boolean;
  order: number;
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
};

type SurveySnapshot = {
  _id: Id<"surveys">;
  title: string;
  description?: string;
  status: "draft" | "active" | "closed";
  isRequired: boolean;
  allowMultipleResponses: boolean;
  questions: SurveyQuestionSnapshot[];
};

export const getProjectContextSnapshot = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    project: v.union(v.null(), v.object({
      _id: v.id("projects"),
      name: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("planning"),
        v.literal("active"),
        v.literal("on_hold"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      budget: v.optional(v.number()),
      customer: v.optional(v.string()),
      location: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
      currency: v.optional(v.union(
        v.literal("USD"), v.literal("EUR"), v.literal("PLN"), v.literal("GBP"),
        v.literal("CAD"), v.literal("AUD"), v.literal("JPY"), v.literal("CHF"),
        v.literal("SEK"), v.literal("NOK"), v.literal("DKK"), v.literal("CZK"),
        v.literal("HUF"), v.literal("CNY"), v.literal("INR"), v.literal("BRL"),
        v.literal("MXN"), v.literal("KRW"), v.literal("SGD"), v.literal("HKD"),
      )),
      teamId: v.id("teams"),
    })),
    tasks: v.array(v.object({
      _id: v.id("tasks"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done"),
      ),
      priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      )),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      assignedToName: v.optional(v.string()),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      tags: v.array(v.string()),
    })),
    notes: v.array(v.object({
      _id: v.id("notes"),
      title: v.string(),
      content: v.string(),
      updatedAt: v.number(),
    })),
    shoppingItems: v.array(v.object({
      _id: v.id("shoppingListItems"),
      name: v.string(),
      notes: v.optional(v.string()),
      category: v.optional(v.string()),
      supplier: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      productLink: v.optional(v.string()),
      quantity: v.number(),
      unit: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      realizationStatus: v.union(
        v.literal("PLANNED"),
        v.literal("ORDERED"),
        v.literal("IN_TRANSIT"),
        v.literal("DELIVERED"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED"),
      ),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
      sectionName: v.optional(v.string()),
      setId: v.optional(v.union(v.id("shoppingSets"), v.null())),
      setTitle: v.optional(v.string()),
      setType: v.optional(v.union(
        v.literal("variant"),
        v.literal("bundle"),
        v.literal("reference"),
      )),
      isPreferredInSet: v.optional(v.boolean()),
      isResolvedInSet: v.optional(v.boolean()),
    })),
    shoppingSections: v.array(v.object({
      _id: v.id("shoppingListSections"),
      name: v.string(),
      order: v.optional(v.number()),
    })),
    contacts: v.array(v.object({
      _id: v.id("contacts"),
      name: v.string(),
      companyName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      country: v.optional(v.string()),
      notes: v.optional(v.string()),
      type: v.union(
        v.literal("contractor"),
        v.literal("supplier"),
        v.literal("subcontractor"),
        v.literal("other"),
      ),
    })),
    surveys: v.array(v.object({
      _id: v.id("surveys"),
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("closed"),
      ),
      isRequired: v.boolean(),
      allowMultipleResponses: v.boolean(),
      questions: v.array(v.object({
        _id: v.id("surveyQuestions"),
        questionText: v.string(),
        questionType: v.union(
          v.literal("text_short"),
          v.literal("text_long"),
          v.literal("multiple_choice"),
          v.literal("single_choice"),
          v.literal("rating"),
          v.literal("yes_no"),
          v.literal("number"),
          v.literal("file"),
        ),
        options: v.optional(v.array(v.string())),
        isRequired: v.boolean(),
        order: v.number(),
        ratingScale: v.optional(v.object({
          min: v.number(),
          max: v.number(),
          minLabel: v.optional(v.string()),
          maxLabel: v.optional(v.string()),
        })),
      })),
    })),
    files: v.array(v.any()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const [shopping, sections, sets] = await Promise.all([
      ctx.db
        .query("shoppingListItems")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("shoppingListSections")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("asc")
        .collect(),
      ctx.db
        .query("shoppingSets")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const sectionNameById = new Map(
      sections.map((section) => [String(section._id), section.name]),
    );
    const setById = new Map(sets.map((set) => [String(set._id), set]));

    const projectContacts = await ctx.db
      .query("projectContacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const contactDocs: Doc<"contacts">[] = [];
    for (const pc of projectContacts) {
      const contact = await ctx.db.get(pc.contactId);
      if (contact) {
        contactDocs.push(contact);
      }
    }

    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const aiKnowledgeFiles = (await ctx.db
      .query("files")
      .withIndex("by_project_and_ai_knowledge", (q) =>
        q.eq("projectId", args.projectId).eq("aiKnowledgeEnabled", true)
      )
      .collect()).filter(
        (file) => file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      );

    const surveyDetails: SurveySnapshot[] = [];
    for (const survey of surveys) {
      const questions = await ctx.db
        .query("surveyQuestions")
        .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
        .collect();

      surveyDetails.push({
        _id: survey._id,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        isRequired: survey.isRequired,
        allowMultipleResponses: survey.allowMultipleResponses,
        questions: questions.map((question) => ({
          _id: question._id,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.options ?? undefined,
          isRequired: question.isRequired,
          order: question.order,
          ratingScale: question.ratingScale
            ? {
                min: question.ratingScale.min,
                max: question.ratingScale.max,
                minLabel: question.ratingScale.minLabel ?? undefined,
                maxLabel: question.ratingScale.maxLabel ?? undefined,
              }
            : undefined,
        })),
      });
    }

    const summaryLines: Array<string> = [];
    summaryLines.push(`Tasks: ${tasks.length}`);
    summaryLines.push(`Notes: ${notes.length}`);
    summaryLines.push(`Shopping items: ${shopping.length}`);
    summaryLines.push(`Contacts: ${contactDocs.length}`);
    summaryLines.push(`Surveys: ${surveyDetails.length}`);
    summaryLines.push(`AI knowledge files: ${aiKnowledgeFiles.length}`);
    if (project) {
      summaryLines.push(`Project budget: ${project.budget ?? "not set"}`);
      summaryLines.push(`Project currency: ${project.currency ?? "not set"}`);
      summaryLines.push(`Project customer: ${project.customer ?? "not set"}`);
      summaryLines.push(`Project location: ${project.location ?? "not set"}`);
      summaryLines.push(
        `Project timeline: ${typeof project.startDate === "number" ? new Date(project.startDate).toISOString().slice(0, 10) : "-"} -> ${typeof project.endDate === "number" ? new Date(project.endDate).toISOString().slice(0, 10) : "-"}`,
      );
    }

    return {
      project: project ? {
        _id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        customer: project.customer,
        location: project.location,
        coverImageUrl: project.coverImageUrl,
        currency: project.currency,
        teamId: project.teamId,
      } : null,
      tasks: tasks.map(t => ({
        _id: t._id,
        title: t.title,
        description: t.description,
        content: t.content,
        status: t.status,
        priority: t.priority ?? undefined,
        assignedTo: t.assignedTo,
        assignedToName: undefined,
        startDate: t.startDate,
        endDate: t.endDate,
        tags: t.tags,
      })),
      notes: notes.map(n => ({
        _id: n._id,
        title: n.title,
        content: n.content,
        updatedAt: n.updatedAt,
      })),
      shoppingItems: shopping.map((s) => {
        const set = s.setId ? setById.get(String(s.setId)) : null;
        return {
          _id: s._id,
          name: s.name,
          notes: s.notes,
          category: s.category,
          supplier: s.supplier,
          dimensions: s.dimensions,
          imageUrl: s.imageUrl,
          productLink: s.productLink,
          quantity: s.quantity,
          unit: s.unit,
          unitPrice: s.unitPrice,
          totalPrice: s.totalPrice,
          realizationStatus: s.realizationStatus,
          assignedTo: s.assignedTo,
          sectionId: s.sectionId ?? null,
          sectionName: s.sectionId ? sectionNameById.get(String(s.sectionId)) : undefined,
          setId: s.setId ?? null,
          setTitle: set?.title,
          setType: set?.setType,
          isPreferredInSet: !!set?.preferredItemIds?.some(
            (itemId) => String(itemId) === String(s._id),
          ),
          isResolvedInSet: !!set?.resolvedItemIds?.some(
            (itemId) => String(itemId) === String(s._id),
          ),
        };
      }),
      shoppingSections: sections.map((section) => ({
        _id: section._id,
        name: section.name,
        order: section.order,
      })),
      contacts: contactDocs,
      surveys: surveyDetails,
      files: aiKnowledgeFiles
        .filter((file) => file.origin !== "ai")
        .slice(0, 12)
        .map((file) => ({
          _id: file._id,
          name: file.name,
          description: file.description,
          fileType: file.fileType,
          size: file.size,
          mimeType: file.mimeType,
          moodboardSection: file.moodboardSection,
          extractedText:
            typeof file.extractedText === "string"
              ? file.extractedText.slice(0, 2000)
              : undefined,
          pdfAnalysis:
            typeof file.pdfAnalysis === "string"
              ? file.pdfAnalysis.slice(0, 2000)
              : undefined,
          aiKnowledgeEnabled: file.aiKnowledgeEnabled,
          aiKnowledgeStatus: file.aiKnowledgeStatus,
          aiKnowledgeEntryId: file.aiKnowledgeEntryId,
          aiKnowledgeIndexedAt: file.aiKnowledgeIndexedAt,
        })),
      summary: summaryLines.join(" | "),
    };
  },
});
