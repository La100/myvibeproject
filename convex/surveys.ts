import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// ====== SURVEY MANAGEMENT ======

export const createSurvey = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.id("projects"),
    isRequired: v.boolean(),
    allowMultipleResponses: v.boolean(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    targetAudience: v.union(
      v.literal("all_customers"),
      v.literal("specific_customers"),
      v.literal("team_members")
    ),
    targetCustomerIds: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check permissions - only admin and members can create surveys
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to create surveys");
    }

    const surveyId = await ctx.db.insert("surveys", {
      title: args.title,
      description: args.description,
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: identity.subject,
      status: "draft",
      isRequired: args.isRequired,
      allowMultipleResponses: args.allowMultipleResponses,
      startDate: args.startDate,
      endDate: args.endDate,
      targetAudience: args.targetAudience,
      targetCustomerIds: args.targetCustomerIds,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      
      actionType: "survey.create",
      entityId: surveyId,
      entityType: "survey",
      details: { title: args.title },
    });

    return surveyId;
  },
});

export const getSurveysByProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }

    // Check user access to project
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember) {
      return [];
    }

    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    // For customers, only show surveys they're targeted for
    if (teamMember.role === "customer") {
      return surveys.filter(survey => {
        if (survey.targetAudience === "all_customers") return true;
        if (survey.targetAudience === "specific_customers") {
          return survey.targetCustomerIds?.includes(identity.subject);
        }
        return false;
      });
    }

    return surveys;
  },
});

export const getSurveysChangedAfter = internalQuery({
  args: { 
    projectId: v.id("projects"), 
    since: v.number() 
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveys")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.or(
        q.gt(q.field("_creationTime"), args.since),
        q.gt(q.field("updatedAt"), args.since)
      ))
      .collect();
  },
});

export const getSurvey = query({
  args: { surveyId: v.id("surveys") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      return null;
    }

    // Check user access
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember) {
      return null;
    }

    // For customers, check if they're targeted
    if (teamMember.role === "customer") {
      const isTargeted = survey.targetAudience === "all_customers" ||
        (survey.targetAudience === "specific_customers" && 
         survey.targetCustomerIds?.includes(identity.subject));
      
      if (!isTargeted) {
        return null;
      }
    }

    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .collect();

    questions.sort((a, b) => a.order - b.order);

    return {
      ...survey,
      questions,
    };
  },
});

export const updateSurvey = mutation({
  args: {
    surveyId: v.id("surveys"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    allowMultipleResponses: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    targetAudience: v.optional(v.union(
      v.literal("all_customers"),
      v.literal("specific_customers"),
      v.literal("team_members")
    )),
    targetCustomerIds: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to update survey");
    }

    const { surveyId, ...updates } = args;
    await ctx.db.patch(surveyId, { ...updates, updatedAt: Date.now() });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      
      actionType: "survey.update",
      entityId: args.surveyId,
      entityType: "survey",
      details: { title: survey.title },
    });

    return args.surveyId;
  },
});

export const deleteSurvey = mutation({
  args: { surveyId: v.id("surveys") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check permissions - only admin can delete
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can delete surveys");
    }

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      
      actionType: "survey.delete",
      entityId: args.surveyId,
      entityType: "survey",
      details: { title: survey.title },
    });

    // Delete all related data
    const questions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .collect();

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .collect();

    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .collect();

    await Promise.all(answers.map(answer => ctx.db.delete(answer._id)));
    await Promise.all(responses.map(response => ctx.db.delete(response._id)));
    await Promise.all(questions.map(question => ctx.db.delete(question._id)));
    await ctx.db.delete(args.surveyId);

    return { success: true };
  },
});

// ====== SURVEY QUESTIONS ======

