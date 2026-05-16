"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { Banknote, Building2, RefreshCw, X } from "lucide-react";

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

type VisibilityOption<T extends string> = {
  key: T;
  label: string;
};

type ProjectPaymentsSetupTabContentProps = {
  billingProfile: BillingProfile;
  customer: CustomerDetails;
  invoiceFieldRequirements: InvoiceFieldRequirements;
  hiddenSellerFieldOptions: VisibilityOption<keyof InvoiceFieldRequirements["seller"]>[];
  hiddenCustomerFieldOptions: VisibilityOption<keyof InvoiceFieldRequirements["customer"]>[];
  projectClientDefaults: Pick<CustomerDetails, "name" | "addressLine1"> & CustomerDetails;
  paymentRouteStatus: "stripe" | "bank" | "missing";
  isSavingBillingProfile: boolean;
  isSavingCustomer: boolean;
  isSavingVisibility: boolean;
  onApplyProjectClientDetails: () => void;
  onSaveBillingDetails: () => void;
  onSaveCustomerDetails: () => void;
  onSetSellerFieldVisibility: (key: keyof InvoiceFieldRequirements["seller"], visible: boolean) => void;
  onSetCustomerFieldVisibility: (key: keyof InvoiceFieldRequirements["customer"], visible: boolean) => void;
  onBillingProfileChange: (field: keyof BillingProfile, value: string) => void;
  onCustomerChange: (field: keyof CustomerDetails, value: string) => void;
};

function SetupField({
  label,
  htmlFor,
  description,
  action,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
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

function renderHideFieldAction(label: string, onClick: () => void, disabled: boolean, ariaLabel: string) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="size-5 rounded-full text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <X className="h-3 w-3" />
    </Button>
  );
}

