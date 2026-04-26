import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { ensureProjectAccess, ensureTeamAccess } from "./authz";

const logActivityMutation = makeFunctionReference<"mutation">(
  "activityLog:logActivity",
);

const questionTypeValidator = v.union(
  v.literal("text_short"),
  v.literal("text_long"),
  v.literal("multiple_choice"),
  v.literal("single_choice"),
  v.literal("rating"),
  v.literal("yes_no"),
  v.literal("number"),
  v.literal("file"),
);

const ratingScaleValidator = v.object({
  min: v.number(),
  max: v.number(),
  minLabel: v.optional(v.string()),
  maxLabel: v.optional(v.string()),
});

const templateQuestionInputValidator = v.object({
  questionText: v.string(),
  questionType: questionTypeValidator,
  options: v.optional(v.array(v.string())),
  isRequired: v.optional(v.boolean()),
  order: v.optional(v.number()),
  ratingScale: v.optional(ratingScaleValidator),
});

const getTemplateWithAccess = async (
  ctx: QueryCtx | MutationCtx,
  templateId: Id<"surveyTemplates">,
) => {
  const template = await ctx.db.get(templateId);
  if (!template || !template.isActive) {
    throw new Error("Survey template not found");
  }

  const access = await ensureTeamAccess(ctx, template.teamId);
  return { template, ...access };
};

const getTemplateQuestionWithAccess = async (
  ctx: QueryCtx | MutationCtx,
  questionId: Id<"surveyTemplateQuestions">,
) => {
  const question = await ctx.db.get(questionId);
  if (!question) {
    throw new Error("Template question not found");
  }

  const access = await getTemplateWithAccess(ctx, question.templateId);
  return { question, ...access };
};

const getTemplateQuestions = async (
  ctx: QueryCtx | MutationCtx,
  templateId: Id<"surveyTemplates">,
) => {
  const questions = await ctx.db
    .query("surveyTemplateQuestions")
    .withIndex("by_template", (q) => q.eq("templateId", templateId))
    .collect();

  questions.sort((a, b) => a.order - b.order);
  return questions;
};

const insertTemplateQuestions = async (
  ctx: MutationCtx,
  templateId: Id<"surveyTemplates">,
  questions: Array<{
    questionText: string;
    questionType: Doc<"surveyTemplateQuestions">["questionType"];
    options?: string[];
    isRequired?: boolean;
    order?: number;
    ratingScale?: Doc<"surveyTemplateQuestions">["ratingScale"];
  }>,
) => {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    await ctx.db.insert("surveyTemplateQuestions", {
      templateId,
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options,
      isRequired: question.isRequired ?? true,
      order: question.order ?? index + 1,
      ratingScale: question.ratingScale,
    });
  }
};

export const listTemplates = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await ensureTeamAccess(ctx, args.teamId);

    const templates = await ctx.db
      .query("surveyTemplates")
      .withIndex("by_team_and_active", (q) =>
        q.eq("teamId", args.teamId).eq("isActive", true),
      )
      .order("desc")
      .collect();

    const templatesWithCounts = await Promise.all(
      templates.map(async (template) => {
        const questions = await getTemplateQuestions(ctx, template._id);
        return {
          ...template,
          questionCount: questions.length,
        };
      }),
    );

    return templatesWithCounts;
  },
});

export const getTemplate = query({
  args: { templateId: v.id("surveyTemplates") },
  handler: async (ctx, args) => {
    let template: Doc<"surveyTemplates">;
    try {
      ({ template } = await getTemplateWithAccess(ctx, args.templateId));
    } catch {
      return null;
    }

    const questions = await getTemplateQuestions(ctx, args.templateId);
    return {
      ...template,
      questions,
    };
  },
});

