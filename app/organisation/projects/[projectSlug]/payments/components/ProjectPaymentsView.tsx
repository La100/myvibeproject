"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Copy,
  Download,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  paidAt?: number;
  sentAt?: number;
  isOverdue?: boolean;
  invoiceNumber?: string;
  paymentReference?: string;
  hasInvoicePdf?: boolean;
};

type BillingProfile = {
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerTaxId: string;
  sellerAddressLine1: string;
  sellerAddressLine2: string;
  sellerPostalCode: string;
  sellerCity: string;
  sellerCountry: string;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankSwift: string;
  invoicePrefix: string;
  paymentInstructions: string;
  defaultPaymentTermDays: string;
};

type CustomerDetails = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
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

const EMPTY_BILLING_PROFILE: BillingProfile = {
  sellerName: "",
  sellerEmail: "",
  sellerPhone: "",
  sellerTaxId: "",
  sellerAddressLine1: "",
  sellerAddressLine2: "",
  sellerPostalCode: "",
  sellerCity: "",
  sellerCountry: "",
  bankAccountHolder: "",
  bankName: "",
  bankAccountNumber: "",
  bankSwift: "",
  invoicePrefix: "FV",
  paymentInstructions: "",
  defaultPaymentTermDays: "14",
};

const EMPTY_CUSTOMER: CustomerDetails = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  taxId: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "",
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

const buildCustomerFromProject = (project?: {
  customer?: string;
  location?: string;
}) => {
  if (!project) return EMPTY_CUSTOMER;

  return {
    name: project.customer?.trim() || "",
    companyName: "",
    email: "",
    phone: "",
    taxId: "",
    addressLine1: project.location?.trim() || "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "",
  };
};

