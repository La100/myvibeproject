"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Building2, CheckCircle2, ExternalLink, Plus, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";
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
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { parseDecimalInput } from "@/lib/numberInput";
import { calculateTaxBreakdown, resolveOrganizationTaxSettings } from "@/lib/organizationTax";
import { formatCurrency } from "@/lib/utils";
import { ProjectPaymentsOverviewCards } from "./ProjectPaymentsOverviewCards";
import { ProjectPaymentsInvoiceListSections } from "./ProjectPaymentsInvoiceListSections";
import { ProjectPaymentsSetupTabContent } from "./ProjectPaymentsSetupTabContent";
import { ProjectInvoiceDraftEditor } from "./ProjectInvoiceDraftEditor";

type Installment = {
  _id: Id<"projectPayments">;
  title: string;
  description?: string;
  amount: number;
  invoiceLineItems?: InvoiceLineItem[];
  invoiceTaxSettingsSnapshot?: Partial<OrganizationTaxSettings>;
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

type InvoiceLineItem = {
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceLineItemFormState = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type OrganizationTaxSettings = {
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  priceDisplay: "net" | "gross" | "both";
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
  dueDate: string;
};

const EMPTY_FORM: InstallmentFormState = {
  invoiceNumber: "",
  dueDate: "",
};

const EMPTY_TAX_SETTINGS: OrganizationTaxSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxLabel: "Tax",
  priceDisplay: "net",
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

const parsePaymentTermDays = (value?: string | number | null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim() || "14", 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, parsed);
    }
  }

  return 14;
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
  defaultPaymentTermDays: String(parsePaymentTermDays(source?.defaultPaymentTermDays)),
});

