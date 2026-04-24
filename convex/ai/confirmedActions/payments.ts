/**
 * Confirmed Actions - Payments
 *
 * Invoice/payment CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { ensureProjectAccess, parseOptionalDateToMillis } from "./helpers";

const getProjectPaymentsOverviewQueryRef =
  makeFunctionReference<"query">("projectPayments:getProjectPaymentsOverview");
const createProjectPaymentMutationRef =
  makeFunctionReference<"mutation">("projectPayments:createProjectPayment");
const updateProjectPaymentMutationRef =
  makeFunctionReference<"mutation">("projectPayments:updateProjectPayment");
const updateIssuedProjectPaymentInvoiceMutationRef =
  makeFunctionReference<"mutation">("projectPayments:updateIssuedProjectPaymentInvoice");
const deleteProjectPaymentMutationRef =
  makeFunctionReference<"mutation">("projectPayments:deleteProjectPayment");
const setProjectPaymentManualStatusMutationRef =
  makeFunctionReference<"mutation">("projectPayments:setProjectPaymentManualStatus");

const paymentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
);

function hasDefinedUpdates(updates: Record<string, unknown>): boolean {
  return Object.values(updates).some((value) => value !== undefined);
}

export const createConfirmedPayment = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    paymentData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      amount: v.number(),
      dueDate: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    paymentId: v.optional(v.id("projectPayments")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      const dueDate = parseOptionalDateToMillis(
        args.paymentData.dueDate,
        "payment dueDate",
      );

      const paymentId = await ctx.runMutation(createProjectPaymentMutationRef, {
        projectId: args.projectId,
        title: args.paymentData.title,
        description: args.paymentData.description,
        amount: args.paymentData.amount,
        dueDate,
      });

      return {
        success: true,
        paymentId,
        message: "Invoice draft created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create invoice draft: ${error}`,
      };
    }
  },
});

export const editConfirmedPayment = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.optional(v.string()),
    paymentId: v.id("projectPayments"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.union(v.string(), v.null())),
      amount: v.optional(v.number()),
      dueDate: v.optional(v.union(v.string(), v.null())),
      invoiceNumber: v.optional(v.string()),
      status: v.optional(paymentStatusValidator),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);

      if (!hasDefinedUpdates(args.updates)) {
        throw new Error("No valid payment update fields were provided");
      }

      const overview = await ctx.runQuery(getProjectPaymentsOverviewQueryRef, {
        projectId: args.projectId,
      });
      const installments = Array.isArray(overview?.installments)
        ? overview.installments
        : [];
      const installment = installments.find(
        (entry: { _id?: string }) => entry?._id === args.paymentId,
      );

      if (!installment) {
        throw new Error("Invoice not found");
      }

      const dueDate = parseOptionalDateToMillis(
        args.updates.dueDate,
        "payment dueDate",
      );

      const isIssuedInvoice =
        typeof installment.invoiceNumber === "string" ||
        typeof installment.stripeInvoiceId === "string" ||
        installment.status !== "draft";

      const hasInvoiceFieldUpdates =
        args.updates.title !== undefined ||
        args.updates.description !== undefined ||
        args.updates.amount !== undefined ||
        args.updates.dueDate !== undefined ||
        args.updates.invoiceNumber !== undefined;

      if (args.updates.status !== undefined) {
        if (!isIssuedInvoice) {
          throw new Error("Issue the invoice before changing its payment status");
        }
        if (args.updates.status === "draft") {
          throw new Error("Issued invoices cannot be moved back to draft status");
        }
      }

      if (isIssuedInvoice && hasInvoiceFieldUpdates) {
        const nextInvoiceNumber =
          args.updates.invoiceNumber ?? installment.invoiceNumber;
        if (!nextInvoiceNumber || !String(nextInvoiceNumber).trim()) {
          throw new Error("Invoice number is required when editing an issued invoice");
        }

        await ctx.runMutation(updateIssuedProjectPaymentInvoiceMutationRef, {
          installmentId: args.paymentId,
          title: args.updates.title ?? installment.title,
          description:
            args.updates.description !== undefined
              ? args.updates.description
              : installment.description,
          amount: args.updates.amount ?? installment.amount,
          dueDate:
            args.updates.dueDate !== undefined
              ? dueDate ?? null
              : installment.dueDate ?? null,
          invoiceNumber: String(nextInvoiceNumber).trim(),
        });
      } else if (!isIssuedInvoice && hasInvoiceFieldUpdates) {
        await ctx.runMutation(updateProjectPaymentMutationRef, {
          installmentId: args.paymentId,
          title: args.updates.title,
          description: args.updates.description,
          amount: args.updates.amount,
          dueDate: args.updates.dueDate !== undefined ? dueDate ?? null : undefined,
        });
      }

      if (args.updates.status !== undefined) {
        await ctx.runMutation(setProjectPaymentManualStatusMutationRef, {
          installmentId: args.paymentId,
          status: args.updates.status,
        });
      } else if (!hasInvoiceFieldUpdates) {
        throw new Error(
          "No valid payment update fields were provided. Use title, description, amount, dueDate, invoiceNumber, or status.",
        );
      }

      return {
        success: true,
        message: "Invoice updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update invoice: ${error}`,
      };
    }
  },
});

export const deleteConfirmedPayment = action({
  args: {
    projectId: v.id("projects"),
    paymentId: v.id("projectPayments"),
    userClerkId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ensureProjectAccess(ctx, args.projectId, true, args.userClerkId);
      void args.reason;

      const overview = await ctx.runQuery(getProjectPaymentsOverviewQueryRef, {
        projectId: args.projectId,
      });
      const installments = Array.isArray(overview?.installments)
        ? overview.installments
        : [];
      const installment = installments.find(
        (entry: { _id?: string }) => entry?._id === args.paymentId,
      );
      if (!installment) {
        throw new Error("Invoice not found in the active project");
      }

      await ctx.runMutation(deleteProjectPaymentMutationRef, {
        installmentId: args.paymentId,
      });

      return {
        success: true,
        message: "Invoice deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete invoice: ${error}`,
      };
    }
  },
});