export const createTemplate = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    isRequired: v.optional(v.boolean()),
    allowMultipleResponses: v.optional(v.boolean()),
    questions: v.optional(v.array(templateQuestionInputValidator)),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await ensureTeamAccess(ctx, args.teamId);
    const now = Date.now();

    const templateId = await ctx.db.insert("surveyTemplates", {
      title: args.title,
      description: args.description === null ? undefined : args.description,
      teamId: args.teamId,
      createdBy: clerkUserId,
      isRequired: args.isRequired ?? false,
      allowMultipleResponses: args.allowMultipleResponses ?? false,
      isActive: true,
      updatedAt: now,
    });

    await insertTemplateQuestions(ctx, templateId, args.questions ?? []);

    await ctx.runMutation(logActivityMutation, {
      teamId: args.teamId,
      projectId: undefined,
      actionType: "survey_template.create",
      entityId: templateId,
      entityType: "survey_template",
      details: {
        title: args.title,
        questionCount: args.questions?.length ?? 0,
      },
    });

    return templateId;
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("surveyTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isRequired: v.optional(v.boolean()),
    allowMultipleResponses: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { template } = await getTemplateWithAccess(ctx, args.templateId);
    const patch: Partial<Doc<"surveyTemplates">> = { updatedAt: Date.now() };

    if (Object.prototype.hasOwnProperty.call(args, "title")) {
      patch.title = args.title;
    }
    if (Object.prototype.hasOwnProperty.call(args, "description")) {
      patch.description =
        args.description === null ? undefined : args.description;
    }
    if (Object.prototype.hasOwnProperty.call(args, "isRequired")) {
      patch.isRequired = args.isRequired;
    }
    if (Object.prototype.hasOwnProperty.call(args, "allowMultipleResponses")) {
      patch.allowMultipleResponses = args.allowMultipleResponses;
    }

    await ctx.db.patch(args.templateId, patch);

    await ctx.runMutation(logActivityMutation, {
      teamId: template.teamId,
      projectId: undefined,
      actionType: "survey_template.update",
      entityId: args.templateId,
      entityType: "survey_template",
      details: { title: template.title },
    });

    return args.templateId;
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("surveyTemplates") },
  handler: async (ctx, args) => {
    const { template, membership } = await getTemplateWithAccess(
      ctx,
      args.templateId,
    );

    if (membership.role !== "admin") {
      throw new Error("Only admins can delete survey templates");
    }

    await ctx.db.patch(args.templateId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(logActivityMutation, {
      teamId: template.teamId,
      projectId: undefined,
      actionType: "survey_template.delete",
      entityId: args.templateId,
      entityType: "survey_template",
      details: { title: template.title },
    });

    return { success: true };
  },
});

export const addQuestion = mutation({
  args: {
    templateId: v.id("surveyTemplates"),
    questionText: v.string(),
    questionType: questionTypeValidator,
    options: v.optional(v.array(v.string())),
    isRequired: v.optional(v.boolean()),
    order: v.optional(v.number()),
    ratingScale: v.optional(ratingScaleValidator),
  },
  handler: async (ctx, args) => {
    const { template } = await getTemplateWithAccess(ctx, args.templateId);

    const existingQuestions = await getTemplateQuestions(ctx, args.templateId);
    const maxOrder = existingQuestions.reduce(
      (max, question) => Math.max(max, question.order),
      0,
    );

    const questionId = await ctx.db.insert("surveyTemplateQuestions", {
      templateId: args.templateId,
      questionText: args.questionText,
      questionType: args.questionType,
      options: args.options,
      isRequired: args.isRequired ?? true,
      order: args.order ?? maxOrder + 1,
      ratingScale: args.ratingScale,
    });

    await ctx.db.patch(args.templateId, { updatedAt: Date.now() });

    await ctx.runMutation(logActivityMutation, {
      teamId: template.teamId,
      projectId: undefined,
      actionType: "survey_template.question.create",
      entityId: questionId,
      entityType: "survey_template_question",
      details: {
        templateTitle: template.title,
        questionText: args.questionText,
      },
    });

    return questionId;
  },
});

export const updateQuestion = mutation({
  args: {
    questionId: v.id("surveyTemplateQuestions"),
    questionText: v.optional(v.string()),
    questionType: v.optional(questionTypeValidator),
    options: v.optional(v.array(v.string())),
    isRequired: v.optional(v.boolean()),
    order: v.optional(v.number()),
    ratingScale: v.optional(ratingScaleValidator),
  },
  handler: async (ctx, args) => {
    const { question, template } = await getTemplateQuestionWithAccess(
      ctx,
      args.questionId,
    );
    const { questionId, ...updates } = args;

    await ctx.db.patch(questionId, updates);
    await ctx.db.patch(template._id, { updatedAt: Date.now() });

    await ctx.runMutation(logActivityMutation, {
      teamId: template.teamId,
      projectId: undefined,
      actionType: "survey_template.question.update",
      entityId: args.questionId,
      entityType: "survey_template_question",
      details: {
        templateTitle: template.title,
        questionText: question.questionText,
      },
    });

    return args.questionId;
  },
});

