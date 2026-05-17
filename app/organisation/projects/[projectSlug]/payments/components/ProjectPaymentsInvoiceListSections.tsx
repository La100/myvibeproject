"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabsContent } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import { useI18n } from "@/lib/i18n";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Banknote,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";

type InvoiceCapabilities = {
  canDelete: boolean;
  canEdit: boolean;
  canPreview: boolean;
  canIssue: boolean;
  canSendEmail: boolean;
  canDownloadPdf: boolean;
  canCopyReference: boolean;
  canMarkPaid: boolean;
  canReopen: boolean;
  canVoid: boolean;
  canMarkUncollectible: boolean;
};

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
  capabilities?: Partial<InvoiceCapabilities>;
};

type ActionName =
  | "issue"
  | "send"
  | "download"
  | "paid"
  | "open"
  | "void"
  | "uncollectible";

type ProjectPaymentsInvoiceListSectionsProps = {
  draftInstallments: Installment[];
  openInstallments: Installment[];
  paidInstallments: Installment[];
  archivedInstallments: Installment[];
  busyInstallmentId: Id<"projectPayments"> | null;
  onOpenEditDialog: (installment: Installment) => void;
  onOpenPreview: (installment: Installment) => void;
  onRunAction: (
    installmentId: Id<"projectPayments">,
    actionName: ActionName,
  ) => void;
  onRemoveDraft: (installmentId: Id<"projectPayments">) => void;
  onCopyReference: (value?: string) => void;
};

const fallbackCapabilities = (installment: Installment): InvoiceCapabilities => {
  const issued = Boolean(installment.invoiceNumber || installment.stripeInvoiceId);
  const stripeLinked = Boolean(installment.stripeInvoiceId);

  return {
    canDelete: installment.status === "draft" && !issued,
    canEdit: installment.status === "draft" || (issued && !stripeLinked && installment.status === "open"),
    canPreview: true,
    canIssue: installment.status === "draft" && !issued,
    canSendEmail: issued && installment.status === "open",
    canDownloadPdf: issued && Boolean(installment.hasInvoicePdf),
    canCopyReference: issued && Boolean(installment.paymentReference),
    canMarkPaid: issued && installment.status === "open",
    canReopen:
      issued &&
      !stripeLinked &&
      (installment.status === "paid" || installment.status === "uncollectible"),
    canVoid: issued && !stripeLinked && installment.status === "open",
    canMarkUncollectible: issued && !stripeLinked && installment.status === "open",
  };
};

const getCapabilities = (installment: Installment): InvoiceCapabilities => ({
  ...fallbackCapabilities(installment),
  ...(installment.capabilities || {}),
});

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

const getStatusLabelKey = (installment: Installment) => {
  if (installment.isOverdue) {
    return "statusOverdue";
  }

  return `status${installment.status[0].toUpperCase()}${installment.status.slice(1)}` as
    | "statusDraft"
    | "statusOpen"
    | "statusPaid"
    | "statusVoid"
    | "statusUncollectible";
};

function InvoiceMenuItem({
  icon,
  children,
  disabled,
  destructive,
  onSelect,
}: {
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "gap-2",
        destructive && "text-destructive focus:text-destructive",
      )}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  );
}

