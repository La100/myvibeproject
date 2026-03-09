"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  Copy,
  CreditCard,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/components/providers/ProjectProvider";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { formatCurrency } from "@/lib/utils";

type Installment = {
  _id: Id<"projectPayments">;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: number;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  stripeHostedInvoiceUrl?: string;
  stripeInvoiceNumber?: string;
  paidAt?: number;
  isOverdue?: boolean;
};

type InstallmentFormState = {
  title: string;
  description: string;
  amount: string;
  dueDate: string;
};

const EMPTY_FORM: InstallmentFormState = {
  title: "",
  description: "",
  amount: "",
  dueDate: "",
};

const formatDateInput = (timestamp?: number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return new Date(`${trimmed}T12:00:00`).getTime();
};

const getStatusBadgeClassName = (installment: Installment) => {
  if (installment.status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (installment.status === "void") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  if (installment.status === "uncollectible") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (installment.isOverdue) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (installment.status === "open") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-[var(--ui-border-soft)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-main)]";
};

const getStatusLabel = (installment: Installment) => {
  if (installment.isOverdue) {
    return "OVERDUE";
  }
  return installment.status.toUpperCase();
};

export default function ProjectPaymentsView() {
  const { project, isLoading } = useProject();
  const paymentsData = useQuery(
    apiAny.projectPayments.getProjectPaymentsOverview,
    isLoading ? "skip" : { projectId: project._id },
  );

  const updateCustomer = useMutation(apiAny.projectPayments.updateProjectPaymentCustomer);
  const createPayment = useMutation(apiAny.projectPayments.createProjectPayment);
  const updatePayment = useMutation(apiAny.projectPayments.updateProjectPayment);
  const deletePayment = useMutation(apiAny.projectPayments.deleteProjectPayment);

  const createInvoice = useAction(apiAny.projectPaymentActions.createProjectPaymentInvoice);
  const sendInvoiceEmail = useAction(apiAny.projectPaymentActions.sendProjectPaymentInvoiceEmail);
  const refreshInvoice = useAction(apiAny.projectPaymentActions.refreshProjectPaymentInvoice);
  const cancelInvoice = useAction(apiAny.projectPaymentActions.cancelProjectPaymentInvoice);
  const createCustomerPortal = useAction(apiAny.projectPaymentActions.createProjectCustomerPortalSession);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [form, setForm] = useState<InstallmentFormState>(EMPTY_FORM);
  const [submittingInstallment, setSubmittingInstallment] = useState(false);
  const [busyInstallmentId, setBusyInstallmentId] = useState<Id<"projectPayments"> | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!paymentsData) return;
    setCustomerName(paymentsData.customerName || "");
    setCustomerEmail(paymentsData.customerEmail || "");
  }, [paymentsData]);

  const installments = useMemo(
    () => ((paymentsData?.installments as Installment[] | undefined) ?? []),
    [paymentsData],
  );

  const visibleInstallments = installments.filter((installment) => installment.status !== "void");
  const pendingInstallments = visibleInstallments.filter(
    (installment) => installment.status === "draft" || installment.status === "open" || installment.isOverdue,
  );

  const openCreateDialog = () => {
    setEditingInstallment(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (installment: Installment) => {
    setEditingInstallment(installment);
    setForm({
      title: installment.title,
      description: installment.description || "",
      amount: installment.amount.toFixed(2),
      dueDate: formatDateInput(installment.dueDate),
    });
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingInstallment(null);
    setForm(EMPTY_FORM);
  };

  const saveCustomerDetails = async () => {
    setIsSavingCustomer(true);
    try {
      await updateCustomer({
        projectId: project._id,
        customerName,
        customerEmail,
      });
      toast.success("Billing contact updated");
    } catch (error) {
      toast.error("Could not update billing contact", {
        description: (error as Error).message,
      });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const saveInstallment = async () => {
    const parsedAmount = Number.parseFloat(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid installment amount");
      return;
    }

    setSubmittingInstallment(true);
    try {
      if (editingInstallment) {
        await updatePayment({
          installmentId: editingInstallment._id,
          title: form.title,
          description: form.description,
          amount: parsedAmount,
          dueDate: parseDateInput(form.dueDate) ?? null,
        });
        toast.success("Installment updated");
      } else {
        await createPayment({
          projectId: project._id,
          title: form.title,
          description: form.description,
          amount: parsedAmount,
          dueDate: parseDateInput(form.dueDate) ?? null,
        });
        toast.success("Installment created");
      }
      resetDialog();
    } catch (error) {
      toast.error("Could not save installment", {
        description: (error as Error).message,
      });
    } finally {
      setSubmittingInstallment(false);
    }
  };

  const copyInvoiceLink = async (url?: string) => {
    if (!url) {
      toast.error("No Stripe payment link available yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Stripe payment link copied");
    } catch {
      toast.error("Could not copy Stripe payment link");
    }
  };

  const runInstallmentAction = async (
    installmentId: Id<"projectPayments">,
    actionName:
      | "create"
      | "send"
      | "refresh"
      | "cancel",
  ) => {
    setBusyInstallmentId(installmentId);
    try {
      if (actionName === "create") {
        const result = await createInvoice({ installmentId });
        toast.success("Stripe payment link is ready");
        if (result.url) {
          await navigator.clipboard.writeText(result.url);
          toast.success("Payment link copied");
        }
        return;
      }

      if (actionName === "send") {
        await sendInvoiceEmail({ installmentId });
        toast.success("Stripe sent the invoice email");
        return;
      }

      if (actionName === "refresh") {
        await refreshInvoice({ installmentId });
        toast.success("Stripe payment status refreshed");
        return;
      }

      await cancelInvoice({ installmentId });
      toast.success("Stripe invoice voided");
    } catch (error) {
      toast.error("Stripe action failed", {
        description: (error as Error).message,
      });
    } finally {
      setBusyInstallmentId(null);
    }
  };

  const removeDraftInstallment = async (installmentId: Id<"projectPayments">) => {
    setBusyInstallmentId(installmentId);
    try {
      await deletePayment({ installmentId });
      toast.success("Draft installment deleted");
    } catch (error) {
      toast.error("Could not delete installment", {
        description: (error as Error).message,
      });
    } finally {
      setBusyInstallmentId(null);
    }
  };

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const result = await createCustomerPortal({ projectId: project._id });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Could not open Stripe customer portal", {
        description: (error as Error).message,
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading || paymentsData === undefined) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ProjectPageLayout>
      <div className="space-y-8">
        <ProjectPageHeader
          title="Payments"
          icon={<Wallet className="h-8 w-8 text-[var(--ui-accent-brand)]" />}
          subtitle="Create Stripe installments for this project, share payment links, and track what is still due."
          actions={
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New installment
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(paymentsData.totals.scheduled || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-emerald-700">
              {formatCurrency(paymentsData.totals.paid || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(paymentsData.totals.outstanding || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card className="bg-card/90">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-rose-700">
              {paymentsData.totals.overdueCount || 0}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-customer-name">Customer name</Label>
                <Input
                  id="payment-customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Acme HQ renovation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-customer-email">Billing email</Label>
                <Input
                  id="payment-customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="finance@client.com"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveCustomerDetails} disabled={isSavingCustomer}>
                  {isSavingCustomer ? "Saving..." : "Save billing contact"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openCustomerPortal}
                  disabled={portalLoading || (!paymentsData.stripeCustomerId && !customerEmail.trim())}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {portalLoading ? "Opening..." : "Open Stripe portal"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stripe will use this contact for invoice emails, hosted payment links, and the customer portal.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Due Soon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInstallments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unpaid installments.</p>
              ) : (
                pendingInstallments.slice(0, 4).map((installment) => (
                  <div
                    key={installment._id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{installment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {installment.dueDate
                          ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                          : "No due date"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(installment.amount, installment.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{getStatusLabel(installment)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/92">
          <CardHeader>
            <CardTitle>Installments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {installments.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No installments yet. Create the first payment tranche and generate a Stripe link for it.
              </div>
            ) : (
              installments.map((installment) => {
                const isBusy = busyInstallmentId === installment._id;
                const isDraft = installment.status === "draft";
                const canOpenLink = !!installment.stripeHostedInvoiceUrl;
                const canVoid =
                  installment.status === "open" || installment.status === "uncollectible";

                return (
                  <div key={installment._id} className="rounded-2xl border bg-background/50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-medium">{installment.title}</h3>
                          <Badge variant="outline" className={getStatusBadgeClassName(installment)}>
                            {getStatusLabel(installment)}
                          </Badge>
                          {installment.stripeInvoiceNumber ? (
                            <Badge variant="outline">#{installment.stripeInvoiceNumber}</Badge>
                          ) : null}
                        </div>
                        {installment.description ? (
                          <p className="text-sm text-muted-foreground">{installment.description}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>{formatCurrency(installment.amount, installment.currency)}</span>
                          <span>
                            {installment.dueDate
                              ? `Due ${new Date(installment.dueDate).toLocaleDateString()}`
                              : "No due date"}
                          </span>
                          {installment.paidAt ? (
                            <span>Paid {new Date(installment.paidAt).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isDraft ? (
                          <>
                            <Button type="button" size="sm" onClick={() => openEditDialog(installment)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void runInstallmentAction(installment._id, "create")}
                              disabled={isBusy}
                            >
                              {isBusy ? "Creating..." : "Create Stripe link"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void runInstallmentAction(installment._id, "send")}
                              disabled={isBusy}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Send invoice
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void removeDraftInstallment(installment._id)}
                              disabled={isBusy}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyInvoiceLink(installment.stripeHostedInvoiceUrl)}
                              disabled={!canOpenLink}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy link
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(installment.stripeHostedInvoiceUrl, "_blank", "noopener,noreferrer")}
                              disabled={!canOpenLink}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Stripe
                            </Button>
                            {installment.status !== "paid" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void runInstallmentAction(installment._id, "send")}
                                disabled={isBusy}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Re-send
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void runInstallmentAction(installment._id, "refresh")}
                              disabled={isBusy}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh
                            </Button>
                            {canVoid ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => void runInstallmentAction(installment._id, "cancel")}
                                disabled={isBusy}
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
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingInstallment ? "Edit installment" : "New installment"}</DialogTitle>
            <DialogDescription>
              Draft installments stay local until you create a Stripe invoice and payment link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="installment-title">Title</Label>
              <Input
                id="installment-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Phase 1 deposit"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="installment-amount">Amount ({paymentsData?.currency || project.currency || "PLN"})</Label>
                <Input
                  id="installment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="2500.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-due-date">Due date</Label>
                <Input
                  id="installment-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment-description">Description</Label>
              <Textarea
                id="installment-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What this tranche covers"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveInstallment()} disabled={submittingInstallment}>
              {submittingInstallment ? "Saving..." : editingInstallment ? "Save changes" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectPageLayout>
  );
}
