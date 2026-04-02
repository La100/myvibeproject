"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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

function PaymentField({
  label,
  htmlFor,
  description,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      <FieldContent>
        {children}
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
    </Field>
  );
}

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
  const invoiceSetupReady = Boolean(
    paymentsData?.billingSetup?.sellerReady && paymentsData?.billingSetup?.customerReady,
  );
  const invoiceSetupIssues =
    (paymentsData?.billingSetup?.missingSellerFields?.length ?? 0) +
    (paymentsData?.billingSetup?.missingCustomerFields?.length ?? 0);
  const activeCurrency = paymentsData?.currency || project.currency || "PLN";
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
      toast.error("Enter a valid invoice amount");
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
        toast.success("Invoice updated");
      } else {
        await createPayment({
          projectId: project._id,
          title: form.title,
          description: form.description,
          amount: parsedAmount,
          dueDate: parseDateInput(form.dueDate) ?? null,
        });
        toast.success("Invoice created");
      }
      resetDialog();
    } catch (error) {
      toast.error("Could not save invoice", {
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
          ? "Invoice marked as paid"
          : actionName === "open"
            ? "Invoice reopened"
            : "Invoice voided",
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
      toast.success("Draft invoice deleted");
    } catch (error) {
      toast.error("Could not delete invoice", {
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
        <div key={installment._id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium">{installment.title}</h3>
                <Badge variant={getStatusBadgeVariant(installment)}>
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
                    <Mail data-icon="inline-start" />
                    Issue & email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeDraftInstallment(installment._id)}
                    disabled={isBusy}
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
                    onClick={() => void runInstallmentAction(installment._id, "download")}
                    disabled={isBusy || !installment.hasInvoicePdf}
                  >
                    <Download data-icon="inline-start" />
                    Download PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInstallmentAction(installment._id, "send")}
                    disabled={isBusy}
                  >
                    <Mail data-icon="inline-start" />
                    Send email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyReference(installment.paymentReference)}
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
                      onClick={() => void runInstallmentAction(installment._id, "paid")}
                      disabled={isBusy}
                    >
                      <CheckCircle2 data-icon="inline-start" />
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
      <div className="flex flex-col gap-8">
        <ProjectPageHeader
          title="Payments"
          icon={<Wallet />}
          subtitle="Manage bank-transfer invoices, customer billing data, invoice PDFs, and manual payment reconciliation."
          actions={
            <Button type="button" onClick={openCreateDialog}>
              <Plus data-icon="inline-start" />
              New invoice
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(paymentsData.totals.scheduled || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(paymentsData.totals.paid || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(paymentsData.totals.outstanding || 0, paymentsData.currency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
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

        <Tabs defaultValue="schedule" className="w-full gap-6">
          <TabsList className="grid h-auto w-full grid-cols-1 md:grid-cols-3">
            <TabsTrigger value="schedule" className="justify-start px-4 py-3 text-left">
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Draft invoices</span>
                  <span className="block text-xs text-muted-foreground">
                    Create and prepare invoices before issuing
                  </span>
                </span>
                <Badge variant="outline">{draftInstallments.length}</Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="justify-start px-4 py-3 text-left">
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Issued invoices</span>
                  <span className="block text-xs text-muted-foreground">
                    Sent invoices and payment history
                  </span>
                </span>
                <Badge variant="outline">{issuedInstallments.length}</Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger value="invoice-setup" className="justify-start px-4 py-3 text-left">
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Invoice setup</span>
                  <span className="block text-xs text-muted-foreground">
                    Seller profile and bill-to details
                  </span>
                </span>
                <Badge variant={invoiceSetupReady ? "default" : "destructive"}>
                  {invoiceSetupReady ? (
                    <>
                      <CheckCircle2 />
                      Ready
                    </>
                  ) : (
                    `${invoiceSetupIssues} missing`
                  )}
                </Badge>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="flex flex-col gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Wallet />
                  Draft invoices
                </CardTitle>
                <Button type="button" onClick={openCreateDialog}>
                  <Plus data-icon="inline-start" />
                  New invoice
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {renderInstallmentList(
                  draftInstallments,
                  "No draft invoices yet. Create one here and issue it from the next tab when it is ready.",
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote />
                  Issued Invoices
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {renderInstallmentList(
                  issuedInstallments,
                  "No issued invoices yet. Issue a draft invoice and it will appear here.",
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice-setup" className="flex flex-col gap-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote />
                    Organization Billing Profile
                  </CardTitle>
                  <CardDescription>
                    Seller data is shared across this organization and is also available in{" "}
                    <Link
                      href="/organisation/settings#organization-billing-profile"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      organization settings
                    </Link>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    <PaymentField label="Seller name" htmlFor="seller-name">
                      <Input
                        id="seller-name"
                        value={billingProfile.sellerName}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerName: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Tax ID / NIP" htmlFor="seller-tax-id">
                      <Input
                        id="seller-tax-id"
                        value={billingProfile.sellerTaxId}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerTaxId: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Billing email" htmlFor="seller-email">
                      <Input
                        id="seller-email"
                        type="email"
                        value={billingProfile.sellerEmail}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerEmail: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Phone" htmlFor="seller-phone">
                      <Input
                        id="seller-phone"
                        value={billingProfile.sellerPhone}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPhone: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Address line 1" htmlFor="seller-address-1" className="md:col-span-2">
                      <Input
                        id="seller-address-1"
                        value={billingProfile.sellerAddressLine1}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine1: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Address line 2" htmlFor="seller-address-2" className="md:col-span-2">
                      <Input
                        id="seller-address-2"
                        value={billingProfile.sellerAddressLine2}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine2: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Postal code" htmlFor="seller-postal-code">
                      <Input
                        id="seller-postal-code"
                        value={billingProfile.sellerPostalCode}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPostalCode: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="City" htmlFor="seller-city">
                      <Input
                        id="seller-city"
                        value={billingProfile.sellerCity}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCity: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Country" htmlFor="seller-country" className="md:col-span-2">
                      <Input
                        id="seller-country"
                        value={billingProfile.sellerCountry}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCountry: e.target.value }))}
                      />
                    </PaymentField>
                  </FieldGroup>

                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    <PaymentField label="Account holder" htmlFor="bank-account-holder">
                      <Input
                        id="bank-account-holder"
                        value={billingProfile.bankAccountHolder}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountHolder: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Bank name" htmlFor="bank-name">
                      <Input
                        id="bank-name"
                        value={billingProfile.bankName}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankName: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Bank account number / IBAN" htmlFor="bank-account-number">
                      <Input
                        id="bank-account-number"
                        value={billingProfile.bankAccountNumber}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="SWIFT" htmlFor="bank-swift">
                      <Input
                        id="bank-swift"
                        value={billingProfile.bankSwift}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankSwift: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Invoice prefix" htmlFor="invoice-prefix">
                      <Input
                        id="invoice-prefix"
                        value={billingProfile.invoicePrefix}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, invoicePrefix: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Default due days" htmlFor="default-due-days">
                      <Input
                        id="default-due-days"
                        type="number"
                        min="1"
                        value={billingProfile.defaultPaymentTermDays}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, defaultPaymentTermDays: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Payment instructions" htmlFor="payment-instructions" className="md:col-span-2">
                      <Textarea
                        id="payment-instructions"
                        rows={4}
                        value={billingProfile.paymentInstructions}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
                      />
                    </PaymentField>
                  </FieldGroup>

                  <div className="flex justify-end">
                    <Button type="button" onClick={() => void saveBillingDetails()} disabled={isSavingBillingProfile}>
                      {isSavingBillingProfile ? "Saving..." : "Save billing profile"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 />
                    Bill-To Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={applyProjectClientDetails}>
                      <RefreshCw data-icon="inline-start" />
                      Use project client details
                    </Button>
                    {projectClientDefaults.name ? (
                      <Badge variant="outline">{projectClientDefaults.name}</Badge>
                    ) : null}
                  </div>

                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    <PaymentField label="Company name" htmlFor="customer-company-name">
                      <Input
                        id="customer-company-name"
                        value={customer.companyName}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Contact / buyer name" htmlFor="customer-name">
                      <Input
                        id="customer-name"
                        value={customer.name}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Billing email" htmlFor="customer-email">
                      <Input
                        id="customer-email"
                        type="email"
                        value={customer.email}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Phone" htmlFor="customer-phone">
                      <Input
                        id="customer-phone"
                        value={customer.phone}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Tax ID / NIP" htmlFor="customer-tax-id" className="md:col-span-2">
                      <Input
                        id="customer-tax-id"
                        value={customer.taxId}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, taxId: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Address line 1" htmlFor="customer-address-1" className="md:col-span-2">
                      <Input
                        id="customer-address-1"
                        value={customer.addressLine1}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Address line 2" htmlFor="customer-address-2" className="md:col-span-2">
                      <Input
                        id="customer-address-2"
                        value={customer.addressLine2}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine2: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Postal code" htmlFor="customer-postal-code">
                      <Input
                        id="customer-postal-code"
                        value={customer.postalCode}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, postalCode: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="City" htmlFor="customer-city">
                      <Input
                        id="customer-city"
                        value={customer.city}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </PaymentField>
                    <PaymentField label="Country" htmlFor="customer-country" className="md:col-span-2">
                      <Input
                        id="customer-country"
                        value={customer.country}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, country: e.target.value }))}
                      />
                    </PaymentField>
                  </FieldGroup>

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
            <DialogTitle>{editingInstallment ? "Edit invoice" : "New invoice"}</DialogTitle>
            <DialogDescription>
              Draft invoices stay internal until you issue a bank-transfer invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <PaymentField label="Title" htmlFor="installment-title">
              <Input
                id="installment-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Stage 1 deposit"
              />
            </PaymentField>

            <PaymentField label="Description" htmlFor="installment-description">
              <Textarea
                id="installment-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional note visible on the invoice"
                rows={4}
              />
            </PaymentField>

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <PaymentField label="Amount" htmlFor="installment-amount">
                <InputGroup>
                  <InputGroupInput
                    id="installment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0.00"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{activeCurrency}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </PaymentField>

              <PaymentField label="Due date" htmlFor="installment-due-date">
                <Input
                  id="installment-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </PaymentField>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveInstallment()} disabled={submittingInstallment}>
              {submittingInstallment ? "Saving..." : editingInstallment ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectPageLayout>
  );
}