export const deleteQuestion = mutation({
  args: { questionId: v.id("surveyTemplateQuestions") },
  handler: async (ctx, args) => {
    const { question, template } = await getTemplateQuestionWithAccess(
      ctx,
      args.questionId,
    );

    await ctx.db.delete(args.questionId);
    await ctx.db.patch(template._id, { updatedAt: Date.now() });

    await ctx.runMutation(logActivityMutation, {
      teamId: template.teamId,
      projectId: undefined,
      actionType: "survey_template.question.delete",
      entityId: args.questionId,
      entityType: "survey_template_question",
      details: {
        templateTitle: template.title,
        questionText: question.questionText,
      },
    });

    return { success: true };
  },
});

export const createSurveyFromTemplate = mutation({
  args: {
    projectId: v.id("projects"),
    templateId: v.id("surveyTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isRequired: v.optional(v.boolean()),
    allowMultipleResponses: v.optional(v.boolean()),
    startDate: v.optional(v.union(v.number(), v.null())),
    endDate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const [{ project, clerkUserId }, { template }] = await Promise.all([
      ensureProjectAccess(ctx, args.projectId),
      getTemplateWithAccess(ctx, args.templateId),
    ]);

    if (template.teamId !== project.teamId) {
      throw new Error("Survey template does not belong to this project team");
    }

    const templateQuestions = await getTemplateQuestions(ctx, args.templateId);
    const surveyId = await ctx.db.insert("surveys", {
      title: args.title ?? template.title,
      description:
        args.description === null
          ? undefined
          : args.description === undefined
            ? template.description
            : args.description,
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: clerkUserId,
      status: "draft",
      isRequired: args.isRequired ?? template.isRequired,
      allowMultipleResponses:
        args.allowMultipleResponses ?? template.allowMultipleResponses,
      startDate: args.startDate === null ? undefined : args.startDate,
      endDate: args.endDate === null ? undefined : args.endDate,
      updatedAt: Date.now(),
    });

    for (const question of templateQuestions) {
      await ctx.db.insert("surveyQuestions", {
        surveyId,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        isRequired: question.isRequired,
        order: question.order,
        ratingScale: question.ratingScale,
      });
    }

    await ctx.runMutation(logActivityMutation, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "survey.create_from_template",
      entityId: surveyId,
      entityType: "survey",
      details: {
        title: args.title ?? template.title,
        templateId: String(args.templateId),
        templateTitle: template.title,
        questionCount: templateQuestions.length,
      },
    });

    return surveyId;
  },
});

export const saveSurveyAsTemplate = mutation({
  args: {
    surveyId: v.id("surveys"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isRequired: v.optional(v.boolean()),
    allowMultipleResponses: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    const { project, clerkUserId } = await ensureProjectAccess(
      ctx,
      survey.projectId,
    );
    if (project.teamId !== survey.teamId) {
      throw new Error("Survey does not belong to the project");
    }

    const surveyQuestions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();
    surveyQuestions.sort((a, b) => a.order - b.order);

    const templateId = await ctx.db.insert("surveyTemplates", {
      title: args.title ?? survey.title,
      description:
        args.description === null
          ? undefined
          : args.description === undefined
            ? survey.description
            : args.description,
      teamId: survey.teamId,
      createdBy: clerkUserId,
      isRequired: args.isRequired ?? survey.isRequired,
      allowMultipleResponses:
        args.allowMultipleResponses ?? survey.allowMultipleResponses,
      isActive: true,
      updatedAt: Date.now(),
    });

    for (const question of surveyQuestions) {
      await ctx.db.insert("surveyTemplateQuestions", {
        templateId,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        isRequired: question.isRequired,
        order: question.order,
        ratingScale: question.ratingScale,
      });
    }

    await ctx.runMutation(logActivityMutation, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      actionType: "survey.save_as_template",
      entityId: templateId,
      entityType: "survey_template",
      details: {
        title: args.title ?? survey.title,
        surveyId: String(args.surveyId),
        surveyTitle: survey.title,
        questionCount: surveyQuestions.length,
      },
    });

    return templateId;
  },
});