export const addQuestion = mutation({
  args: {
    surveyId: v.id("surveys"),
    questionText: v.string(),
    questionType: v.union(
      v.literal("text_short"),
      v.literal("text_long"),
      v.literal("multiple_choice"),
      v.literal("single_choice"),
      v.literal("rating"),
      v.literal("yes_no"),
      v.literal("number"),
      v.literal("file")
    ),
    isRequired: v.boolean(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to add questions");
    }

    // Get next order number
    const existingQuestions = await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .collect();

    const maxOrder = existingQuestions.reduce((max, q) => Math.max(max, q.order), 0);

    const questionId = await ctx.db.insert("surveyQuestions", {
      surveyId: args.surveyId,
      questionText: args.questionText,
      questionType: args.questionType,
      isRequired: args.isRequired,
      order: maxOrder + 1,
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      
      actionType: "survey.question.create",
      entityId: questionId,
      entityType: "survey_question",
      details: { surveyTitle: survey.title, questionText: args.questionText },
    });

    return questionId;
  },
});

export const updateQuestion = mutation({
  args: {
    questionId: v.id("surveyQuestions"),
    questionText: v.optional(v.string()),
    questionType: v.optional(v.union(
      v.literal("text_short"),
      v.literal("text_long"),
      v.literal("multiple_choice"),
      v.literal("single_choice"),
      v.literal("rating"),
      v.literal("yes_no"),
      v.literal("number"),
      v.literal("file")
    )),
    isRequired: v.optional(v.boolean()),
    options: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const survey = await ctx.db.get(question.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to update question");
    }

    const { questionId, ...updates } = args;
    await ctx.db.patch(questionId, updates);

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      
      actionType: "survey.question.update",
      entityId: args.questionId,
      entityType: "survey_question",
      details: { surveyTitle: survey.title, questionText: question.questionText },
    });

    return args.questionId;
  },
});

export const deleteQuestion = mutation({
  args: { questionId: v.id("surveyQuestions") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const survey = await ctx.db.get(question.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to delete question");
    }

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: survey.teamId,
      projectId: survey.projectId,
      
      actionType: "survey.question.delete",
      entityId: args.questionId,
      entityType: "survey_question",
      details: { surveyTitle: survey.title, questionText: question.questionText },
    });

    // Delete related answers first
    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_question", q => q.eq("questionId", args.questionId))
      .collect();

    await Promise.all(answers.map(answer => ctx.db.delete(answer._id)));
    await ctx.db.delete(args.questionId);

    return { success: true };
  },
});

// ====== SURVEY RESPONSES ======

export const startSurveyResponse = mutation({
  args: { surveyId: v.id("surveys") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }

    // Check if user can respond
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember) {
      throw new Error("No access to this survey");
    }


    // Check if already responded and multiple responses not allowed
    if (!survey.allowMultipleResponses) {
      const existingResponse = await ctx.db
        .query("surveyResponses")
        .withIndex("by_survey_and_respondent", q => 
          q.eq("surveyId", args.surveyId).eq("respondentId", identity.subject)
        )
        .filter(q => q.eq(q.field("isComplete"), true))
        .first();

      if (existingResponse) {
        throw new Error("You have already responded to this survey");
      }
    }

    // Create or get existing incomplete response
    let response = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey_and_respondent", q => 
        q.eq("surveyId", args.surveyId).eq("respondentId", identity.subject)
      )
      .filter(q => q.eq(q.field("isComplete"), false))
      .first();

    if (!response) {
      const responseId = await ctx.db.insert("surveyResponses", {
        surveyId: args.surveyId,
        respondentId: identity.subject,
        teamId: survey.teamId,
        projectId: survey.projectId,
        isComplete: false,
      });
      response = await ctx.db.get(responseId);
    }

    return response;
  },
});