function InvoiceListItem({
  installment,
  busy,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
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
  onCopyReference: (value?: string) => void;
}) {
  const { t } = useI18n();
  const capabilities = getCapabilities(installment);
  const primaryAction =
    capabilities.canIssue
      ? {
          label: t("projectPayments", "issue"),
          icon: <FileText data-icon="inline-start" />,
          onClick: () => onRunAction(installment._id, "issue"),
        }
      : capabilities.canMarkPaid
        ? {
            label: t("projectPayments", "markPaid"),
            icon: <CheckCircle2 data-icon="inline-start" />,
            onClick: () => onRunAction(installment._id, "paid"),
          }
        : null;
  const dueDateLabel = installment.dueDate
    ? new Date(installment.dueDate).toLocaleDateString()
    : t("projectPayments", "noDueDate");

  return (
    <div className="grid gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.45fr)_minmax(9rem,0.5fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)_auto] md:items-center md:gap-x-5 md:px-5">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
            {installment.title}
          </h3>
          {installment.invoiceNumber ? (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              #{installment.invoiceNumber}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="md:hidden">{dueDateLabel}</span>
          {installment.paymentReference ? (
            <span className="max-w-full truncate">
              {t("projectPayments", "reference", { reference: installment.paymentReference })}
            </span>
          ) : null}
          {installment.sentAt ? (
            <span>
              {t("projectPayments", "emailedDate", { date: new Date(installment.sentAt).toLocaleDateString() })}
            </span>
          ) : null}
          {installment.paidAt ? (
            <span>
              {t("projectPayments", "paidDate", { date: new Date(installment.paidAt).toLocaleDateString() })}
            </span>
          ) : null}
        </div>
        {installment.description ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {installment.description}
          </p>
        ) : null}
      </div>

      <div className="hidden text-sm text-muted-foreground md:block">
        {dueDateLabel}
      </div>

      <div className="text-sm font-semibold text-foreground md:text-right">
        {formatCurrency(installment.amount, installment.currency)}
      </div>

      <div className="flex md:justify-start">
        <Badge
          variant={getStatusBadgeVariant(installment)}
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em]"
        >
          {t("projectPayments", getStatusLabelKey(installment))}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {primaryAction ? (
          <Button
            type="button"
            size="sm"
            onClick={primaryAction.onClick}
            disabled={busy}
          >
            {primaryAction.icon}
            {primaryAction.label}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={busy}
              aria-label={t("projectPayments", "invoiceActions")}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <InvoiceMenuItem
              icon={<FileText className="size-4" />}
              disabled={!capabilities.canPreview}
              onSelect={() => onOpenPreview(installment)}
            >
              {installment.status === "draft"
                ? t("projectPayments", "view")
                : t("projectPayments", "viewPdf")}
            </InvoiceMenuItem>
            {capabilities.canEdit ? (
              <InvoiceMenuItem
                icon={<FileText className="size-4" />}
                onSelect={() => onOpenEditDialog(installment)}
              >
                {installment.status === "draft"
                  ? t("projectPayments", "edit")
                  : t("projectPayments", "editInvoice")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canDownloadPdf ? (
              <InvoiceMenuItem
                icon={<Download className="size-4" />}
                onSelect={() => onRunAction(installment._id, "download")}
              >
                {t("projectPayments", "downloadPdf")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canSendEmail ? (
              <InvoiceMenuItem
                icon={<Mail className="size-4" />}
                onSelect={() => onRunAction(installment._id, "send")}
              >
                {t("projectPayments", "sendEmail")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canCopyReference ? (
              <InvoiceMenuItem
                icon={<Copy className="size-4" />}
                onSelect={() => onCopyReference(installment.paymentReference)}
              >
                {t("projectPayments", "copyReference")}
              </InvoiceMenuItem>
            ) : null}
            {(capabilities.canReopen ||
              capabilities.canMarkUncollectible ||
              capabilities.canVoid ||
              capabilities.canDelete) ? (
              <DropdownMenuSeparator />
            ) : null}
            {capabilities.canReopen ? (
              <InvoiceMenuItem
                icon={<RotateCcw className="size-4" />}
                onSelect={() => onRunAction(installment._id, "open")}
              >
                {t("projectPayments", "reopen")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canMarkUncollectible ? (
              <InvoiceMenuItem
                icon={<XCircle className="size-4" />}
                onSelect={() => onRunAction(installment._id, "uncollectible")}
              >
                {t("projectPayments", "markUncollectible")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canVoid ? (
              <InvoiceMenuItem
                icon={<XCircle className="size-4" />}
                destructive
                onSelect={() => onRunAction(installment._id, "void")}
              >
                {t("projectPayments", "void")}
              </InvoiceMenuItem>
            ) : null}
            {capabilities.canDelete ? (
              <InvoiceMenuItem
                icon={<Trash2 className="size-4" />}
                destructive
                onSelect={() => onRemoveDraft(installment._id)}
              >
                {t("projectPayments", "delete")}
              </InvoiceMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function InvoiceListSection({
  title,
  icon,
  items,
  emptyMessage,
  busyInstallmentId,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
  onCopyReference,
}: {
  title: string;
  icon: ReactNode;
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
  onCopyReference: (value?: string) => void;
}) {
  const { t } = useI18n();

  return (
    <section>
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight [&>svg]:h-4 [&>svg]:w-4">
          {icon}
          {title}
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 md:px-5">
          <p className="max-w-xl text-sm leading-[1.6] text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div>
          <div className="hidden border-b border-border/60 bg-secondary/35 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(9rem,0.5fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)_auto] md:gap-x-5">
            <span>{t("projectPayments", "invoiceColumn")}</span>
            <span>{t("projectPayments", "dueColumn")}</span>
            <span className="text-right">{t("projectPayments", "amountColumn")}</span>
            <span>{t("projectPayments", "statusColumn")}</span>
            <span className="text-right">{t("projectPayments", "actionsColumn")}</span>
          </div>
          {items.map((installment) => (
            <InvoiceListItem
              key={installment._id}
              installment={installment}
              busy={busyInstallmentId === installment._id}
              onOpenEditDialog={onOpenEditDialog}
              onOpenPreview={onOpenPreview}
              onRunAction={onRunAction}
              onRemoveDraft={onRemoveDraft}
              onCopyReference={onCopyReference}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ProjectPaymentsInvoiceListSections({
  draftInstallments,
  openInstallments,
  paidInstallments,
  archivedInstallments,
  busyInstallmentId,
  onOpenEditDialog,
  onOpenPreview,
  onRunAction,
  onRemoveDraft,
  onCopyReference,
}: ProjectPaymentsInvoiceListSectionsProps) {
  const { t } = useI18n();
  const sharedProps = {
    busyInstallmentId,
    onOpenEditDialog,
    onOpenPreview,
    onRunAction,
    onRemoveDraft,
    onCopyReference,
  };

  return (
    <>
      <TabsContent value="drafts" className="flex flex-col gap-4">
        <InvoiceListSection
          title={t("projectPayments", "draftInvoices")}
          icon={<Wallet />}
          items={draftInstallments}
          emptyMessage={t("projectPayments", "noDraftInvoices")}
          {...sharedProps}
        />
      </TabsContent>

      <TabsContent value="open" className="flex flex-col gap-4">
        <InvoiceListSection
          title={t("projectPayments", "openInvoices")}
          icon={<Banknote />}
          items={openInstallments}
          emptyMessage={t("projectPayments", "noOpenInvoices")}
          {...sharedProps}
        />
      </TabsContent>

      <TabsContent value="paid" className="flex flex-col gap-4">
        <InvoiceListSection
          title={t("projectPayments", "paidInvoices")}
          icon={<CheckCircle2 />}
          items={paidInstallments}
          emptyMessage={t("projectPayments", "noPaidInvoices")}
          {...sharedProps}
        />
      </TabsContent>

      <TabsContent value="archive" className="flex flex-col gap-4">
        <InvoiceListSection
          title={t("projectPayments", "invoiceArchive")}
          icon={<XCircle />}
          items={archivedInstallments}
          emptyMessage={t("projectPayments", "noArchivedInvoices")}
          {...sharedProps}
        />
      </TabsContent>
    </>
  );
}