function FieldToggleList<T extends string>({
  title,
  options,
  onShow,
  disabled,
}: {
  title: string;
  options: VisibilityOption<T>[];
  onShow: (key: T) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();

  if (options.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/70 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShow(option.key)}
            disabled={disabled}
          >
            {t("projectPayments", "showField", { field: option.label })}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ProjectPaymentsSetupTabContent({
  billingProfile,
  customer,
  invoiceFieldRequirements,
  hiddenSellerFieldOptions,
  hiddenCustomerFieldOptions,
  projectClientDefaults,
  paymentRouteStatus,
  isSavingBillingProfile,
  isSavingCustomer,
  isSavingVisibility,
  onApplyProjectClientDetails,
  onSaveBillingDetails,
  onSaveCustomerDetails,
  onSetSellerFieldVisibility,
  onSetCustomerFieldVisibility,
  onBillingProfileChange,
  onCustomerChange,
}: ProjectPaymentsSetupTabContentProps) {
  const { t } = useI18n();
  const hideField = (label: string) => t("projectPayments", "hideField", { field: label });

  const paymentRouteBadgeClassName =
    paymentRouteStatus === "missing"
      ? "border-destructive/35 bg-destructive/12 text-destructive"
      : paymentRouteStatus === "stripe"
        ? "border-primary/35 bg-primary/10 text-primary dark:text-primary"
        : "border-border bg-secondary/70 text-foreground";

  return (
    <TabsContent value="invoice-setup" className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <Banknote />
                {t("projectPayments", "organizationBillingProfile")}
              </CardTitle>
              <CardDescription>
                {t("projectPayments", "sellerDataShared")}{" "}
                <Link href="/organisation/settings#organization-billing-profile" target="_blank" rel="noopener noreferrer">
                  {t("projectPayments", "organizationSettings")}
                </Link>
                .
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("projectPayments", "paymentRoute")}</span>
              <Badge variant="outline" className={paymentRouteBadgeClassName}>
                {paymentRouteStatus === "stripe"
                  ? "Stripe"
                  : paymentRouteStatus === "bank"
                    ? t("projectPayments", "bankTransfer")
                    : t("projectPayments", "missing")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldToggleList
              title={t("projectPayments", "hiddenSellerFields")}
              options={hiddenSellerFieldOptions}
              onShow={(key) => onSetSellerFieldVisibility(key, true)}
              disabled={isSavingVisibility}
            />

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {invoiceFieldRequirements.seller.sellerName ? (
                <SetupField
                  label={t("projectPayments", "sellerName")}
                  htmlFor="seller-name"
                  action={renderHideFieldAction(
                    t("projectPayments", "sellerName"),
                    () => onSetSellerFieldVisibility("sellerName", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "sellerName")),
                  )}
                >
                  <Input
                    id="seller-name"
                    value={billingProfile.sellerName}
                    onChange={(e) => onBillingProfileChange("sellerName", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerTaxId ? (
                <SetupField
                  label={t("projectPayments", "taxIdVatId")}
                  htmlFor="seller-tax-id"
                  action={renderHideFieldAction(
                    t("projectPayments", "taxIdVatId"),
                    () => onSetSellerFieldVisibility("sellerTaxId", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "taxIdVatId")),
                  )}
                >
                  <Input
                    id="seller-tax-id"
                    value={billingProfile.sellerTaxId}
                    onChange={(e) => onBillingProfileChange("sellerTaxId", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerEmail ? (
                <SetupField
                  label={t("projectPayments", "billingEmail")}
                  htmlFor="seller-email"
                  action={renderHideFieldAction(
                    t("projectPayments", "billingEmail"),
                    () => onSetSellerFieldVisibility("sellerEmail", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "billingEmail")),
                  )}
                >
                  <Input
                    id="seller-email"
                    type="email"
                    value={billingProfile.sellerEmail}
                    onChange={(e) => onBillingProfileChange("sellerEmail", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerPhone ? (
                <SetupField
                  label={t("projectPayments", "phone")}
                  htmlFor="seller-phone"
                  action={renderHideFieldAction(
                    t("projectPayments", "phone"),
                    () => onSetSellerFieldVisibility("sellerPhone", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "phone")),
                  )}
                >
                  <Input
                    id="seller-phone"
                    value={billingProfile.sellerPhone}
                    onChange={(e) => onBillingProfileChange("sellerPhone", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerAddressLine1 ? (
                <SetupField
                  label={t("projectPayments", "addressLine1")}
                  htmlFor="seller-address-1"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "addressLine1"),
                    () => onSetSellerFieldVisibility("sellerAddressLine1", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "addressLine1")),
                  )}
                >
                  <Input
                    id="seller-address-1"
                    value={billingProfile.sellerAddressLine1}
                    onChange={(e) => onBillingProfileChange("sellerAddressLine1", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerAddressLine2 ? (
                <SetupField
                  label={t("projectPayments", "addressLine2")}
                  htmlFor="seller-address-2"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "addressLine2"),
                    () => onSetSellerFieldVisibility("sellerAddressLine2", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "addressLine2")),
                  )}
                >
                  <Input
                    id="seller-address-2"
                    value={billingProfile.sellerAddressLine2}
                    onChange={(e) => onBillingProfileChange("sellerAddressLine2", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerPostalCode ? (
                <SetupField
                  label={t("projectPayments", "postalCode")}
                  htmlFor="seller-postal-code"
                  action={renderHideFieldAction(
                    t("projectPayments", "postalCode"),
                    () => onSetSellerFieldVisibility("sellerPostalCode", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "postalCode")),
                  )}
                >
                  <Input
                    id="seller-postal-code"
                    value={billingProfile.sellerPostalCode}
                    onChange={(e) => onBillingProfileChange("sellerPostalCode", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerCity ? (
                <SetupField
                  label={t("projectPayments", "city")}
                  htmlFor="seller-city"
                  action={renderHideFieldAction(
                    t("projectPayments", "city"),
                    () => onSetSellerFieldVisibility("sellerCity", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "city")),
                  )}
                >
                  <Input
                    id="seller-city"
                    value={billingProfile.sellerCity}
                    onChange={(e) => onBillingProfileChange("sellerCity", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.sellerCountry ? (
                <SetupField
                  label={t("projectPayments", "country")}
                  htmlFor="seller-country"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "country"),
                    () => onSetSellerFieldVisibility("sellerCountry", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "country")),
                  )}
                >
                  <Input
                    id="seller-country"
                    value={billingProfile.sellerCountry}
                    onChange={(e) => onBillingProfileChange("sellerCountry", e.target.value)}
                  />
                </SetupField>
              ) : null}
            </FieldGroup>

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {invoiceFieldRequirements.seller.bankAccountHolder ? (
                <SetupField
                  label={t("projectPayments", "accountHolder")}
                  htmlFor="bank-account-holder"
                  action={renderHideFieldAction(
                    t("projectPayments", "accountHolder"),
                    () => onSetSellerFieldVisibility("bankAccountHolder", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "accountHolder")),
                  )}
                >
                  <Input
                    id="bank-account-holder"
                    value={billingProfile.bankAccountHolder}
                    onChange={(e) => onBillingProfileChange("bankAccountHolder", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.bankName ? (
                <SetupField
                  label={t("projectPayments", "bankName")}
                  htmlFor="bank-name"
                  action={renderHideFieldAction(
                    t("projectPayments", "bankName"),
                    () => onSetSellerFieldVisibility("bankName", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "bankName")),
                  )}
                >
                  <Input
                    id="bank-name"
                    value={billingProfile.bankName}
                    onChange={(e) => onBillingProfileChange("bankName", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.bankAccountNumber ? (
                <SetupField
                  label={t("projectPayments", "bankAccountNumberIban")}
                  htmlFor="bank-account-number"
                  action={renderHideFieldAction(
                    t("projectPayments", "bankAccountNumberIban"),
                    () => onSetSellerFieldVisibility("bankAccountNumber", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "bankAccountNumberIban")),
                  )}
                >
                  <Input
                    id="bank-account-number"
                    value={billingProfile.bankAccountNumber}
                    onChange={(e) => onBillingProfileChange("bankAccountNumber", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.bankSwift ? (
                <SetupField
                  label={t("projectPayments", "swift")}
                  htmlFor="bank-swift"
                  action={renderHideFieldAction(
                    t("projectPayments", "swift"),
                    () => onSetSellerFieldVisibility("bankSwift", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "swift")),
                  )}
                >
                  <Input
                    id="bank-swift"
                    value={billingProfile.bankSwift}
                    onChange={(e) => onBillingProfileChange("bankSwift", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.defaultPaymentTermDays ? (
                <SetupField
                  label={t("projectPayments", "defaultDueDays")}
                  htmlFor="default-due-days"
                  action={renderHideFieldAction(
                    t("projectPayments", "defaultDueDays"),
                    () => onSetSellerFieldVisibility("defaultPaymentTermDays", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "defaultDueDays")),
                  )}
                >
                  <Input
                    id="default-due-days"
                    type="number"
                    min="1"
                    value={billingProfile.defaultPaymentTermDays}
                    onChange={(e) => onBillingProfileChange("defaultPaymentTermDays", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.seller.paymentInstructions ? (
                <SetupField
                  label={t("projectPayments", "paymentInstructions")}
                  htmlFor="payment-instructions"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "paymentInstructions"),
                    () => onSetSellerFieldVisibility("paymentInstructions", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "paymentInstructions")),
                  )}
                >
                  <Textarea
                    id="payment-instructions"
                    rows={4}
                    value={billingProfile.paymentInstructions}
                    onChange={(e) => onBillingProfileChange("paymentInstructions", e.target.value)}
                  />
                </SetupField>
              ) : null}
            </FieldGroup>

            <div className="flex justify-end">
              <Button type="button" onClick={onSaveBillingDetails} disabled={isSavingBillingProfile}>
                {isSavingBillingProfile ? t("projectPayments", "saving") : t("projectPayments", "saveBillingProfile")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 />
              {t("projectPayments", "billToCustomer")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onApplyProjectClientDetails}>
                <RefreshCw data-icon="inline-start" />
                {t("projectPayments", "useProjectClientDetails")}
              </Button>
              {projectClientDefaults.name ? <Badge variant="outline">{projectClientDefaults.name}</Badge> : null}
            </div>

            <FieldToggleList
              title={t("projectPayments", "hiddenCustomerFields")}
              options={hiddenCustomerFieldOptions}
              onShow={(key) => onSetCustomerFieldVisibility(key, true)}
              disabled={isSavingVisibility}
            />

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {invoiceFieldRequirements.customer.companyName ? (
                <SetupField
                  label={t("projectPayments", "companyName")}
                  htmlFor="customer-company-name"
                  action={renderHideFieldAction(
                    t("projectPayments", "companyName"),
                    () => onSetCustomerFieldVisibility("companyName", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "companyName")),
                  )}
                >
                  <Input
                    id="customer-company-name"
                    value={customer.companyName}
                    onChange={(e) => onCustomerChange("companyName", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.name ? (
                <SetupField
                  label={t("projectPayments", "contactBuyerName")}
                  htmlFor="customer-name"
                  action={renderHideFieldAction(
                    t("projectPayments", "contactBuyerName"),
                    () => onSetCustomerFieldVisibility("name", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "contactBuyerName")),
                  )}
                >
                  <Input
                    id="customer-name"
                    value={customer.name}
                    onChange={(e) => onCustomerChange("name", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.email ? (
                <SetupField
                  label={t("projectPayments", "billingEmail")}
                  htmlFor="customer-email"
                  action={renderHideFieldAction(
                    t("projectPayments", "billingEmail"),
                    () => onSetCustomerFieldVisibility("email", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "billingEmail")),
                  )}
                >
                  <Input
                    id="customer-email"
                    type="email"
                    value={customer.email}
                    onChange={(e) => onCustomerChange("email", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.phone ? (
                <SetupField
                  label={t("projectPayments", "phone")}
                  htmlFor="customer-phone"
                  action={renderHideFieldAction(
                    t("projectPayments", "phone"),
                    () => onSetCustomerFieldVisibility("phone", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "phone")),
                  )}
                >
                  <Input
                    id="customer-phone"
                    value={customer.phone}
                    onChange={(e) => onCustomerChange("phone", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.taxId ? (
                <SetupField
                  label={t("projectPayments", "taxIdVatId")}
                  htmlFor="customer-tax-id"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "taxIdVatId"),
                    () => onSetCustomerFieldVisibility("taxId", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "taxIdVatId")),
                  )}
                >
                  <Input
                    id="customer-tax-id"
                    value={customer.taxId}
                    onChange={(e) => onCustomerChange("taxId", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.addressLine1 ? (
                <SetupField
                  label={t("projectPayments", "addressLine1")}
                  htmlFor="customer-address-1"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "addressLine1"),
                    () => onSetCustomerFieldVisibility("addressLine1", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "addressLine1")),
                  )}
                >
                  <Input
                    id="customer-address-1"
                    value={customer.addressLine1}
                    onChange={(e) => onCustomerChange("addressLine1", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.addressLine2 ? (
                <SetupField
                  label={t("projectPayments", "addressLine2")}
                  htmlFor="customer-address-2"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "addressLine2"),
                    () => onSetCustomerFieldVisibility("addressLine2", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "addressLine2")),
                  )}
                >
                  <Input
                    id="customer-address-2"
                    value={customer.addressLine2}
                    onChange={(e) => onCustomerChange("addressLine2", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.postalCode ? (
                <SetupField
                  label={t("projectPayments", "postalCode")}
                  htmlFor="customer-postal-code"
                  action={renderHideFieldAction(
                    t("projectPayments", "postalCode"),
                    () => onSetCustomerFieldVisibility("postalCode", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "postalCode")),
                  )}
                >
                  <Input
                    id="customer-postal-code"
                    value={customer.postalCode}
                    onChange={(e) => onCustomerChange("postalCode", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.city ? (
                <SetupField
                  label={t("projectPayments", "city")}
                  htmlFor="customer-city"
                  action={renderHideFieldAction(
                    t("projectPayments", "city"),
                    () => onSetCustomerFieldVisibility("city", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "city")),
                  )}
                >
                  <Input
                    id="customer-city"
                    value={customer.city}
                    onChange={(e) => onCustomerChange("city", e.target.value)}
                  />
                </SetupField>
              ) : null}
              {invoiceFieldRequirements.customer.country ? (
                <SetupField
                  label={t("projectPayments", "country")}
                  htmlFor="customer-country"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    t("projectPayments", "country"),
                    () => onSetCustomerFieldVisibility("country", false),
                    isSavingVisibility,
                    hideField(t("projectPayments", "country")),
                  )}
                >
                  <Input
                    id="customer-country"
                    value={customer.country}
                    onChange={(e) => onCustomerChange("country", e.target.value)}
                  />
                </SetupField>
              ) : null}
            </FieldGroup>

            <div className="flex justify-end">
              <Button type="button" onClick={onSaveCustomerDetails} disabled={isSavingCustomer}>
                {isSavingCustomer ? t("projectPayments", "saving") : t("projectPayments", "saveCustomerDetails")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