export const saveAnswer = mutation({
  args: {
    responseId: v.id("surveyResponses"),
    questionId: v.id("surveyQuestions"),
    answerType: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rating"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("file")
    ),
    textAnswer: v.optional(v.string()),
    choiceAnswers: v.optional(v.array(v.string())),
    ratingAnswer: v.optional(v.number()),
    numberAnswer: v.optional(v.number()),
    booleanAnswer: v.optional(v.boolean()),
    fileAnswer: v.optional(v.object({
      fileId: v.id("files"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string()
    })),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const response = await ctx.db.get(args.responseId);
    if (!response) {
      throw new Error("Response not found");
    }

    if (response.respondentId !== identity.subject) {
      throw new Error("Not authorized to save this answer");
    }

    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    // Check if answer already exists
    const existingAnswer = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_response", q => q.eq("responseId", args.responseId))
      .filter(q => q.eq(q.field("questionId"), args.questionId))
      .first();

    const answerData = {
      responseId: args.responseId,
      questionId: args.questionId,
      surveyId: question.surveyId,
      answerType: args.answerType,
      textAnswer: args.textAnswer,
      choiceAnswers: args.choiceAnswers,
      ratingAnswer: args.ratingAnswer,
      numberAnswer: args.numberAnswer,
      booleanAnswer: args.booleanAnswer,
    };

    if (existingAnswer) {
      await ctx.db.patch(existingAnswer._id, answerData);
    } else {
      await ctx.db.insert("surveyAnswers", answerData);
    }

    return { success: true };
  },
});

export const submitSurveyResponse = mutation({
  args: { responseId: v.id("surveyResponses") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const response = await ctx.db.get(args.responseId);
    if (!response) {
      throw new Error("Response not found");
    }

    if (response.respondentId !== identity.subject) {
      throw new Error("Not authorized to submit this response");
    }

    await ctx.db.patch(args.responseId, {
      isComplete: true,
      submittedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getSurveyResponses = query({
  args: { surveyId: v.id("surveys") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      return [];
    }

    // Check permissions
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", survey.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember) {
      return [];
    }

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .filter(q => q.eq(q.field("isComplete"), true))
      .collect();

    // If user is customer, only show their own responses
    const filteredResponses = (teamMember.role === "admin" || teamMember.role === "member") 
      ? responses 
      : responses.filter(r => r.respondentId === identity.subject);

    const responsesWithAnswers = await Promise.all(
      filteredResponses.map(async (response) => {
        const answers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_response", q => q.eq("responseId", response._id))
          .collect();

        return {
          ...response,
          answers,
        };
      })
    );

    return responsesWithAnswers;
  },
});

export const getUserSurveyResponses = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const responses = await ctx.db
      .query("surveyResponses")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("respondentId"), identity.subject))
      .collect();

    return responses;
  },
});

export const getUserSurveyResponse = query({
  args: { surveyId: v.id("surveys") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const response = await ctx.db
      .query("surveyResponses")
      .withIndex("by_survey_and_respondent", q => 
        q.eq("surveyId", args.surveyId).eq("respondentId", identity.subject)
      )
      .order("desc")
      .first();

    if (!response) {
      return null;
    }

    const answers = await ctx.db
      .query("surveyAnswers")
      .withIndex("by_response", q => q.eq("responseId", response._id))
      .collect();

    return {
      ...response,
      answers,
    };
  },
});

// ====== INTERNAL FUNCTIONS FOR AI INDEXING ======

export const getSurveysForIndexing = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    _id: v.id("surveys"),
    _creationTime: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed")
    ),
    targetAudience: v.union(
      v.literal("all_customers"),
      v.literal("specific_customers"),
      v.literal("team_members")
    ),
    isRequired: v.boolean(),
    allowMultipleResponses: v.boolean(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    return surveys.map(survey => ({
      _id: survey._id,
      _creationTime: survey._creationTime,
      title: survey.title,
      description: survey.description,
      status: survey.status,
      targetAudience: survey.targetAudience,
      isRequired: survey.isRequired,
      allowMultipleResponses: survey.allowMultipleResponses,
      startDate: survey.startDate,
      endDate: survey.endDate,
    }));
  },
});

// ====== ADDITIONAL FUNCTIONS FOR SEEDING ======

