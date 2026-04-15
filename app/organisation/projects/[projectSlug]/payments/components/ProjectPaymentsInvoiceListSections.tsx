"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/utils";
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
    <div className="rounded-2xl border border-border/70 bg-white p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight">{installment.title}</h3>
            <Badge variant={getStatusBadgeVariant(installment)}>{getStatusLabel(installment)}</Badge>
            {installment.invoiceNumber ? <Badge variant="outline">#{installment.invoiceNumber}</Badge> : null}
          </div>
          {installment.description ? (
            <p className="text-[13px] leading-[1.45] text-muted-foreground">{installment.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-4 text-[13px] leading-[1.45] text-muted-foreground">
            <span>{formatCurrency(installment.amount, installment.currency)}</span>
            <span>
              {installment.dueDate
                ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                : "No due date"}
            </span>
            {installment.paidAt ? <span>Paid {new Date(installment.paidAt).toLocaleDateString()}</span> : null}
            {installment.sentAt ? <span>Emailed {new Date(installment.sentAt).toLocaleDateString()}</span> : null}
          </div>
          {installment.paymentReference ? (
            <p className="text-[13px] leading-[1.45] text-muted-foreground">
              Transfer reference:{" "}
              <span className="font-medium text-foreground">{installment.paymentReference}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <Button type="button" size="sm" onClick={() => onOpenEditDialog(installment)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenPreview(installment)}
                disabled={busy}
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
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
                onClick={() => onOpenEditDialog(installment)}
                disabled={busy || (!installment.invoiceNumber && !installment.stripeInvoiceId) || Boolean(installment.stripeInvoiceId)}
              >
                Edit invoice
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenPreview(installment)}
                disabled={busy}
              >
                View PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
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
    <Card className="border-border/70 bg-white shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
