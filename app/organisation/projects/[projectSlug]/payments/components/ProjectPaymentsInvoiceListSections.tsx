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
  FileText,
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

type ActionName =
  | "issue"
  | "send"
  | "download"
  | "link"
  | "paid"
  | "open"
  | "void";

type ProjectPaymentsInvoiceListSectionsProps = {
  draftInstallments: Installment[];
  issuedInstallments: Installment[];
  busyInstallmentId: Id<"projectPayments"> | null;
  onNewInvoice: () => void;
  onOpenEditDialog: (installment: Installment) => void;
  onOpenPreview: (installment: Installment) => void;
  onRunAction: (
    installmentId: Id<"projectPayments">,
    actionName: ActionName,
  ) => void;
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
  "h-8 shrink-0 rounded-full border-border/60 bg-card px-3 text-[12px] font-medium shadow-none transition-colors hover:bg-card hover:text-foreground";

const metaPillClassName =
  "inline-flex max-w-full items-center rounded-full border border-border/60 bg-secondary/70 px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground";

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
  onRunAction: (
    installmentId: Id<"projectPayments">,
    actionName: ActionName,
  ) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyPaymentLink: (value?: string) => void;
  onCopyReference: (value?: string) => void;
}) {
  const isDraft = installment.status === "draft";
  const canVoid =
    installment.status !== "paid" && installment.status !== "void";

  return (
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-4 shadow-[0_16px_44px_-34px_rgba(24,20,16,0.34)] transition-[border-color,box-shadow] hover:border-border hover:shadow-sm sm:px-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full text-[15px] font-semibold leading-tight text-foreground">
              {installment.title}
            </h3>
            <Badge
              variant={getStatusBadgeVariant(installment)}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em]"
            >
              {getStatusLabel(installment)}
            </Badge>
            {installment.invoiceNumber ? (
              <Badge
                variant="outline"
                className="rounded-full border-border/70 bg-card px-2.5 py-0.5 text-[10px] font-semibold"
              >
                #{installment.invoiceNumber}
              </Badge>
            ) : null}
          </div>

          {installment.description ? (
            <p className="max-w-3xl truncate text-[13px] leading-5 text-muted-foreground">
              {installment.description}
            </p>
          ) : null}

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-full bg-secondary/55 px-2.5 py-1">
              <span className="text-xs font-medium text-muted-foreground">
                Total
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(installment.amount, installment.currency)}
              </span>
            </span>
            <span className={metaPillClassName}>
              {installment.dueDate
                ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                : "No due date"}
            </span>
            {installment.paymentReference ? (
              <span className={cn(metaPillClassName, "max-w-[360px] truncate")}>
                Ref {installment.paymentReference}
              </span>
            ) : null}
            {installment.paidAt ? (
              <span className={metaPillClassName}>
                Paid {new Date(installment.paidAt).toLocaleDateString()}
              </span>
            ) : null}
            {installment.sentAt ? (
              <span className={metaPillClassName}>
                Emailed {new Date(installment.sentAt).toLocaleDateString()}
              </span>
            ) : null}
            {installment.stripeHostedInvoiceUrl ? (
              <span className={metaPillClassName}>Payment link ready</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 lg:justify-end">
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-secondary/35 p-1 lg:justify-end">
            {isDraft ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 rounded-full px-3 text-[12px] font-medium"
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
                  onClick={() => onRunAction(installment._id, "issue")}
                  disabled={busy}
                >
                  <FileText data-icon="inline-start" />
                  Issue
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
                  className="h-8 shrink-0 rounded-full px-3 text-[12px] font-medium text-muted-foreground hover:text-destructive"
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
                  disabled={
                    busy ||
                    (!installment.invoiceNumber &&
                      !installment.stripeInvoiceId) ||
                    Boolean(installment.stripeInvoiceId)
                  }
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
                  {installment.stripeHostedInvoiceUrl
                    ? "Open payment link"
                    : "Create payment link"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={actionButtonClassName}
                  onClick={() =>
                    onCopyPaymentLink(installment.stripeHostedInvoiceUrl)
                  }
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
                    className={cn(
                      actionButtonClassName,
                      "border-primary/35 bg-primary/10 text-primary hover:border-primary/45 hover:bg-primary/15 hover:text-primary",
                    )}
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
                    className="h-8 shrink-0 rounded-full px-3 text-[12px] font-medium shadow-none"
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
  onRunAction: (
    installmentId: Id<"projectPayments">,
    actionName: ActionName,
  ) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyPaymentLink: (value?: string) => void;
  onCopyReference: (value?: string) => void;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 bg-card py-0 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight [&>svg]:h-5 [&>svg]:w-5">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5 py-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/70 px-5 py-7 text-center">
            <p className="mx-auto max-w-xl text-sm leading-[1.6] text-muted-foreground">
              {emptyMessage}
            </p>
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
      <TabsContent value="schedule" className="flex flex-col gap-4">
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

      <TabsContent value="invoices" className="flex flex-col gap-4">
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