export const createSurveyQuestion = mutation({
  args: {
    surveyId: v.id("surveys"),
    questionText: v.string(),
    questionType: v.union(
      v.literal("text_short"),
      v.literal("text_long"),
      v.literal("multiple_choice"),
      v.literal("single_choice"),
      v.literal("rating"),
      v.literal("yes_no"),
      v.literal("number"),
      v.literal("file")
    ),
    isRequired: v.boolean(),
    order: v.number(),
    options: v.optional(v.array(v.string())),
    ratingScale: v.optional(v.object({
      min: v.number(),
      max: v.number(),
      minLabel: v.optional(v.string()),
      maxLabel: v.optional(v.string())
    })),
  },
  async handler(ctx, args) {
    const questionId = await ctx.db.insert("surveyQuestions", {
      surveyId: args.surveyId,
      questionText: args.questionText,
      questionType: args.questionType,
      isRequired: args.isRequired,
      order: args.order,
      options: args.options,
      ratingScale: args.ratingScale,
    });

    return questionId;
  },
});

export const createSurveyResponse = mutation({
  args: {
    surveyId: v.id("surveys"),
    projectId: v.id("projects"),
    isComplete: v.boolean(),
    submittedAt: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const responseId = await ctx.db.insert("surveyResponses", {
      surveyId: args.surveyId,
      respondentId: identity.subject,
      teamId: project.teamId,
      projectId: args.projectId,
      isComplete: args.isComplete,
      submittedAt: args.submittedAt,
    });

    return responseId;
  },
});

export const createSurveyAnswer = mutation({
  args: {
    responseId: v.id("surveyResponses"),
    questionId: v.id("surveyQuestions"),
    surveyId: v.id("surveys"),
    answerType: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rating"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("file")
    ),
    textAnswer: v.optional(v.string()),
    choiceAnswers: v.optional(v.array(v.string())),
    ratingAnswer: v.optional(v.number()),
    numberAnswer: v.optional(v.number()),
    booleanAnswer: v.optional(v.boolean()),
    fileAnswer: v.optional(v.object({
      fileId: v.id("files"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string()
    })),
  },
  async handler(ctx, args) {
    const answerId = await ctx.db.insert("surveyAnswers", {
      responseId: args.responseId,
      questionId: args.questionId,
      surveyId: args.surveyId,
      answerType: args.answerType,
      textAnswer: args.textAnswer,
      choiceAnswers: args.choiceAnswers,
      ratingAnswer: args.ratingAnswer,
      numberAnswer: args.numberAnswer,
      booleanAnswer: args.booleanAnswer,
      fileAnswer: args.fileAnswer,
    });

    return answerId;
  },
});

export const getSurveyResponsesForIndexing = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const responses: Array<Doc<"surveyResponses"> & {
      surveyTitle: string;
      answers: Array<Doc<"surveyAnswers"> & { questionText: string }>;
    }> = [];
    
    for (const survey of surveys) {
      const surveyResponses = await ctx.db
        .query("surveyResponses")
        .withIndex("by_survey", q => q.eq("surveyId", survey._id))
        .filter(q => q.eq(q.field("isComplete"), true))
        .collect();

      for (const response of surveyResponses) {
        const answers = await ctx.db
          .query("surveyAnswers")
          .withIndex("by_response", q => q.eq("responseId", response._id))
          .collect();

        const answersWithQuestions: Array<Doc<"surveyAnswers"> & { questionText: string }> = [];
        for (const answer of answers) {
          const question = await ctx.db.get(answer.questionId);
          if (question) {
            answersWithQuestions.push({
              ...answer,
              questionText: question.questionText,
            });
          }
        }

        responses.push({
          ...response,
          surveyTitle: survey.title,
          answers: answersWithQuestions,
        });
      }
    }

    return responses;
  },
});

// ====== HELPER FUNCTIONS FOR INCREMENTAL INDEXING ======

export const getSurveyById = internalQuery({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.surveyId);
  },
});

// Get survey questions for editing
export const getSurveyQuestions = query({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", q => q.eq("surveyId", args.surveyId))
      .order("asc")
      .collect();
  },
});

// Delete survey question
export const deleteSurveyQuestion = mutation({
  args: { questionId: v.id("surveyQuestions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.questionId);
  },
});
