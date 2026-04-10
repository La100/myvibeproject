"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/components/providers/ProjectProvider";
import { ProjectPageHeader } from "@/components/project/ProjectPageHeader";
import { ProjectPageLayout } from "@/components/project/ProjectPageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PDFViewer from "@/components/ui/PDFViewer";
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
  invoiceIssuedAt?: number;
  invoiceNumber?: string;
  paymentReference?: string;
  hasInvoicePdf?: boolean;
  stripeInvoiceId?: string;
  stripeHostedInvoiceUrl?: string;
  invoiceSellerSnapshot?: Partial<BillingProfile>;
  invoiceCustomerSnapshot?: Partial<CustomerDetails>;
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

type InvoiceFieldRequirements = {
  seller: {
    sellerName: boolean;
    sellerEmail: boolean;
    sellerPhone: boolean;
    sellerTaxId: boolean;
    sellerAddressLine1: boolean;
    sellerAddressLine2: boolean;
    sellerPostalCode: boolean;
    sellerCity: boolean;
    sellerCountry: boolean;
    bankAccountHolder: boolean;
    bankName: boolean;
    bankAccountNumber: boolean;
    bankSwift: boolean;
    invoicePrefix: boolean;
    paymentInstructions: boolean;
    defaultPaymentTermDays: boolean;
  };
  customer: {
    nameOrCompany: boolean;
    name: boolean;
    companyName: boolean;
    email: boolean;
    phone: boolean;
    taxId: boolean;
    addressLine1: boolean;
    addressLine2: boolean;
    postalCode: boolean;
    city: boolean;
    country: boolean;
  };
};

type InstallmentFormState = {
  invoiceNumber: string;
  title: string;
  description: string;
  amount: string;
  dueDate: string;
};