const serializeBillingProfile = (profile: BillingProfile) => ({
  ...profile,
  defaultPaymentTermDays: parsePaymentTermDays(profile.defaultPaymentTermDays),
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

const cloneTaxSettings = (
  source?: Partial<OrganizationTaxSettings> | null,
): OrganizationTaxSettings => {
  const resolved = resolveOrganizationTaxSettings(source);
  return {
    taxEnabled: resolved.taxEnabled,
    taxRate: resolved.taxRate,
    taxLabel: resolved.taxLabel,
    priceDisplay: resolved.priceDisplay,
  };
};

const createEmptyInvoiceLineItem = (
  defaults?: Partial<InvoiceLineItemFormState>,
): InvoiceLineItemFormState => ({
  title: defaults?.title || "Interior design project",
  description: defaults?.description || "",
  quantity: defaults?.quantity || "1",
  unitPrice: defaults?.unitPrice || "",
});

const cloneInvoiceLineItems = (
  source?: InvoiceLineItem[] | null,
  legacy?: {
    title?: string;
    description?: string;
    amount?: number;
  },
): InvoiceLineItemFormState[] => {
  if (source && source.length > 0) {
    return source.map((item) =>
      createEmptyInvoiceLineItem({
        title: item.title,
        description: item.description || "",
        quantity: String(item.quantity),
        unitPrice: item.unitPrice.toFixed(2),
      }),
    );
  }

  return [
    createEmptyInvoiceLineItem({
      title: legacy?.title || "Interior design project",
      description: legacy?.description || "",
      quantity: "1",
      unitPrice:
        typeof legacy?.amount === "number" && Number.isFinite(legacy.amount)
          ? legacy.amount.toFixed(2)
          : "",
    }),
  ];
};

const buildLegacyInvoiceSummary = (lineItems: InvoiceLineItem[]) => {
  if (lineItems.length === 1) {
    return {
      title: lineItems[0].title,
      description: lineItems[0].description,
    };
  }

  const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemLabel = lineItems.length === 1 ? "line item" : "line items";

  return {
    title: `${lineItems[0].title} + ${lineItems.length - 1} more`,
    description: `${totalQuantity} units across ${lineItems.length} ${itemLabel}`,
  };
};

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
  const [editorLineItems, setEditorLineItems] = useState<InvoiceLineItemFormState[]>(
    cloneInvoiceLineItems(),
  );
  const [editorTaxSettings, setEditorTaxSettings] = useState<OrganizationTaxSettings>(EMPTY_TAX_SETTINGS);
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
  const organizationTaxSettings = useMemo(
    () => cloneTaxSettings(paymentsData?.organizationTaxSettings),
    [paymentsData?.organizationTaxSettings],
  );
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
  const normalizedEditorLineItems = useMemo(
    () =>
      editorLineItems
        .map((item) => {
          const title = item.title.trim();
          const quantity = parseDecimalInput(item.quantity);
          const unitPrice = parseDecimalInput(item.unitPrice);
          return {
            title,
            description: item.description.trim() || undefined,
            quantity,
            unitPrice,
            isValid:
              Boolean(title) &&
              Number.isFinite(quantity) &&
              quantity > 0 &&
              Number.isFinite(unitPrice) &&
              unitPrice >= 0,
          };
        })
        .filter((item) => item.title || item.description || item.quantity || item.unitPrice),
    [editorLineItems],
  );
  const editorSubtotalValue = useMemo(
    () =>
      normalizedEditorLineItems.reduce((sum, item) => {
        if (!item.isValid) return sum;
        return sum + item.quantity * item.unitPrice;
      }, 0),
    [normalizedEditorLineItems],
  );
  const editorTaxBreakdown = useMemo(
    () => calculateTaxBreakdown(editorSubtotalValue, editorTaxSettings),
    [editorSubtotalValue, editorTaxSettings],
  );
  const editorTotalLabel = formatCurrency(editorTaxBreakdown.gross, activeCurrency);
  const issueDateLabel = new Date(editingInstallment?.invoiceIssuedAt || Date.now()).toLocaleDateString();
  const isCreateMode = !editingInstallment;

  const openCreateDialog = () => {
    setEditingInstallment(null);
    setForm({
      ...EMPTY_FORM,
      dueDate: getDateInputWithOffsetDays(defaultPaymentTermDays),
    });
    setEditorBillingProfile(cloneBillingProfile(billingProfile));
    setEditorCustomer(cloneCustomerDetails(customer));
    setEditorLineItems(cloneInvoiceLineItems());
    setEditorTaxSettings(cloneTaxSettings(organizationTaxSettings));
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (installment: Installment) => {
    setEditingInstallment(installment);
    setForm({
      invoiceNumber: installment.invoiceNumber || "",
      dueDate: formatDateInput(installment.dueDate),
    });
    setEditorBillingProfile(cloneBillingProfile(installment.invoiceSellerSnapshot || billingProfile));
    setEditorCustomer(cloneCustomerDetails(installment.invoiceCustomerSnapshot || customer));
    setEditorLineItems(
      cloneInvoiceLineItems(installment.invoiceLineItems, {
        title: installment.title,
        description: installment.description,
        amount: installment.amount,
      }),
    );
    setEditorTaxSettings(
      cloneTaxSettings(installment.invoiceTaxSettingsSnapshot || organizationTaxSettings),
    );
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setDialogMode("create");
    setEditingInstallment(null);
    setEditorBillingProfile(EMPTY_BILLING_PROFILE);
    setEditorCustomer(EMPTY_CUSTOMER);
    setEditorLineItems(cloneInvoiceLineItems());
    setEditorTaxSettings(EMPTY_TAX_SETTINGS);
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
        description: toUserFacingErrorMessage(error),
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
        baseUrl: window.location.origin,
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("Could not open Stripe Connect onboarding", {
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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

  const updateEditorLineItem = (
    index: number,
    field: keyof InvoiceLineItemFormState,
    value: string,
  ) => {
    setEditorLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addEditorLineItem = () => {
    setEditorLineItems((current) => [...current, createEmptyInvoiceLineItem()]);
  };

  const removeEditorLineItem = (index: number) => {
    setEditorLineItems((current) =>
      current.length === 1
        ? [createEmptyInvoiceLineItem()]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const saveInstallment = async () => {
    const parsedLineItems = normalizedEditorLineItems.filter((item) => item.title || item.description);
    if (parsedLineItems.length === 0) {
      toast.error("Add at least one invoice line item");
      return;
    }

    if (parsedLineItems.some((item) => !item.isValid)) {
      toast.error("Each line item needs a title, quantity, and unit price");
      return;
    }

    const invoiceLineItems: InvoiceLineItem[] = parsedLineItems.map((item) => ({
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    const legacySummary = buildLegacyInvoiceSummary(invoiceLineItems);
    const totalAmount = editorTaxBreakdown.gross;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      toast.error("Enter at least one valid invoice amount");
      return;
    }

    setSubmittingInstallment(true);
    try {
      if (editingInstallment) {
        if (editingInstallment.status === "draft") {
          await updatePayment({
            installmentId: editingInstallment._id,
            title: legacySummary.title,
            description: legacySummary.description,
            amount: totalAmount,
            invoiceLineItems,
            invoiceTaxSettingsSnapshot: editorTaxSettings,
            dueDate: parseDateInput(form.dueDate) ?? null,
            invoiceSellerSnapshot: serializeBillingProfile(editorBillingProfile),
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
            title: legacySummary.title,
            description: legacySummary.description,
            amount: totalAmount,
            invoiceLineItems,
            invoiceTaxSettingsSnapshot: editorTaxSettings,
            dueDate: parseDateInput(form.dueDate) ?? null,
            invoiceNumber: nextInvoiceNumber,
            invoiceSellerSnapshot: serializeBillingProfile(editorBillingProfile),
            invoiceCustomerSnapshot: editorCustomer,
          });
        }
        toast.success("Invoice updated");
      } else {
        await createPayment({
          projectId: project._id,
          title: legacySummary.title,
          description: legacySummary.description,
          amount: totalAmount,
          invoiceLineItems,
          invoiceTaxSettingsSnapshot: editorTaxSettings,
          dueDate: parseDateInput(form.dueDate) ?? null,
          invoiceSellerSnapshot: serializeBillingProfile(editorBillingProfile),
          invoiceCustomerSnapshot: editorCustomer,
        });
        toast.success("Invoice created");
      }
      resetDialog();
    } catch (error) {
      toast.error("Could not save invoice", {
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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
        description: toUserFacingErrorMessage(error),
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
            <ProjectInvoiceDraftEditor
              isCreateMode={isCreateMode}
              isIssuedInvoiceEdit={isIssuedInvoiceEdit}
              invoiceSetupReady={invoiceSetupReady}
              paymentRouteLabel={paymentRouteLabel}
              issueDateLabel={issueDateLabel}
              activeCurrency={activeCurrency}
              form={form}
              setForm={setForm}
              editorBillingProfile={editorBillingProfile}
              setEditorBillingProfile={setEditorBillingProfile}
              editorCustomer={editorCustomer}
              setEditorCustomer={setEditorCustomer}
              editorLineItems={editorLineItems}
              addEditorLineItem={addEditorLineItem}
              removeEditorLineItem={removeEditorLineItem}
              updateEditorLineItem={updateEditorLineItem}
              editorTaxSettings={editorTaxSettings}
              editorTaxBreakdown={editorTaxBreakdown}
              editorTotalLabel={editorTotalLabel}
              onApplyProjectClientDetailsToEditor={applyProjectClientDetailsToEditor}
            />
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
          actions={
            <Button type="button" onClick={openCreateDialog}>
              <Plus data-icon="inline-start" />
              New invoice
            </Button>
          }
        />

        <ProjectPaymentsOverviewCards
          currency={activeCurrency}
          scheduledTotal={paymentsData.totals.scheduled || 0}
          collectedTotal={paymentsData.totals.paid || 0}
          outstandingTotal={paymentsData.totals.outstanding || 0}
          overdueCount={paymentsData.totals.overdueCount || 0}
        />

        {(!paymentsData.billingSetup?.sellerReady || !paymentsData.billingSetup?.customerReady) && (
          <Alert className="border-border/70 bg-card">
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
          <Alert className="border-border/70 bg-card">
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

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "schedule" | "invoices" | "invoice-setup")}
          className="w-full gap-6"
        >
          <TabsList className="grid h-auto w-full grid-cols-1 gap-3 border-0 bg-transparent p-0 shadow-none md:grid-cols-3">
            <TabsTrigger
              value="schedule"
              className="h-auto w-full flex-none justify-start rounded-[1.75rem] border border-border/70 bg-card px-5 py-4 text-left text-muted-foreground shadow-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_30px_-18px_rgba(70,52,37,0.28)]"
            >
              <span className="flex w-full flex-wrap items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold leading-tight">Draft invoices</span>
                  <span className="mt-1 block text-[13px] leading-[1.45] text-muted-foreground">
                    Create and prepare invoices before issuing
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0 border-border/70 bg-secondary/70 px-3 py-1 text-xs font-semibold">
                  {draftInstallments.length}
                </Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="h-auto w-full flex-none justify-start rounded-[1.75rem] border border-border/70 bg-card px-5 py-4 text-left text-muted-foreground shadow-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_30px_-18px_rgba(70,52,37,0.28)]"
            >
              <span className="flex w-full flex-wrap items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold leading-tight">Issued invoices</span>
                  <span className="mt-1 block text-[13px] leading-[1.45] text-muted-foreground">
                    Sent invoices and payment history
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0 border-border/70 bg-secondary/70 px-3 py-1 text-xs font-semibold">
                  {issuedInstallments.length}
                </Badge>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="invoice-setup"
              className="h-auto w-full flex-none justify-start rounded-[1.75rem] border border-border/70 bg-card px-5 py-4 text-left text-muted-foreground shadow-none transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_30px_-18px_rgba(70,52,37,0.28)]"
            >
              <span className="flex w-full flex-wrap items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold leading-tight">Invoice setup</span>
                  <span className="mt-1 block text-[13px] leading-[1.45] text-muted-foreground">
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
          <ProjectPaymentsInvoiceListSections
            draftInstallments={draftInstallments}
            issuedInstallments={issuedInstallments}
            busyInstallmentId={busyInstallmentId}
            onNewInvoice={openCreateDialog}
            onOpenEditDialog={openEditDialog}
            onOpenPreview={openInvoicePdfPreview}
            onRunAction={runInstallmentAction}
            onRemoveDraft={removeDraftInstallment}
            onCopyPaymentLink={copyPaymentLink}
            onCopyReference={copyReference}
          />

          <ProjectPaymentsSetupTabContent
            billingProfile={billingProfile}
            customer={customer}
            invoiceFieldRequirements={invoiceFieldRequirements}
            hiddenSellerFieldOptions={hiddenSellerFieldOptions}
            hiddenCustomerFieldOptions={hiddenCustomerFieldOptions}
            projectClientDefaults={projectClientDefaults}
            paymentRouteStatus={paymentRouteStatus}
            isSavingBillingProfile={isSavingBillingProfile}
            isSavingCustomer={isSavingCustomer}
            isSavingVisibility={isSavingVisibility}
            onApplyProjectClientDetails={applyProjectClientDetails}
            onSaveBillingDetails={() => void saveBillingDetails()}
            onSaveCustomerDetails={() => void saveCustomerDetails()}
            onSetSellerFieldVisibility={(key, visible) => void setSellerFieldVisibility(key, visible)}
            onSetCustomerFieldVisibility={(key, visible) => void setCustomerFieldVisibility(key, visible)}
            onBillingProfileChange={(field, value) =>
              setBillingProfile((prev) => ({ ...prev, [field]: value }))
            }
            onCustomerChange={(field, value) => setCustomer((prev) => ({ ...prev, [field]: value }))}
          />
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
