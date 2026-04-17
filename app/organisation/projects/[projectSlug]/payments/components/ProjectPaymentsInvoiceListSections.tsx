"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Plus,
  Trash2,
  Wallet,
  Banknote,
} from "lucide-react";

type Installment = {
  _id: Id<"projectPayments">;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: number;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  paidAt?: number;
  sentAt?: number;
  isOverdue?: boolean;
  invoiceNumber?: string;
  paymentReference?: string;
  hasInvoicePdf?: boolean;
  stripeInvoiceId?: string;
  stripeHostedInvoiceUrl?: string;
};

type ActionName = "issue" | "send" | "download" | "link" | "paid" | "open" | "void";

type ProjectPaymentsInvoiceListSectionsProps = {
  draftInstallments: Installment[];
  issuedInstallments: Installment[];
  busyInstallmentId: Id<"projectPayments"> | null;
  onNewInvoice: () => void;
  onOpenEditDialog: (installment: Installment) => void;
  onOpenPreview: (installment: Installment) => void;
  onRunAction: (installmentId: Id<"projectPayments">, actionName: ActionName) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyPaymentLink: (value?: string) => void;
  onCopyReference: (value?: string) => void;
};

const getStatusBadgeVariant = (
  installment: Installment,
): "default" | "secondary" | "outline" | "destructive" => {
  if (installment.isOverdue || installment.status === "uncollectible") {
    return "destructive";
  }

  if (installment.status === "paid") {
    return "default";
  }

  if (installment.status === "open") {
    return "outline";
  }

  return "secondary";
};

const getStatusLabel = (installment: Installment) => {
  if (installment.isOverdue) {
    return "OVERDUE";
  }

  return installment.status.toUpperCase();
};

const actionButtonClassName =
  "h-9 rounded-full border-border/70 bg-white px-3.5 text-[13px] font-medium shadow-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:bg-white hover:text-foreground hover:shadow-sm";

const metaPillClassName =
  "inline-flex items-center rounded-full border border-border/60 bg-muted/25 px-3 py-1 text-[12px] font-medium leading-none text-muted-foreground";