const EMPTY_FORM: InstallmentFormState = {
  invoiceNumber: "",
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
  invoicePrefix: "INV",
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

const cloneBillingProfile = (source?: Partial<BillingProfile> | null): BillingProfile => ({
  sellerName: source?.sellerName || "",
  sellerEmail: source?.sellerEmail || "",
  sellerPhone: source?.sellerPhone || "",
  sellerTaxId: source?.sellerTaxId || "",
  sellerAddressLine1: source?.sellerAddressLine1 || "",
  sellerAddressLine2: source?.sellerAddressLine2 || "",
  sellerPostalCode: source?.sellerPostalCode || "",
  sellerCity: source?.sellerCity || "",
  sellerCountry: source?.sellerCountry || "",
  bankAccountHolder: source?.bankAccountHolder || "",
  bankName: source?.bankName || "",
  bankAccountNumber: source?.bankAccountNumber || "",
  bankSwift: source?.bankSwift || "",
  invoicePrefix: source?.invoicePrefix || "INV",
  paymentInstructions: source?.paymentInstructions || "",
  defaultPaymentTermDays: source?.defaultPaymentTermDays || "14",
});

const cloneCustomerDetails = (source?: Partial<CustomerDetails> | null): CustomerDetails => ({
  name: source?.name || "",
  companyName: source?.companyName || "",
  email: source?.email || "",
  phone: source?.phone || "",
  taxId: source?.taxId || "",
  addressLine1: source?.addressLine1 || "",
  addressLine2: source?.addressLine2 || "",
  postalCode: source?.postalCode || "",
  city: source?.city || "",
  country: source?.country || "",
});

const DEFAULT_INVOICE_FIELD_REQUIREMENTS: InvoiceFieldRequirements = {
  seller: {
    sellerName: true,
    sellerEmail: true,
    sellerPhone: true,
    sellerTaxId: true,
    sellerAddressLine1: true,
    sellerAddressLine2: true,
    sellerPostalCode: true,
    sellerCity: true,
    sellerCountry: false,
    bankAccountHolder: false,
    bankName: false,
    bankAccountNumber: true,
    bankSwift: false,
    invoicePrefix: false,
    paymentInstructions: false,
    defaultPaymentTermDays: false,
  },
  customer: {
    nameOrCompany: false,
    name: true,
    companyName: true,
    email: true,
    phone: true,
    taxId: true,
    addressLine1: true,
    addressLine2: true,
    postalCode: true,
    city: true,
    country: false,
  },
};

const SELLER_REQUIRED_FIELD_OPTIONS: Array<{
  key: keyof InvoiceFieldRequirements["seller"];
  label: string;
}> = [
  { key: "sellerName", label: "Seller name" },
  { key: "sellerEmail", label: "Billing email" },
  { key: "sellerPhone", label: "Phone" },
  { key: "sellerTaxId", label: "Tax ID / VAT ID" },
  { key: "sellerAddressLine1", label: "Address line 1" },
  { key: "sellerAddressLine2", label: "Address line 2" },
  { key: "sellerPostalCode", label: "Postal code" },
  { key: "sellerCity", label: "City" },
  { key: "sellerCountry", label: "Country" },
  { key: "bankAccountHolder", label: "Account holder" },
  { key: "bankName", label: "Bank name" },
  { key: "bankAccountNumber", label: "Bank account number / IBAN" },
  { key: "bankSwift", label: "SWIFT" },
  { key: "defaultPaymentTermDays", label: "Default due days" },
  { key: "paymentInstructions", label: "Payment instructions" },
];

const CUSTOMER_REQUIRED_FIELD_OPTIONS: Array<{
  key: keyof InvoiceFieldRequirements["customer"];
  label: string;
}> = [
  { key: "companyName", label: "Company name" },
  { key: "name", label: "Contact / buyer name" },
  { key: "email", label: "Billing email" },
  { key: "phone", label: "Phone" },
  { key: "taxId", label: "Tax ID / VAT ID" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "postalCode", label: "Postal code" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
];

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

const getDateInputWithOffsetDays = (daysOffset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  return formatDateInput(date.getTime());
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
  action,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field className={className}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {action}
      </div>
      <FieldContent>
        {children}
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
    </Field>
  );
}

function renderHideFieldAction(
  label: string,
  onClick: () => void,
  disabled: boolean,
) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="size-5 rounded-full text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Hide ${label}`}
      title={`Hide ${label}`}
    >
      <X className="h-3 w-3" />
    </Button>
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
  const updateIssuedInvoice = useMutation(apiAny.projectPayments.updateIssuedProjectPaymentInvoice);
  const deletePayment = useMutation(apiAny.projectPayments.deleteProjectPayment);
  const setPaymentStatus = useMutation(apiAny.projectPayments.setProjectPaymentManualStatus);

  const createInvoice = useAction(apiAny.projectPaymentActions.createProjectPaymentInvoice);
  const createStripePaymentLink = useAction(apiAny.projectPaymentActions.createProjectPaymentStripeLink);
  const sendInvoiceEmail = useAction(apiAny.projectPaymentActions.sendProjectPaymentInvoiceEmail);
  const downloadInvoiceUrl = useAction(apiAny.projectPaymentActions.getProjectPaymentInvoiceDownloadUrl);
  const previewInvoice = useAction(apiAny.projectPaymentActions.previewProjectPaymentInvoice);
  const createOrResumeStripeConnectOnboarding = useAction(
    apiAny.stripeConnectActions.createOrResumeStripeConnectOnboarding,
  );
  const refreshStripeConnectAccount = useAction(apiAny.stripeConnectActions.refreshStripeConnectAccount);

  const [billingProfile, setBillingProfile] = useState<BillingProfile>(EMPTY_BILLING_PROFILE);
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [invoiceFieldRequirements, setInvoiceFieldRequirements] = useState<InvoiceFieldRequirements>(
    DEFAULT_INVOICE_FIELD_REQUIREMENTS,
  );
  const [isSavingBillingProfile, setIsSavingBillingProfile] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editorBillingProfile, setEditorBillingProfile] = useState<BillingProfile>(EMPTY_BILLING_PROFILE);
  const [editorCustomer, setEditorCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [invoicePreviewName, setInvoicePreviewName] = useState("invoice.pdf");
  const [invoicePreviewTitle, setInvoicePreviewTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"schedule" | "invoices" | "invoice-setup">("schedule");
  const [invoiceGuardDialogOpen, setInvoiceGuardDialogOpen] = useState(false);
  const [invoiceGuardAction, setInvoiceGuardAction] = useState<"issue" | "send" | "link">("issue");
  const [invoiceGuardReason, setInvoiceGuardReason] = useState<"setup" | "email">("setup");
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [form, setForm] = useState<InstallmentFormState>(EMPTY_FORM);
  const [submittingInstallment, setSubmittingInstallment] = useState(false);
  const [busyInstallmentId, setBusyInstallmentId] = useState<Id<"projectPayments"> | null>(null);
  const [isStripeConnectBusy, setIsStripeConnectBusy] = useState(false);
  const [isStripeConnectRefreshBusy, setIsStripeConnectRefreshBusy] = useState(false);

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
      invoicePrefix: paymentsData.billingProfile?.invoicePrefix || "INV",
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

    setInvoiceFieldRequirements({
      seller: {
        ...DEFAULT_INVOICE_FIELD_REQUIREMENTS.seller,
        ...(paymentsData.invoiceFieldRequirements?.seller || {}),
        bankAccountHolder: false,
        invoicePrefix: false,
      },
      customer: {
        ...DEFAULT_INVOICE_FIELD_REQUIREMENTS.customer,
        ...(paymentsData.invoiceFieldRequirements?.customer || {}),
      },
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
  const missingSellerFields = paymentsData?.billingSetup?.missingSellerFields ?? [];
  const missingCustomerFields = paymentsData?.billingSetup?.missingCustomerFields ?? [];
  const canEmailInvoices = Boolean(paymentsData?.billingSetup?.canEmailInvoices);
  const stripeConnect = paymentsData?.stripeConnect;
  const stripeConnectOnboardingComplete = Boolean(stripeConnect?.onboardingComplete);
  const stripeConnectNeedsSetup = !stripeConnectOnboardingComplete;
  const paymentRouteMissingLabel = "bank account number or Stripe payments";
  const paymentRouteReady = !missingSellerFields.includes(paymentRouteMissingLabel);
  const paymentRouteStatus: "stripe" | "bank" | "missing" = stripeConnectOnboardingComplete
    ? "stripe"
    : paymentRouteReady
      ? "bank"
      : "missing";
  const hiddenSellerFieldOptions = SELLER_REQUIRED_FIELD_OPTIONS.filter(
    (option) => !invoiceFieldRequirements.seller[option.key],
  );
  const hiddenCustomerFieldOptions = CUSTOMER_REQUIRED_FIELD_OPTIONS.filter(
    (option) => !invoiceFieldRequirements.customer[option.key],
  );
  const activeCurrency = paymentsData?.currency || project.currency || "PLN";
  const projectClientDefaults = buildCustomerFromProject(project);
  const hasProjectClientDefaults = Boolean(
    projectClientDefaults.name || projectClientDefaults.addressLine1,
  );
  const defaultPaymentTermDays = useMemo(() => {
    const savedTerm = paymentsData?.billingProfile?.defaultPaymentTermDays;
    if (typeof savedTerm === "number" && Number.isFinite(savedTerm) && savedTerm >= 0) {
      return Math.trunc(savedTerm);
    }

    const localTerm = Number.parseInt(billingProfile.defaultPaymentTermDays || "14", 10);
    if (Number.isFinite(localTerm) && localTerm >= 0) {
      return localTerm;
    }

    return 14;
  }, [billingProfile.defaultPaymentTermDays, paymentsData?.billingProfile?.defaultPaymentTermDays]);
  const isIssuedInvoiceEdit = Boolean(editingInstallment && editingInstallment.status !== "draft");
  const paymentRouteLabel =
    paymentRouteStatus === "stripe"
      ? "Stripe payments"
      : paymentRouteStatus === "bank"
        ? "Bank transfer"
        : "Missing payment route";
  const editorAmountValue = Number.parseFloat(form.amount);
  const editorTotalLabel = Number.isFinite(editorAmountValue)
    ? formatCurrency(editorAmountValue, activeCurrency)
    : formatCurrency(0, activeCurrency);
  const issueDateLabel = new Date(editingInstallment?.invoiceIssuedAt || Date.now()).toLocaleDateString();

  const openCreateDialog = () => {
    setEditingInstallment(null);
    setForm({
      ...EMPTY_FORM,
      dueDate: getDateInputWithOffsetDays(defaultPaymentTermDays),
    });
    setEditorBillingProfile(cloneBillingProfile(billingProfile));
    setEditorCustomer(cloneCustomerDetails(customer));
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (installment: Installment) => {
    setEditingInstallment(installment);
    setForm({
      invoiceNumber: installment.invoiceNumber || "",
      title: installment.title,
      description: installment.description || "",
      amount: installment.amount.toFixed(2),
      dueDate: formatDateInput(installment.dueDate),
    });
    setEditorBillingProfile(cloneBillingProfile(installment.invoiceSellerSnapshot || billingProfile));
    setEditorCustomer(cloneCustomerDetails(installment.invoiceCustomerSnapshot || customer));
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setDialogMode("create");
    setEditingInstallment(null);
    setEditorBillingProfile(EMPTY_BILLING_PROFILE);
    setEditorCustomer(EMPTY_CUSTOMER);
    setForm(EMPTY_FORM);
  };

  const openInvoicePdfPreview = async (installment: Installment) => {
    if (!invoiceSetupReady) {
      setInvoiceGuardAction("issue");
      setInvoiceGuardReason("setup");
      setInvoiceGuardDialogOpen(true);
      return;
    }

    setBusyInstallmentId(installment._id);
    try {
      const result =
        installment.status === "draft"
          ? await previewInvoice({ installmentId: installment._id })
          : await downloadInvoiceUrl({ installmentId: installment._id });
      setInvoicePreviewUrl(result.url);
      setInvoicePreviewTitle(installment.title);
      setInvoicePreviewName(
        "fileName" in result
          ? result.fileName
          : installment.invoiceNumber
            ? `invoice-${installment.invoiceNumber}.pdf`
            : `invoice-${installment.title || "draft"}.pdf`,
      );
      setInvoicePreviewOpen(true);
    } catch (error) {
      toast.error("Could not open invoice preview", {
        description: (error as Error).message,
      });
    } finally {
      setBusyInstallmentId(null);
    }
  };

  const openStripeConnectOnboarding = async () => {
    setIsStripeConnectBusy(true);
    try {
      const returnPath = project?.slug
        ? `/organisation/projects/${project.slug}/payments`
        : "/organisation/settings";
      const result = await createOrResumeStripeConnectOnboarding({
        teamId: project.teamId,
        returnPath,
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("Could not open Stripe Connect onboarding", {
        description: (error as Error).message,
      });
    } finally {
      setIsStripeConnectBusy(false);
    }
  };

  const syncStripeConnectStatus = async () => {
    setIsStripeConnectRefreshBusy(true);
    try {
      const result = await refreshStripeConnectAccount({ teamId: project.teamId });
      if (result.onboardingComplete) {
        toast.success("Stripe Connect is ready");
      } else {
        toast.message("Stripe Connect setup is still incomplete");
      }
    } catch (error) {
      toast.error("Could not refresh Stripe Connect status", {
        description: (error as Error).message,
      });
    } finally {
      setIsStripeConnectRefreshBusy(false);
    }
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
        invoiceFieldRequirements,
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

  const persistInvoiceFieldVisibility = async (
    previous: InvoiceFieldRequirements,
    next: InvoiceFieldRequirements,
  ) => {
    setInvoiceFieldRequirements(next);
    setIsSavingVisibility(true);
    try {
      await updateTeamSettings({
        teamId: project.teamId,
        invoiceFieldRequirements: next,
      });
    } catch (error) {
      setInvoiceFieldRequirements(previous);
      toast.error("Could not update field visibility", {
        description: (error as Error).message,
      });
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const setSellerFieldVisibility = async (
    key: keyof InvoiceFieldRequirements["seller"],
    visible: boolean,
  ) => {
    if (isSavingVisibility) return;

    const previous = invoiceFieldRequirements;
    const next: InvoiceFieldRequirements = {
      ...invoiceFieldRequirements,
      seller: {
        ...invoiceFieldRequirements.seller,
        [key]: visible,
      },
    };

    await persistInvoiceFieldVisibility(previous, next);
  };

  const setCustomerFieldVisibility = async (
    key: keyof InvoiceFieldRequirements["customer"],
    visible: boolean,
  ) => {
    if (isSavingVisibility) return;

    const previous = invoiceFieldRequirements;
    const next: InvoiceFieldRequirements = {
      ...invoiceFieldRequirements,
      customer: {
        ...invoiceFieldRequirements.customer,
        [key]: visible,
      },
    };

    await persistInvoiceFieldVisibility(previous, next);
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

  const applyProjectClientDetailsToEditor = () => {
    if (!hasProjectClientDefaults) {
      toast.error("No client details are saved in project settings yet");
      return;
    }
    setEditorCustomer(cloneCustomerDetails(projectClientDefaults));
    toast.success("Filled invoice customer details from the project client data");
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
        if (editingInstallment.status === "draft") {
          await updatePayment({
            installmentId: editingInstallment._id,
            title: form.title,
            description: form.description,
            amount: parsedAmount,
            dueDate: parseDateInput(form.dueDate) ?? null,
            invoiceSellerSnapshot: editorBillingProfile,
            invoiceCustomerSnapshot: editorCustomer,
          });
        } else {
          const nextInvoiceNumber = form.invoiceNumber.trim();
          if (!nextInvoiceNumber) {
            toast.error("Enter a valid invoice number");
            return;
          }

          await updateIssuedInvoice({
            installmentId: editingInstallment._id,
            title: form.title,
            description: form.description,
            amount: parsedAmount,
            dueDate: parseDateInput(form.dueDate) ?? null,
            invoiceNumber: nextInvoiceNumber,
            invoiceSellerSnapshot: editorBillingProfile,
            invoiceCustomerSnapshot: editorCustomer,
          });
        }
        toast.success("Invoice updated");
      } else {
        await createPayment({
          projectId: project._id,
          title: form.title,
          description: form.description,
          amount: parsedAmount,
          dueDate: parseDateInput(form.dueDate) ?? null,
          invoiceSellerSnapshot: editorBillingProfile,
          invoiceCustomerSnapshot: editorCustomer,
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
    actionName: "issue" | "send" | "download" | "link" | "paid" | "open" | "void",
  ) => {
    if ((actionName === "issue" || actionName === "send" || actionName === "link") && !invoiceSetupReady) {
      setInvoiceGuardAction(actionName);
      setInvoiceGuardReason("setup");
      setInvoiceGuardDialogOpen(true);
      return;
    }

    if (actionName === "send" && !canEmailInvoices) {
      setInvoiceGuardAction("send");
      setInvoiceGuardReason("email");
      setInvoiceGuardDialogOpen(true);
      return;
    }

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

      if (actionName === "link") {
        const result = await createStripePaymentLink({ installmentId });
        if (!result.url) {
          throw new Error("Stripe payment link is not available yet");
        }
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast.success("Stripe payment link is ready");
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

  const copyPaymentLink = async (value?: string) => {
    if (!value) {
      toast.error("No payment link available yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy payment link");
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
                    onClick={() => void openInvoicePdfPreview(installment)}
                    disabled={isBusy}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInstallmentAction(installment._id, "link")}
                    disabled={isBusy}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Create payment link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInstallmentAction(installment._id, "send")}
                    disabled={isBusy}
                  >
                    <Mail data-icon="inline-start" />
                    Send via email
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
                    onClick={() => openEditDialog(installment)}
                    disabled={isBusy || (!installment.invoiceNumber && !installment.stripeInvoiceId) || Boolean(installment.stripeInvoiceId)}
                  >
                    Edit invoice
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void openInvoicePdfPreview(installment)}
                    disabled={isBusy}
                  >
                    View PDF
                  </Button>
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
                    onClick={() => void runInstallmentAction(installment._id, "link")}
                    disabled={isBusy || installment.status === "paid" || installment.status === "void" || installment.status === "uncollectible"}
                  >
                    <ExternalLink data-icon="inline-start" />
                    {installment.stripeHostedInvoiceUrl ? "Open payment link" : "Create payment link"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyPaymentLink(installment.stripeHostedInvoiceUrl)}
                    disabled={!installment.stripeHostedInvoiceUrl}
                  >
                    <Copy data-icon="inline-start" />
                    Copy payment link
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

  if (dialogOpen) {
    return (
      <ProjectPageLayout>
        <div className="flex flex-col gap-8">
          <ProjectPageHeader
            title={dialogMode === "edit" ? "Edit invoice" : "New invoice"}
            icon={<Wallet />}
            subtitle="This editor is prefilled from invoice setup and project client data, but changes here apply only to this invoice."
            actions={
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={resetDialog}>
                  <ArrowLeft data-icon="inline-start" />
                  Back to payments
                </Button>
                <Button type="button" onClick={() => void saveInstallment()} disabled={submittingInstallment}>
                  {submittingInstallment
                    ? "Saving..."
                    : editingInstallment
                      ? "Save invoice"
                      : "Create invoice"}
                </Button>
              </div>
            }
          />

          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
              <div className="flex flex-col gap-8 p-6 md:p-10">
                <div className="flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                      {editingInstallment ? "Invoice Editor" : "Invoice Draft"}
                    </p>
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight">Invoice</h2>
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Prefilled from invoice setup and project data. Edit directly in the invoice before saving.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4 md:min-w-[280px]">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={invoiceSetupReady ? "outline" : "destructive"}>
                        {invoiceSetupReady ? "Ready to issue" : "Setup incomplete"}
                      </Badge>
                      <Badge variant="secondary">{paymentRouteLabel}</Badge>
                    </div>
                    <div className="grid gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                          Invoice number
                        </p>
                        {isIssuedInvoiceEdit ? (
                          <Input
                            id="installment-invoice-number"
                            value={form.invoiceNumber}
                            onChange={(event) => setForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                            placeholder="INV/2026/0001"
                            className="mt-2"
                          />
                        ) : (
                          <p className="mt-2 text-sm text-foreground">Assigned automatically on issue</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                          Issue date
                        </p>
                        <p className="mt-2 text-sm text-foreground">{issueDateLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                          Due date
                        </p>
                        <Input
                          id="installment-due-date"
                          type="date"
                          value={form.dueDate}
                          onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">From</p>
                    </div>
                    <FieldGroup className="grid gap-4">
                      <PaymentField label="Seller name" htmlFor="editor-seller-name">
                        <Input
                          id="editor-seller-name"
                          value={editorBillingProfile.sellerName}
                          onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerName: e.target.value }))}
                        />
                      </PaymentField>
                      <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <PaymentField label="Billing email" htmlFor="editor-seller-email">
                          <Input
                            id="editor-seller-email"
                            type="email"
                            value={editorBillingProfile.sellerEmail}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerEmail: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="Phone" htmlFor="editor-seller-phone">
                          <Input
                            id="editor-seller-phone"
                            value={editorBillingProfile.sellerPhone}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerPhone: e.target.value }))}
                          />
                        </PaymentField>
                      </FieldGroup>
                      <PaymentField label="Tax ID / VAT ID" htmlFor="editor-seller-tax-id">
                        <Input
                          id="editor-seller-tax-id"
                          value={editorBillingProfile.sellerTaxId}
                          onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerTaxId: e.target.value }))}
                        />
                      </PaymentField>
                      <PaymentField label="Address line 1" htmlFor="editor-seller-address-1">
                        <Input
                          id="editor-seller-address-1"
                          value={editorBillingProfile.sellerAddressLine1}
                          onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerAddressLine1: e.target.value }))}
                        />
                      </PaymentField>
                      <PaymentField label="Address line 2" htmlFor="editor-seller-address-2">
                        <Input
                          id="editor-seller-address-2"
                          value={editorBillingProfile.sellerAddressLine2}
                          onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerAddressLine2: e.target.value }))}
                        />
                      </PaymentField>
                      <FieldGroup className="grid gap-4 md:grid-cols-3">
                        <PaymentField label="Postal code" htmlFor="editor-seller-postal-code">
                          <Input
                            id="editor-seller-postal-code"
                            value={editorBillingProfile.sellerPostalCode}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerPostalCode: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="City" htmlFor="editor-seller-city">
                          <Input
                            id="editor-seller-city"
                            value={editorBillingProfile.sellerCity}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerCity: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="Country" htmlFor="editor-seller-country">
                          <Input
                            id="editor-seller-country"
                            value={editorBillingProfile.sellerCountry}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, sellerCountry: e.target.value }))}
                          />
                        </PaymentField>
                      </FieldGroup>
                    </FieldGroup>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Bill To</p>
                      <Button type="button" variant="outline" size="sm" onClick={applyProjectClientDetailsToEditor}>
                        <RefreshCw data-icon="inline-start" />
                        Use project client details
                      </Button>
                    </div>
                    <FieldGroup className="grid gap-4">
                      <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <PaymentField label="Company name" htmlFor="editor-customer-company-name">
                          <Input
                            id="editor-customer-company-name"
                            value={editorCustomer.companyName}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, companyName: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="Contact / buyer name" htmlFor="editor-customer-name">
                          <Input
                            id="editor-customer-name"
                            value={editorCustomer.name}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        </PaymentField>
                      </FieldGroup>
                      <FieldGroup className="grid gap-4 md:grid-cols-2">
                        <PaymentField label="Billing email" htmlFor="editor-customer-email">
                          <Input
                            id="editor-customer-email"
                            type="email"
                            value={editorCustomer.email}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="Phone" htmlFor="editor-customer-phone">
                          <Input
                            id="editor-customer-phone"
                            value={editorCustomer.phone}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                          />
                        </PaymentField>
                      </FieldGroup>
                      <PaymentField label="Tax ID / VAT ID" htmlFor="editor-customer-tax-id">
                        <Input
                          id="editor-customer-tax-id"
                          value={editorCustomer.taxId}
                          onChange={(e) => setEditorCustomer((prev) => ({ ...prev, taxId: e.target.value }))}
                        />
                      </PaymentField>
                      <PaymentField label="Address line 1" htmlFor="editor-customer-address-1">
                        <Input
                          id="editor-customer-address-1"
                          value={editorCustomer.addressLine1}
                          onChange={(e) => setEditorCustomer((prev) => ({ ...prev, addressLine1: e.target.value }))}
                        />
                      </PaymentField>
                      <PaymentField label="Address line 2" htmlFor="editor-customer-address-2">
                        <Input
                          id="editor-customer-address-2"
                          value={editorCustomer.addressLine2}
                          onChange={(e) => setEditorCustomer((prev) => ({ ...prev, addressLine2: e.target.value }))}
                        />
                      </PaymentField>
                      <FieldGroup className="grid gap-4 md:grid-cols-3">
                        <PaymentField label="Postal code" htmlFor="editor-customer-postal-code">
                          <Input
                            id="editor-customer-postal-code"
                            value={editorCustomer.postalCode}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, postalCode: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="City" htmlFor="editor-customer-city">
                          <Input
                            id="editor-customer-city"
                            value={editorCustomer.city}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, city: e.target.value }))}
                          />
                        </PaymentField>
                        <PaymentField label="Country" htmlFor="editor-customer-country">
                          <Input
                            id="editor-customer-country"
                            value={editorCustomer.country}
                            onChange={(e) => setEditorCustomer((prev) => ({ ...prev, country: e.target.value }))}
                          />
                        </PaymentField>
                      </FieldGroup>
                    </FieldGroup>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-8">
                  <div className="overflow-hidden rounded-2xl border border-border/70">
                    <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 border-b border-border/60 bg-muted/25 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <span>Line Item</span>
                      <span>Amount</span>
                    </div>
                    <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-4">
                        <PaymentField label="Product / service" htmlFor="installment-title">
                          <Input
                            id="installment-title"
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Website design"
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
                      </div>
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
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-muted/15 px-4 py-4">
                      <div className="space-y-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Payment details
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            id="editor-bank-account-number"
                            value={editorBillingProfile.bankAccountNumber}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                            placeholder="Bank account number / IBAN"
                          />
                          <Input
                            id="editor-bank-swift"
                            value={editorBillingProfile.bankSwift}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, bankSwift: e.target.value }))}
                            placeholder="SWIFT"
                          />
                          <Input
                            id="editor-bank-account-holder"
                            value={editorBillingProfile.bankAccountHolder}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, bankAccountHolder: e.target.value }))}
                            placeholder="Account holder"
                          />
                          <Input
                            id="editor-bank-name"
                            value={editorBillingProfile.bankName}
                            onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, bankName: e.target.value }))}
                            placeholder="Bank name"
                          />
                        </div>
                        <Textarea
                          id="editor-payment-instructions"
                          rows={3}
                          value={editorBillingProfile.paymentInstructions}
                          onChange={(e) => setEditorBillingProfile((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
                          placeholder="Payment instructions"
                        />
                      </div>

                      <div className="min-w-[160px] rounded-2xl border border-border/70 bg-background px-5 py-4 text-right">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">{editorTotalLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProjectPageLayout>
    );
  }

  return (
    <ProjectPageLayout>
      <div className="flex flex-col gap-8">
        <ProjectPageHeader
          title="Payments"
          icon={<Wallet />}
          subtitle="Manage invoices, Stripe payment links, customer billing data, invoice PDFs, and payment reconciliation."
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

        {stripeConnectNeedsSetup ? (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Connect Stripe once for this organization</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openStripeConnectOnboarding()}
                  disabled={isStripeConnectBusy}
                >
                  <ExternalLink data-icon="inline-start" />
                  {stripeConnect?.accountId ? "Resume Stripe setup" : "Connect Stripe"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void syncStripeConnectStatus()}
                  disabled={isStripeConnectRefreshBusy}
                >
                  <RefreshCw data-icon="inline-start" />
                  Refresh status
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "schedule" | "invoices" | "invoice-setup")} className="w-full gap-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1.5 rounded-2xl border border-border/70 bg-card/90 p-2 md:grid-cols-3">
            <TabsTrigger
              value="schedule"
              className="h-auto w-full flex-none justify-start rounded-xl border border-transparent px-4 py-3 text-left data-[state=active]:border-border/70 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Draft invoices</span>
                  <span className="block text-xs text-muted-foreground">
                    Create and prepare invoices before issuing
                  </span>
                </span>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {draftInstallments.length}
                </Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="h-auto w-full flex-none justify-start rounded-xl border border-transparent px-4 py-3 text-left data-[state=active]:border-border/70 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Issued invoices</span>
                  <span className="block text-xs text-muted-foreground">
                    Sent invoices and payment history
                  </span>
                </span>
                <Badge variant="outline" className="border-border/70 bg-background/80">
                  {issuedInstallments.length}
                </Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="invoice-setup"
              className="h-auto w-full flex-none justify-start rounded-xl border border-transparent px-4 py-3 text-left data-[state=active]:border-border/70 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Invoice setup</span>
                  <span className="block text-xs text-muted-foreground">
                    Seller profile, bill-to details and payment route
                  </span>
                </span>
                <Badge
                  variant={invoiceSetupReady ? "default" : "outline"}
                  className={
                    invoiceSetupReady
                      ? undefined
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }
                >
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
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1.5">
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
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">Payment route</span>
                    <Badge
                      variant="outline"
                      className={
                        paymentRouteStatus === "missing"
                          ? "border-destructive/35 bg-destructive/12 text-destructive"
                          : paymentRouteStatus === "stripe"
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-muted/40 text-foreground"
                      }
                    >
                      {paymentRouteStatus === "stripe"
                        ? "Stripe"
                        : paymentRouteStatus === "bank"
                          ? "Bank transfer"
                          : "Missing"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  {hiddenSellerFieldOptions.length ? (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Hidden seller fields</p>
                      <div className="flex flex-wrap gap-2">
                        {hiddenSellerFieldOptions.map((option) => (
                          <Button
                            key={`show-seller-${option.key}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void setSellerFieldVisibility(option.key, true)}
                            disabled={isSavingVisibility}
                          >
                            Show {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    {invoiceFieldRequirements.seller.sellerName ? (
                    <PaymentField
                      label="Seller name"
                      htmlFor="seller-name"
                      action={renderHideFieldAction("Seller name", () => void setSellerFieldVisibility("sellerName", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-name"
                        value={billingProfile.sellerName}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerName: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerTaxId ? (
                    <PaymentField
                      label="Tax ID / VAT ID"
                      htmlFor="seller-tax-id"
                      action={renderHideFieldAction("Tax ID / VAT ID", () => void setSellerFieldVisibility("sellerTaxId", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-tax-id"
                        value={billingProfile.sellerTaxId}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerTaxId: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerEmail ? (
                    <PaymentField
                      label="Billing email"
                      htmlFor="seller-email"
                      action={renderHideFieldAction("Billing email", () => void setSellerFieldVisibility("sellerEmail", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-email"
                        type="email"
                        value={billingProfile.sellerEmail}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerEmail: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerPhone ? (
                    <PaymentField
                      label="Phone"
                      htmlFor="seller-phone"
                      action={renderHideFieldAction("Phone", () => void setSellerFieldVisibility("sellerPhone", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-phone"
                        value={billingProfile.sellerPhone}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPhone: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerAddressLine1 ? (
                    <PaymentField
                      label="Address line 1"
                      htmlFor="seller-address-1"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Address line 1", () => void setSellerFieldVisibility("sellerAddressLine1", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-address-1"
                        value={billingProfile.sellerAddressLine1}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine1: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerAddressLine2 ? (
                    <PaymentField
                      label="Address line 2"
                      htmlFor="seller-address-2"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Address line 2", () => void setSellerFieldVisibility("sellerAddressLine2", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-address-2"
                        value={billingProfile.sellerAddressLine2}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerAddressLine2: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerPostalCode ? (
                    <PaymentField
                      label="Postal code"
                      htmlFor="seller-postal-code"
                      action={renderHideFieldAction("Postal code", () => void setSellerFieldVisibility("sellerPostalCode", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-postal-code"
                        value={billingProfile.sellerPostalCode}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerPostalCode: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerCity ? (
                    <PaymentField
                      label="City"
                      htmlFor="seller-city"
                      action={renderHideFieldAction("City", () => void setSellerFieldVisibility("sellerCity", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-city"
                        value={billingProfile.sellerCity}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCity: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.sellerCountry ? (
                    <PaymentField
                      label="Country"
                      htmlFor="seller-country"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Country", () => void setSellerFieldVisibility("sellerCountry", false), isSavingVisibility)}
                    >
                      <Input
                        id="seller-country"
                        value={billingProfile.sellerCountry}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, sellerCountry: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                  </FieldGroup>

                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    {invoiceFieldRequirements.seller.bankAccountHolder ? (
                    <PaymentField
                      label="Account holder"
                      htmlFor="bank-account-holder"
                      action={renderHideFieldAction("Account holder", () => void setSellerFieldVisibility("bankAccountHolder", false), isSavingVisibility)}
                    >
                      <Input
                        id="bank-account-holder"
                        value={billingProfile.bankAccountHolder}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountHolder: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.bankName ? (
                    <PaymentField
                      label="Bank name"
                      htmlFor="bank-name"
                      action={renderHideFieldAction("Bank name", () => void setSellerFieldVisibility("bankName", false), isSavingVisibility)}
                    >
                      <Input
                        id="bank-name"
                        value={billingProfile.bankName}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankName: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.bankAccountNumber ? (
                    <PaymentField
                      label="Bank account number / IBAN"
                      htmlFor="bank-account-number"
                      action={renderHideFieldAction("Bank account number / IBAN", () => void setSellerFieldVisibility("bankAccountNumber", false), isSavingVisibility)}
                    >
                      <Input
                        id="bank-account-number"
                        value={billingProfile.bankAccountNumber}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.bankSwift ? (
                    <PaymentField
                      label="SWIFT"
                      htmlFor="bank-swift"
                      action={renderHideFieldAction("SWIFT", () => void setSellerFieldVisibility("bankSwift", false), isSavingVisibility)}
                    >
                      <Input
                        id="bank-swift"
                        value={billingProfile.bankSwift}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, bankSwift: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.defaultPaymentTermDays ? (
                    <PaymentField
                      label="Default due days"
                      htmlFor="default-due-days"
                      action={renderHideFieldAction("Default due days", () => void setSellerFieldVisibility("defaultPaymentTermDays", false), isSavingVisibility)}
                    >
                      <Input
                        id="default-due-days"
                        type="number"
                        min="1"
                        value={billingProfile.defaultPaymentTermDays}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, defaultPaymentTermDays: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.seller.paymentInstructions ? (
                    <PaymentField
                      label="Payment instructions"
                      htmlFor="payment-instructions"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Payment instructions", () => void setSellerFieldVisibility("paymentInstructions", false), isSavingVisibility)}
                    >
                      <Textarea
                        id="payment-instructions"
                        rows={4}
                        value={billingProfile.paymentInstructions}
                        onChange={(e) => setBillingProfile((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
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

                  {hiddenCustomerFieldOptions.length ? (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Hidden customer fields</p>
                      <div className="flex flex-wrap gap-2">
                        {hiddenCustomerFieldOptions.map((option) => (
                          <Button
                            key={`show-customer-${option.key}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void setCustomerFieldVisibility(option.key, true)}
                            disabled={isSavingVisibility}
                          >
                            Show {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <FieldGroup className="grid gap-4 md:grid-cols-2">
                    {invoiceFieldRequirements.customer.companyName ? (
                    <PaymentField
                      label="Company name"
                      htmlFor="customer-company-name"
                      action={renderHideFieldAction("Company name", () => void setCustomerFieldVisibility("companyName", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-company-name"
                        value={customer.companyName}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, companyName: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.name ? (
                    <PaymentField
                      label="Contact / buyer name"
                      htmlFor="customer-name"
                      action={renderHideFieldAction("Contact / buyer name", () => void setCustomerFieldVisibility("name", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-name"
                        value={customer.name}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.email ? (
                    <PaymentField
                      label="Billing email"
                      htmlFor="customer-email"
                      action={renderHideFieldAction("Billing email", () => void setCustomerFieldVisibility("email", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-email"
                        type="email"
                        value={customer.email}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.phone ? (
                    <PaymentField
                      label="Phone"
                      htmlFor="customer-phone"
                      action={renderHideFieldAction("Phone", () => void setCustomerFieldVisibility("phone", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-phone"
                        value={customer.phone}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.taxId ? (
                    <PaymentField
                      label="Tax ID / VAT ID"
                      htmlFor="customer-tax-id"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Tax ID / VAT ID", () => void setCustomerFieldVisibility("taxId", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-tax-id"
                        value={customer.taxId}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, taxId: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.addressLine1 ? (
                    <PaymentField
                      label="Address line 1"
                      htmlFor="customer-address-1"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Address line 1", () => void setCustomerFieldVisibility("addressLine1", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-address-1"
                        value={customer.addressLine1}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.addressLine2 ? (
                    <PaymentField
                      label="Address line 2"
                      htmlFor="customer-address-2"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Address line 2", () => void setCustomerFieldVisibility("addressLine2", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-address-2"
                        value={customer.addressLine2}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, addressLine2: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.postalCode ? (
                    <PaymentField
                      label="Postal code"
                      htmlFor="customer-postal-code"
                      action={renderHideFieldAction("Postal code", () => void setCustomerFieldVisibility("postalCode", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-postal-code"
                        value={customer.postalCode}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, postalCode: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.city ? (
                    <PaymentField
                      label="City"
                      htmlFor="customer-city"
                      action={renderHideFieldAction("City", () => void setCustomerFieldVisibility("city", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-city"
                        value={customer.city}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
                    {invoiceFieldRequirements.customer.country ? (
                    <PaymentField
                      label="Country"
                      htmlFor="customer-country"
                      className="md:col-span-2"
                      action={renderHideFieldAction("Country", () => void setCustomerFieldVisibility("country", false), isSavingVisibility)}
                    >
                      <Input
                        id="customer-country"
                        value={customer.country}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, country: e.target.value }))}
                      />
                    </PaymentField>
                    ) : null}
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

      <Dialog
        open={invoicePreviewOpen}
        onOpenChange={(open) => {
          setInvoicePreviewOpen(open);
          if (!open) {
            setInvoicePreviewUrl(null);
            setInvoicePreviewTitle("");
            setInvoicePreviewName("invoice.pdf");
          }
        }}
      >
        <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              Invoice PDF preview{invoicePreviewTitle ? ` - ${invoicePreviewTitle}` : ""}
            </DialogTitle>
            <DialogDescription>Generated invoice document preview.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-2">
            {invoicePreviewUrl ? (
              <div className="w-full h-full">
                <PDFViewer url={invoicePreviewUrl} fileName={invoicePreviewName} />
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceGuardDialogOpen} onOpenChange={setInvoiceGuardDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {invoiceGuardAction === "send"
                ? "Cannot send invoice yet"
                : invoiceGuardAction === "link"
                  ? "Cannot create payment link yet"
                  : "Cannot issue invoice yet"}
            </DialogTitle>
            <DialogDescription>
              {invoiceGuardReason === "setup"
                ? "Complete required billing data, including seller/customer identity and either bank account number or Stripe Connect."
                : "Add a valid customer billing email before sending the invoice."}
            </DialogDescription>
          </DialogHeader>

          {invoiceGuardReason === "setup" ? (
            <div className="space-y-3 text-sm">
              {missingSellerFields.length ? (
                <div>
                  <p className="font-medium">Missing seller profile fields:</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {missingSellerFields.map((field) => (
                      <li key={`seller-${field}`}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {missingCustomerFields.length ? (
                <div>
                  <p className="font-medium">Missing customer fields:</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {missingCustomerFields.map((field) => (
                      <li key={`customer-${field}`}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The customer must have a valid billing email in <span className="font-medium text-foreground">Bill-To Customer</span>.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInvoiceGuardDialogOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setInvoiceGuardDialogOpen(false);
                setActiveTab("invoice-setup");
              }}
            >
              Open invoice setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectPageLayout>
  );
}
