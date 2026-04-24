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

function renderHideFieldAction(label: string, onClick: () => void, disabled: boolean) {
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
            Show {option.label}
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
  const paymentRouteBadgeClassName =
    paymentRouteStatus === "missing"
      ? "border-destructive/35 bg-destructive/12 text-destructive"
      : paymentRouteStatus === "stripe"
        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border bg-secondary/70 text-foreground";

  return (
    <TabsContent value="invoice-setup" className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Banknote />
                Organization Billing Profile
              </CardTitle>
              <CardDescription>
                Seller data is shared across this organization and is also available in{" "}
                <Link href="/organisation/settings#organization-billing-profile" target="_blank" rel="noopener noreferrer">
                  organization settings
                </Link>
                .
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">Payment route</span>
              <Badge variant="outline" className={paymentRouteBadgeClassName}>
                {paymentRouteStatus === "stripe"
                  ? "Stripe"
                  : paymentRouteStatus === "bank"
                    ? "Bank transfer"
                    : "Missing"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldToggleList
              title="Hidden seller fields"
              options={hiddenSellerFieldOptions}
              onShow={(key) => onSetSellerFieldVisibility(key, true)}
              disabled={isSavingVisibility}
            />

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {invoiceFieldRequirements.seller.sellerName ? (
                <SetupField
                  label="Seller name"
                  htmlFor="seller-name"
                  action={renderHideFieldAction(
                    "Seller name",
                    () => onSetSellerFieldVisibility("sellerName", false),
                    isSavingVisibility,
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
                  label="Tax ID / VAT ID"
                  htmlFor="seller-tax-id"
                  action={renderHideFieldAction(
                    "Tax ID / VAT ID",
                    () => onSetSellerFieldVisibility("sellerTaxId", false),
                    isSavingVisibility,
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
                  label="Billing email"
                  htmlFor="seller-email"
                  action={renderHideFieldAction(
                    "Billing email",
                    () => onSetSellerFieldVisibility("sellerEmail", false),
                    isSavingVisibility,
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
                  label="Phone"
                  htmlFor="seller-phone"
                  action={renderHideFieldAction(
                    "Phone",
                    () => onSetSellerFieldVisibility("sellerPhone", false),
                    isSavingVisibility,
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
                  label="Address line 1"
                  htmlFor="seller-address-1"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Address line 1",
                    () => onSetSellerFieldVisibility("sellerAddressLine1", false),
                    isSavingVisibility,
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
                  label="Address line 2"
                  htmlFor="seller-address-2"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Address line 2",
                    () => onSetSellerFieldVisibility("sellerAddressLine2", false),
                    isSavingVisibility,
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
                  label="Postal code"
                  htmlFor="seller-postal-code"
                  action={renderHideFieldAction(
                    "Postal code",
                    () => onSetSellerFieldVisibility("sellerPostalCode", false),
                    isSavingVisibility,
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
                  label="City"
                  htmlFor="seller-city"
                  action={renderHideFieldAction(
                    "City",
                    () => onSetSellerFieldVisibility("sellerCity", false),
                    isSavingVisibility,
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
                  label="Country"
                  htmlFor="seller-country"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Country",
                    () => onSetSellerFieldVisibility("sellerCountry", false),
                    isSavingVisibility,
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
                  label="Account holder"
                  htmlFor="bank-account-holder"
                  action={renderHideFieldAction(
                    "Account holder",
                    () => onSetSellerFieldVisibility("bankAccountHolder", false),
                    isSavingVisibility,
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
                  label="Bank name"
                  htmlFor="bank-name"
                  action={renderHideFieldAction(
                    "Bank name",
                    () => onSetSellerFieldVisibility("bankName", false),
                    isSavingVisibility,
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
                  label="Bank account number / IBAN"
                  htmlFor="bank-account-number"
                  action={renderHideFieldAction(
                    "Bank account number / IBAN",
                    () => onSetSellerFieldVisibility("bankAccountNumber", false),
                    isSavingVisibility,
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
                  label="SWIFT"
                  htmlFor="bank-swift"
                  action={renderHideFieldAction(
                    "SWIFT",
                    () => onSetSellerFieldVisibility("bankSwift", false),
                    isSavingVisibility,
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
                  label="Default due days"
                  htmlFor="default-due-days"
                  action={renderHideFieldAction(
                    "Default due days",
                    () => onSetSellerFieldVisibility("defaultPaymentTermDays", false),
                    isSavingVisibility,
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
                  label="Payment instructions"
                  htmlFor="payment-instructions"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Payment instructions",
                    () => onSetSellerFieldVisibility("paymentInstructions", false),
                    isSavingVisibility,
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
                {isSavingBillingProfile ? "Saving..." : "Save billing profile"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 />
              Bill-To Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onApplyProjectClientDetails}>
                <RefreshCw data-icon="inline-start" />
                Use project client details
              </Button>
              {projectClientDefaults.name ? <Badge variant="outline">{projectClientDefaults.name}</Badge> : null}
            </div>

            <FieldToggleList
              title="Hidden customer fields"
              options={hiddenCustomerFieldOptions}
              onShow={(key) => onSetCustomerFieldVisibility(key, true)}
              disabled={isSavingVisibility}
            />

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {invoiceFieldRequirements.customer.companyName ? (
                <SetupField
                  label="Company name"
                  htmlFor="customer-company-name"
                  action={renderHideFieldAction(
                    "Company name",
                    () => onSetCustomerFieldVisibility("companyName", false),
                    isSavingVisibility,
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
                  label="Contact / buyer name"
                  htmlFor="customer-name"
                  action={renderHideFieldAction(
                    "Contact / buyer name",
                    () => onSetCustomerFieldVisibility("name", false),
                    isSavingVisibility,
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
                  label="Billing email"
                  htmlFor="customer-email"
                  action={renderHideFieldAction(
                    "Billing email",
                    () => onSetCustomerFieldVisibility("email", false),
                    isSavingVisibility,
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
                  label="Phone"
                  htmlFor="customer-phone"
                  action={renderHideFieldAction(
                    "Phone",
                    () => onSetCustomerFieldVisibility("phone", false),
                    isSavingVisibility,
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
                  label="Tax ID / VAT ID"
                  htmlFor="customer-tax-id"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Tax ID / VAT ID",
                    () => onSetCustomerFieldVisibility("taxId", false),
                    isSavingVisibility,
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
                  label="Address line 1"
                  htmlFor="customer-address-1"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Address line 1",
                    () => onSetCustomerFieldVisibility("addressLine1", false),
                    isSavingVisibility,
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
                  label="Address line 2"
                  htmlFor="customer-address-2"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Address line 2",
                    () => onSetCustomerFieldVisibility("addressLine2", false),
                    isSavingVisibility,
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
                  label="Postal code"
                  htmlFor="customer-postal-code"
                  action={renderHideFieldAction(
                    "Postal code",
                    () => onSetCustomerFieldVisibility("postalCode", false),
                    isSavingVisibility,
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
                  label="City"
                  htmlFor="customer-city"
                  action={renderHideFieldAction(
                    "City",
                    () => onSetCustomerFieldVisibility("city", false),
                    isSavingVisibility,
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
                  label="Country"
                  htmlFor="customer-country"
                  className="md:col-span-2"
                  action={renderHideFieldAction(
                    "Country",
                    () => onSetCustomerFieldVisibility("country", false),
                    isSavingVisibility,
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
                {isSavingCustomer ? "Saving..." : "Save customer details"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