function InvoiceListItem({
  installment,
  busy,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
  onCopyPaymentLink,
  onCopyReference,
}: {
  installment: Installment;
  busy: boolean;
  onOpenEditDialog: (installment: Installment) => void;
  onOpenPreview: (installment: Installment) => void;
  onRunAction: (installmentId: Id<"projectPayments">, actionName: ActionName) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyPaymentLink: (value?: string) => void;
  onCopyReference: (value?: string) => void;
}) {
  const isDraft = installment.status === "draft";
  const canVoid = installment.status !== "paid" && installment.status !== "void";

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-white p-5 shadow-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:shadow-[0_14px_34px_-24px_rgba(70,52,37,0.35)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                    {installment.title}
                  </h3>
                  <Badge
                    variant={getStatusBadgeVariant(installment)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em]"
                  >
                    {getStatusLabel(installment)}
                  </Badge>
                  {installment.invoiceNumber ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold"
                    >
                      #{installment.invoiceNumber}
                    </Badge>
                  ) : null}
                </div>
                {installment.description ? (
                  <p className="mt-2 max-w-3xl text-[13px] leading-[1.6] text-muted-foreground">
                    {installment.description}
                  </p>
                ) : null}
              </div>
              <div className="min-w-[160px] rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Invoice total
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(installment.amount, installment.currency)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={metaPillClassName}>
                {installment.dueDate
                  ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                  : "No due date"}
              </span>
              {installment.paidAt ? (
                <span className={metaPillClassName}>Paid {new Date(installment.paidAt).toLocaleDateString()}</span>
              ) : null}
              {installment.sentAt ? (
                <span className={metaPillClassName}>Emailed {new Date(installment.sentAt).toLocaleDateString()}</span>
              ) : null}
              {installment.stripeHostedInvoiceUrl ? (
                <span className={metaPillClassName}>Payment link ready</span>
              ) : null}
            </div>

            {installment.paymentReference ? (
              <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Transfer reference
                </p>
                <p className="mt-1 break-all text-[13px] font-medium leading-[1.5] text-foreground">
                  {installment.paymentReference}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {isDraft ? (
            <>
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-full px-4 text-[13px] font-medium"
                onClick={() => onOpenEditDialog(installment)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onOpenPreview(installment)}
                disabled={busy}
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onRunAction(installment._id, "link")}
                disabled={busy}
              >
                <ExternalLink data-icon="inline-start" />
                Create payment link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onRunAction(installment._id, "send")}
                disabled={busy}
              >
                <Mail data-icon="inline-start" />
                Send via email
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 rounded-full px-3.5 text-[13px] font-medium text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveDraft(installment._id)}
                disabled={busy}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onOpenEditDialog(installment)}
                disabled={busy || (!installment.invoiceNumber && !installment.stripeInvoiceId) || Boolean(installment.stripeInvoiceId)}
              >
                Edit invoice
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onOpenPreview(installment)}
                disabled={busy}
              >
                View PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onRunAction(installment._id, "download")}
                disabled={busy || !installment.hasInvoicePdf}
              >
                <Download data-icon="inline-start" />
                Download PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onRunAction(installment._id, "link")}
                disabled={
                  busy ||
                  installment.status === "paid" ||
                  installment.status === "void" ||
                  installment.status === "uncollectible"
                }
              >
                <ExternalLink data-icon="inline-start" />
                {installment.stripeHostedInvoiceUrl ? "Open payment link" : "Create payment link"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onCopyPaymentLink(installment.stripeHostedInvoiceUrl)}
                disabled={!installment.stripeHostedInvoiceUrl}
              >
                <Copy data-icon="inline-start" />
                Copy payment link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onRunAction(installment._id, "send")}
                disabled={busy}
              >
                <Mail data-icon="inline-start" />
                Send email
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={actionButtonClassName}
                onClick={() => onCopyReference(installment.paymentReference)}
                disabled={!installment.paymentReference}
              >
                <Copy data-icon="inline-start" />
                Copy reference
              </Button>
              {installment.status !== "paid" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(actionButtonClassName, "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/45 hover:bg-emerald-500/15 hover:text-emerald-800")}
                  onClick={() => onRunAction(installment._id, "paid")}
                  disabled={busy}
                >
                  <CheckCircle2 data-icon="inline-start" />
                  Mark paid
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={actionButtonClassName}
                  onClick={() => onRunAction(installment._id, "open")}
                  disabled={busy}
                >
                  Reopen
                </Button>
              )}
              {canVoid ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-9 rounded-full px-4 text-[13px] font-medium shadow-none"
                  onClick={() => onRunAction(installment._id, "void")}
                  disabled={busy}
                >
                  Void
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoiceListSection({
  title,
  icon,
  action,
  items,
  emptyMessage,
  busyInstallmentId,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
  onCopyPaymentLink,
  onCopyReference,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  items: Installment[];
  emptyMessage: string;
  busyInstallmentId: Id<"projectPayments"> | null;
  onOpenEditDialog: (installment: Installment) => void;
  onOpenPreview: (installment: Installment) => void;
  onRunAction: (installmentId: Id<"projectPayments">, actionName: ActionName) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyPaymentLink: (value?: string) => void;
  onCopyReference: (value?: string) => void;
}) {
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/70 bg-white shadow-none">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-muted/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-6">
        {items.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/10 px-5 py-10 text-center">
            <p className="mx-auto max-w-xl text-sm leading-[1.6] text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          items.map((installment) => (
            <InvoiceListItem
              key={installment._id}
              installment={installment}
              busy={busyInstallmentId === installment._id}
              onOpenEditDialog={onOpenEditDialog}
              onOpenPreview={onOpenPreview}
              onRunAction={onRunAction}
              onRemoveDraft={onRemoveDraft}
              onCopyPaymentLink={onCopyPaymentLink}
              onCopyReference={onCopyReference}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectPaymentsInvoiceListSections({
  draftInstallments,
  issuedInstallments,
  busyInstallmentId,
  onNewInvoice,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
  onCopyPaymentLink,
  onCopyReference,
}: ProjectPaymentsInvoiceListSectionsProps) {
  return (
    <>
      <TabsContent value="schedule" className="flex flex-col gap-6">
        <InvoiceListSection
          title="Draft invoices"
          icon={<Wallet />}
          action={
            <Button type="button" onClick={onNewInvoice}>
              <Plus data-icon="inline-start" />
              New invoice
            </Button>
          }
          items={draftInstallments}
          emptyMessage="No draft invoices yet. Create one here and issue it from the next tab when it is ready."
          busyInstallmentId={busyInstallmentId}
          onOpenEditDialog={onOpenEditDialog}
          onOpenPreview={onOpenPreview}
          onRunAction={onRunAction}
          onRemoveDraft={onRemoveDraft}
          onCopyPaymentLink={onCopyPaymentLink}
          onCopyReference={onCopyReference}
        />
      </TabsContent>

      <TabsContent value="invoices" className="flex flex-col gap-6">
        <InvoiceListSection
          title="Issued invoices"
          icon={<Banknote />}
          items={issuedInstallments}
          emptyMessage="No issued invoices yet. Issue a draft invoice and it will appear here."
          busyInstallmentId={busyInstallmentId}
          onOpenEditDialog={onOpenEditDialog}
          onOpenPreview={onOpenPreview}
          onRunAction={onRunAction}
          onRemoveDraft={onRemoveDraft}
          onCopyPaymentLink={onCopyPaymentLink}
          onCopyReference={onCopyReference}
        />
      </TabsContent>
    </>
  );
}