export default function ProjectPaymentsView() {
  const { project, isLoading } = useProject();
  const paymentsData = useQuery(
    apiAny.projectPayments.getProjectPaymentsOverview,
    isLoading ? "skip" : { projectId: project._id },
  );

  const updateTeamSettings = useMutation(apiAny.teams.updateTeamSettings);
  const updateCustomer = useMutation(apiAny.projectPayments.updateProjectPaymentCustomer);
  const createPayment = useMutation(apiAny.projectPayments.createProjectPayment);
  const updatePayment = useMutation(apiAny.projectPayments.updateProjectPayment);
  const deletePayment = useMutation(apiAny.projectPayments.deleteProjectPayment);
  const setPaymentStatus = useMutation(apiAny.projectPayments.setProjectPaymentManualStatus);

  const createInvoice = useAction(apiAny.projectPaymentActions.createProjectPaymentInvoice);
  const sendInvoiceEmail = useAction(apiAny.projectPaymentActions.sendProjectPaymentInvoiceEmail);
  const downloadInvoiceUrl = useAction(apiAny.projectPaymentActions.getProjectPaymentInvoiceDownloadUrl);

  const [billingProfile, setBillingProfile] = useState<BillingProfile>(EMPTY_BILLING_PROFILE);
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [isSavingBillingProfile, setIsSavingBillingProfile] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [form, setForm] = useState<InstallmentFormState>(EMPTY_FORM);
  const [submittingInstallment, setSubmittingInstallment] = useState(false);
  const [busyInstallmentId, setBusyInstallmentId] = useState<Id<"projectPayments"> | null>(null);

  useEffect(() => {
    if (!paymentsData) return;

    setBillingProfile({
      sellerName: paymentsData.billingProfile?.sellerName || "",
      sellerEmail: paymentsData.billingProfile?.sellerEmail || "",
      sellerPhone: paymentsData.billingProfile?.sellerPhone || "",
      sellerTaxId: paymentsData.billingProfile?.sellerTaxId || "",
      sellerAddressLine1: paymentsData.billingProfile?.sellerAddressLine1 || "",
      sellerAddressLine2: paymentsData.billingProfile?.sellerAddressLine2 || "",
      sellerPostalCode: paymentsData.billingProfile?.sellerPostalCode || "",
      sellerCity: paymentsData.billingProfile?.sellerCity || "",
      sellerCountry: paymentsData.billingProfile?.sellerCountry || "",
      bankAccountHolder: paymentsData.billingProfile?.bankAccountHolder || "",
      bankName: paymentsData.billingProfile?.bankName || "",
      bankAccountNumber: paymentsData.billingProfile?.bankAccountNumber || "",
      bankSwift: paymentsData.billingProfile?.bankSwift || "",
      invoicePrefix: paymentsData.billingProfile?.invoicePrefix || "FV",
      paymentInstructions: paymentsData.billingProfile?.paymentInstructions || "",
      defaultPaymentTermDays: String(paymentsData.billingProfile?.defaultPaymentTermDays || 14),
    });

    setCustomer({
      name: paymentsData.customer?.name || "",
      companyName: paymentsData.customer?.companyName || "",
      email: paymentsData.customer?.email || "",
      phone: paymentsData.customer?.phone || "",
      taxId: paymentsData.customer?.taxId || "",
      addressLine1: paymentsData.customer?.addressLine1 || "",
      addressLine2: paymentsData.customer?.addressLine2 || "",
      postalCode: paymentsData.customer?.postalCode || "",
      city: paymentsData.customer?.city || "",
      country: paymentsData.customer?.country || "",
    });
  }, [paymentsData]);

  const installments = useMemo(
    () => ((paymentsData?.installments as Installment[] | undefined) ?? []),
    [paymentsData],
  );
  const draftInstallments = useMemo(
    () => installments.filter((installment) => installment.status === "draft"),
    [installments],
  );
  const issuedInstallments = useMemo(
    () => installments.filter((installment) => installment.status !== "draft"),
    [installments],
  );
  const projectClientDefaults = buildCustomerFromProject(project);
  const hasProjectClientDefaults = Boolean(
    projectClientDefaults.name || projectClientDefaults.addressLine1,
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

  const saveBillingDetails = async () => {
    setIsSavingBillingProfile(true);
    try {
      await updateTeamSettings({
        teamId: project.teamId,
        billingProfile: {
          ...billingProfile,
          defaultPaymentTermDays: Number.parseInt(billingProfile.defaultPaymentTermDays || "14", 10),
        },
      });
      toast.success("Organization billing profile updated");
    } catch (error) {
      toast.error("Could not update billing profile", {
        description: (error as Error).message,
      });
    } finally {
      setIsSavingBillingProfile(false);
    }
  };

  const saveCustomerDetails = async () => {
    setIsSavingCustomer(true);
    try {
      await updateCustomer({
        projectId: project._id,
        customer,
      });
      toast.success("Bill-to details updated");
    } catch (error) {
      toast.error("Could not update customer details", {
        description: (error as Error).message,
      });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const applyProjectClientDetails = () => {
    if (!hasProjectClientDefaults) {
      toast.error("No client details are saved in project settings yet");
      return;
    }
    setCustomer(projectClientDefaults);
    toast.success("Filled customer details from the project client data");
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

  const runInstallmentAction = async (
    installmentId: Id<"projectPayments">,
    actionName: "issue" | "send" | "download" | "paid" | "open" | "void",
  ) => {
    setBusyInstallmentId(installmentId);
    try {
      if (actionName === "issue") {
        await createInvoice({ installmentId });
        toast.success("Invoice issued");
        return;
      }

      if (actionName === "send") {
        await sendInvoiceEmail({ installmentId });
        toast.success("Invoice email sent");
        return;
      }

      if (actionName === "download") {
        const result = await downloadInvoiceUrl({ installmentId });
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }

      await setPaymentStatus({
        installmentId,
        status: actionName,
      });

      toast.success(
        actionName === "paid"
          ? "Installment marked as paid"
          : actionName === "open"
            ? "Installment reopened"
            : "Installment voided",
      );
    } catch (error) {
      toast.error("Payment action failed", {
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

  const copyReference = async (value?: string) => {
    if (!value) {
      toast.error("No payment reference available yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Payment reference copied");
    } catch {
      toast.error("Could not copy payment reference");
    }
  };

  const renderInstallmentList = (
    list: Installment[],
    emptyMessage: string,
  ) => {
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return list.map((installment) => {
      const isDraft = installment.status === "draft";
      const isBusy = busyInstallmentId === installment._id;
      const canVoid = installment.status !== "paid" && installment.status !== "void";

      return (
        <div key={installment._id} className="rounded-2xl border bg-background/60 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium">{installment.title}</h3>
                <Badge variant="outline" className={getStatusBadgeClassName(installment)}>
                  {getStatusLabel(installment)}
                </Badge>
                {installment.invoiceNumber ? (
                  <Badge variant="outline">#{installment.invoiceNumber}</Badge>
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
                {installment.sentAt ? (
                  <span>Emailed {new Date(installment.sentAt).toLocaleDateString()}</span>
                ) : null}
              </div>
              {installment.paymentReference ? (
                <p className="text-sm text-muted-foreground">
                  Transfer reference:{" "}
                  <span className="font-medium text-foreground">{installment.paymentReference}</span>
                </p>
              ) : null}
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
                    onClick={() => void runInstallmentAction(installment._id, "issue")}
                    disabled={isBusy}
                  >
                    {isBusy ? "Issuing..." : "Issue invoice"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInstallmentAction(installment._id, "send")}
                    disabled={isBusy}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Issue & email
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
                    onClick={() => void runInstallmentAction(installment._id, "download")}
                    disabled={isBusy || !installment.hasInvoicePdf}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInstallmentAction(installment._id, "send")}
                    disabled={isBusy}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyReference(installment.paymentReference)}
                    disabled={!installment.paymentReference}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy reference
                  </Button>
                  {installment.status !== "paid" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runInstallmentAction(installment._id, "paid")}
                      disabled={isBusy}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark paid
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void runInstallmentAction(installment._id, "open")}
                      disabled={isBusy}
                    >
                      Reopen
                    </Button>
                  )}
                  {canVoid ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => void runInstallmentAction(installment._id, "void")}
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
    });
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
          subtitle="Manage bank-transfer invoices, customer billing data, invoice PDFs, and manual payment reconciliation."
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

        {(!paymentsData.billingSetup?.sellerReady || !paymentsData.billingSetup?.customerReady) && (
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertTitle>Invoice setup incomplete</AlertTitle>
            <AlertDescription>
              {paymentsData.billingSetup?.missingSellerFields?.length
                ? `Seller profile is missing: ${paymentsData.billingSetup.missingSellerFields.join(", ")}. `
                : ""}
              {paymentsData.billingSetup?.missingCustomerFields?.length
                ? `Customer details are missing: ${paymentsData.billingSetup.missingCustomerFields.join(", ")}.`
                : ""}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-[var(--ui-surface-soft)] p-2 md:grid-cols-3">
            <TabsTrigger value="schedule">Installments</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="invoice-setup">Invoice setup</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            <Card className="bg-card/92">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Draft Installments
                </CardTitle>
                <Button type="button" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  New installment
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderInstallmentList(
                  draftInstallments,
                  "No draft installments yet. Create a draft and issue the invoice from the next tab when it is ready.",
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card className="bg-card/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Issued Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderInstallmentList(
                  issuedInstallments,
                  "No issued invoices yet. Issue a draft installment and it will appear here.",
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice-setup" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="bg-card/92">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Organization Billing Profile
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Seller data is shared across this organization and is also available in{" "}
                    <Link href="/organisation/settings" className="font-medium text-foreground underline underline-offset-4">
                      organization settings
                    </Link>.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Seller name</Label>
                      <Input value={billingProfile.sellerName} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tax ID / NIP</Label>
                      <Input value={billingProfile.sellerTaxId} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerTaxId: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing email</Label>
                      <Input type="email" value={billingProfile.sellerEmail} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerEmail: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={billingProfile.sellerPhone} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPhone: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 1</Label>
                      <Input value={billingProfile.sellerAddressLine1} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine1: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 2</Label>
                      <Input value={billingProfile.sellerAddressLine2} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine2: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal code</Label>
                      <Input value={billingProfile.sellerPostalCode} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPostalCode: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={billingProfile.sellerCity} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCity: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Country</Label>
                      <Input value={billingProfile.sellerCountry} onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCountry: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Account holder</Label>
                      <Input value={billingProfile.bankAccountHolder} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountHolder: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank name</Label>
                      <Input value={billingProfile.bankName} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank account number / IBAN</Label>
                      <Input value={billingProfile.bankAccountNumber} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountNumber: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>SWIFT</Label>
                      <Input value={billingProfile.bankSwift} onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankSwift: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice prefix</Label>
                      <Input value={billingProfile.invoicePrefix} onChange={(e) => setBillingProfile((prev) => ({ ...prev, invoicePrefix: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Default due days</Label>
                      <Input type="number" min="1" value={billingProfile.defaultPaymentTermDays} onChange={(e) => setBillingProfile((prev) => ({ ...prev, defaultPaymentTermDays: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Payment instructions</Label>
                      <Textarea rows={4} value={billingProfile.paymentInstructions} onChange={(e) => setBillingProfile((prev) => ({ ...prev, paymentInstructions: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={() => void saveBillingDetails()} disabled={isSavingBillingProfile}>
                      {isSavingBillingProfile ? "Saving..." : "Save billing profile"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/92">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Bill-To Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={applyProjectClientDetails}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Use project client details
                    </Button>
                    {projectClientDefaults.name ? (
                      <Badge variant="outline">{projectClientDefaults.name}</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company name</Label>
                      <Input value={customer.companyName} onChange={(e) => setCustomer((prev) => ({ ...prev, companyName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact / buyer name</Label>
                      <Input value={customer.name} onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing email</Label>
                      <Input type="email" value={customer.email} onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={customer.phone} onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Tax ID / NIP</Label>
                      <Input value={customer.taxId} onChange={(e) => setCustomer((prev) => ({ ...prev, taxId: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 1</Label>
                      <Input value={customer.addressLine1} onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine1: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 2</Label>
                      <Input value={customer.addressLine2} onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine2: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal code</Label>
                      <Input value={customer.postalCode} onChange={(e) => setCustomer((prev) => ({ ...prev, postalCode: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={customer.city} onChange={(e) => setCustomer((prev) => ({ ...prev, city: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Country</Label>
                      <Input value={customer.country} onChange={(e) => setCustomer((prev) => ({ ...prev, country: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={() => void saveCustomerDetails()} disabled={isSavingCustomer}>
                      {isSavingCustomer ? "Saving..." : "Save customer details"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingInstallment ? "Edit installment" : "New installment"}</DialogTitle>
            <DialogDescription>
              Draft installments stay internal until you issue a bank-transfer invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="installment-title">Title</Label>
              <Input
                id="installment-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Stage 1 deposit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="installment-description">Description</Label>
              <Textarea
                id="installment-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional note visible on the invoice"
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="installment-amount">Amount</Label>
                <Input
                  id="installment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveInstallment()} disabled={submittingInstallment}>
              {submittingInstallment ? "Saving..." : editingInstallment ? "Save changes" : "Create installment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectPageLayout>
  );
}
