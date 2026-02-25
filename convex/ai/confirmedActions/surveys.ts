/**
 * Confirmed Actions - Surveys
 * 
 * Survey CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ensureProjectAccess } from "./helpers";

export const createConfirmedSurvey = action({
  args: {
    projectId: v.id("projects"),
    surveyData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      questions: v.optional(v.array(v.object({
        questionText: v.string(),
        questionType: v.union(v.literal("text_short"), v.literal("text_long"), v.literal("multiple_choice"), v.literal("single_choice"), v.literal("rating"), v.literal("yes_no"), v.literal("number"), v.literal("file")),
        options: v.optional(v.array(v.string())),
        isRequired: v.optional(v.boolean()),
      }))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    surveyId: v.optional(v.id("surveys")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true);

      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.surveyData.startDate) {
        startDateNumber = new Date(args.surveyData.startDate).getTime();
      }
      if (args.surveyData.endDate) {
        endDateNumber = new Date(args.surveyData.endDate).getTime();
      }

      const surveyId: any = await ctx.runMutation(api.surveys.createSurvey, {
        projectId: args.projectId,
        title: args.surveyData.title,
        description: args.surveyData.description,
        isRequired: args.surveyData.isRequired || false,
        allowMultipleResponses: args.surveyData.allowMultipleResponses || false,
        startDate: startDateNumber,
        endDate: endDateNumber,
      });

      if (args.surveyData.questions && args.surveyData.questions.length > 0) {
        for (let i = 0; i < args.surveyData.questions.length; i++) {
          const question = args.surveyData.questions[i];
          await ctx.runMutation(api.surveys.createSurveyQuestion, {
            surveyId,
            questionText: question.questionText,
            questionType: question.questionType as "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file",
            options: question.options,
            isRequired: question.isRequired ?? true,
            order: i + 1,
          });
        }
      }

      const questionCount = args.surveyData.questions?.length || 0;
      const message = questionCount > 0
        ? `Survey created successfully with ${questionCount} questions`
        : "Survey created successfully";

      return {
        success: true,
        surveyId,
        message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create survey: ${error}`,
      };
    }
  },
});

export const editConfirmedSurvey = action({
  args: {
    projectId: v.optional(v.id("projects")),
    surveyId: v.id("surveys"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      questions: v.optional(v.array(v.object({
        questionId: v.optional(v.id("surveyQuestions")),
        operation: v.optional(v.union(
          v.literal("create"),
          v.literal("edit"),
          v.literal("delete")
        )),
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
        options: v.optional(v.array(v.string())),
        isRequired: v.optional(v.boolean()),
        order: v.optional(v.number()),
      }))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const survey = await ctx.runQuery(api.surveys.getSurvey, { surveyId: args.surveyId });
      if (!survey) {
        throw new Error("Survey not found");
      }

      if (args.projectId && survey.projectId !== args.projectId) {
        throw new Error("Survey does not belong to the active project");
      }

      await ensureProjectAccess(ctx, args.projectId ?? survey.projectId, true);

      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.updates.startDate) {
        startDateNumber = new Date(args.updates.startDate).getTime();
      }
      if (args.updates.endDate) {
        endDateNumber = new Date(args.updates.endDate).getTime();
      }

      await ctx.runMutation(api.surveys.updateSurvey, {
        surveyId: args.surveyId,
        title: args.updates.title,
        description: args.updates.description,
        isRequired: args.updates.isRequired,
        allowMultipleResponses: args.updates.allowMultipleResponses,
        startDate: startDateNumber,
        endDate: endDateNumber,
      });

      if (args.updates.questions && args.updates.questions.length > 0) {
        const existingQuestions = Array.isArray(survey.questions) ? survey.questions : [];
        const existingQuestionsByOrder = new Map<number, Id<"surveyQuestions">>();
        const existingQuestionsByText = new Map<string, Id<"surveyQuestions"> | null>();

        for (const question of existingQuestions) {
          existingQuestionsByOrder.set(question.order, question._id);

          const normalizedText = question.questionText.trim().toLowerCase();
          const previouslySeen = existingQuestionsByText.get(normalizedText);
          if (previouslySeen === undefined) {
            existingQuestionsByText.set(normalizedText, question._id);
          } else {
            // Mark duplicates as ambiguous to avoid false-positive matches by text.
            existingQuestionsByText.set(normalizedText, null);
          }
        }

        let nextQuestionOrder = existingQuestions.reduce((max, question) => Math.max(max, question.order), 0);
        const shouldAllowIndexFallback =
          existingQuestions.length > 0 &&
          existingQuestions.length === args.updates.questions.length;

        for (const [index, questionUpdate] of args.updates.questions.entries()) {
          const { questionId, operation, ...questionFields } = questionUpdate as {
            questionId?: Id<"surveyQuestions">;
            operation?: "create" | "edit" | "delete";
            questionText?: string;
            questionType?: string;
            options?: Array<string>;
            isRequired?: boolean;
            order?: number;
          };

          const resolveQuestionId = (): Id<"surveyQuestions"> | undefined => {
            if (questionId) return questionId;

            if (typeof questionFields.order === "number") {
              const byOrder = existingQuestionsByOrder.get(questionFields.order);
              if (byOrder) return byOrder;
            }

            if (typeof questionFields.questionText === "string") {
              const normalizedText = questionFields.questionText.trim().toLowerCase();
              const byText = existingQuestionsByText.get(normalizedText);
              if (byText) return byText;
            }

            if (shouldAllowIndexFallback && existingQuestions[index]) {
              return existingQuestions[index]._id;
            }

            return undefined;
          };

          const resolvedQuestionId = resolveQuestionId();
          const resolvedOperation: "create" | "edit" | "delete" = operation
            ? operation
            : resolvedQuestionId
              ? "edit"
              : existingQuestions.length === 0
                ? "create"
                : "edit";

          if (resolvedOperation === "create") {
            if (!questionFields.questionText || !questionFields.questionType) {
              throw new Error("Question create operation requires questionText and questionType");
            }

            const questionOrder = questionFields.order ?? ++nextQuestionOrder;
            nextQuestionOrder = Math.max(nextQuestionOrder, questionOrder);

            await ctx.runMutation(api.surveys.createSurveyQuestion, {
              surveyId: args.surveyId,
              questionText: questionFields.questionText as string,
              questionType: questionFields.questionType as
                | "text_short"
                | "text_long"
                | "multiple_choice"
                | "single_choice"
                | "rating"
                | "yes_no"
                | "number"
                | "file",
              options: questionFields.options,
              isRequired: questionFields.isRequired ?? true,
              order: questionOrder,
            });
            continue;
          }

          if (!resolvedQuestionId) {
            throw new Error("Missing questionId for survey question update/delete. Use operation='create' for new questions.");
          }

          if (resolvedOperation === "delete") {
            await ctx.runMutation(api.surveys.deleteQuestion, {
              questionId: resolvedQuestionId,
            });
            continue;
          }

          await ctx.runMutation(api.surveys.updateQuestion, {
            questionId: resolvedQuestionId,
            questionText: questionFields.questionText,
            questionType: questionFields.questionType as
              | "text_short"
              | "text_long"
              | "multiple_choice"
              | "single_choice"
              | "rating"
              | "yes_no"
              | "number"
              | "file"
              | undefined,
            options: questionFields.options,
            isRequired: questionFields.isRequired,
            order: questionFields.order,
          });
        }
      }

      return {
        success: true,
        message: "Survey updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update survey: ${error}`,
      };
    }
  },
});

export const deleteConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    title: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const survey = await ctx.runQuery(api.surveys.getSurvey, { surveyId: args.surveyId });
      if (!survey) {
        throw new Error("Survey not found");
      }
      await ensureProjectAccess(ctx, survey.projectId, true);

      await ctx.runMutation(api.surveys.deleteSurvey, {
        surveyId: args.surveyId,
      });

      return {
        success: true,
        message: `Survey "${args.title}" deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete survey: ${error}`,
      };
    }
  },
});















