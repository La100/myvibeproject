"use client";

import Link from "next/link";
import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { cn, formatCurrency } from "@/lib/utils";

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

type OrganizationTaxSettings = {
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  priceDisplay: "net" | "gross" | "both";
};

type InvoiceLineItemFormState = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type InvoiceDraftFormState = {
  invoiceNumber: string;
  dueDate: string;
};

type TaxBreakdown = {
  net: number;
  tax: number;
  gross: number;
};

type ProjectInvoiceDraftEditorProps = {
  isCreateMode: boolean;
  isIssuedInvoiceEdit: boolean;
  invoiceSetupReady: boolean;
  paymentRouteLabel: string;
  issueDateLabel: string;
  activeCurrency: string;
  form: InvoiceDraftFormState;
  setForm: Dispatch<SetStateAction<InvoiceDraftFormState>>;
  editorBillingProfile: BillingProfile;
  setEditorBillingProfile: Dispatch<SetStateAction<BillingProfile>>;
  editorCustomer: CustomerDetails;
  setEditorCustomer: Dispatch<SetStateAction<CustomerDetails>>;
  editorLineItems: InvoiceLineItemFormState[];
  addEditorLineItem: () => void;
  removeEditorLineItem: (index: number) => void;
  updateEditorLineItem: (
    index: number,
    field: keyof InvoiceLineItemFormState,
    value: string,
  ) => void;
  editorTaxSettings: OrganizationTaxSettings;
  editorTaxBreakdown: TaxBreakdown;
  editorTotalLabel: string;
  onApplyProjectClientDetailsToEditor: () => void;
};

function InvoiceField({
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

function SummaryField({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value || "Not set"}</p>
    </div>
  );
}

function InlineLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </p>
  );
}

export function ProjectInvoiceDraftEditor({
  isCreateMode,
  isIssuedInvoiceEdit,
  invoiceSetupReady,
  paymentRouteLabel,
  issueDateLabel,
  activeCurrency,
  form,
  setForm,
  editorBillingProfile,
  setEditorBillingProfile,
  editorCustomer,
  setEditorCustomer,
  editorLineItems,
  addEditorLineItem,
  removeEditorLineItem,
  updateEditorLineItem,
  editorTaxSettings,
  editorTaxBreakdown,
  editorTotalLabel,
  onApplyProjectClientDetailsToEditor,
}: ProjectInvoiceDraftEditorProps) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-8 p-6 md:p-10">
        <div className="flex flex-col gap-6 border-b border-border/60 pb-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
              {isCreateMode ? "Invoice draft" : "Invoice editor"}
            </p>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Invoice</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {isCreateMode
                  ? "Seller and payment details come from the organization billing profile. Review client details and invoice line items before saving."
                  : "Edit the invoice snapshot directly before saving changes."}
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
                <InlineLabel>Invoice number</InlineLabel>
                {isIssuedInvoiceEdit ? (
                  <Input
                    id="installment-invoice-number"
                    value={form.invoiceNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, invoiceNumber: event.target.value }))
                    }
                    placeholder="INV/2026/0001"
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-sm text-foreground">Assigned automatically on issue</p>
                )}
              </div>
              <div>
                <InlineLabel>Issue date</InlineLabel>
                <p className="mt-2 text-sm text-foreground">{issueDateLabel}</p>
              </div>
              <div>
                <InlineLabel>Due date</InlineLabel>
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
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                From
              </p>
            </div>
            {isCreateMode ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="max-w-md text-sm text-muted-foreground">
                    These details are pulled from the organization billing profile and saved as the
                    invoice seller snapshot when you create the draft.
                  </p>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link
                      href="/organisation/settings#organization-billing-profile"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage organization profile
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SummaryField label="Seller name" value={editorBillingProfile.sellerName} />
                  <SummaryField label="Tax ID / VAT ID" value={editorBillingProfile.sellerTaxId} />
                  <SummaryField label="Billing email" value={editorBillingProfile.sellerEmail} />
                  <SummaryField label="Phone" value={editorBillingProfile.sellerPhone} />
                  <SummaryField label="Address line 1" value={editorBillingProfile.sellerAddressLine1} />
                  <SummaryField label="Address line 2" value={editorBillingProfile.sellerAddressLine2} />
                  <SummaryField label="Postal code" value={editorBillingProfile.sellerPostalCode} />
                  <SummaryField label="City" value={editorBillingProfile.sellerCity} />
                  <SummaryField label="Country" value={editorBillingProfile.sellerCountry} />
                </div>
              </div>
            ) : (
              <FieldGroup className="grid gap-4">
                <InvoiceField label="Seller name" htmlFor="editor-seller-name">
                  <Input
                    id="editor-seller-name"
                    value={editorBillingProfile.sellerName}
                    onChange={(event) =>
                      setEditorBillingProfile((prev) => ({ ...prev, sellerName: event.target.value }))
                    }
                  />
                </InvoiceField>
                <FieldGroup className="grid gap-4 md:grid-cols-2">
                  <InvoiceField label="Billing email" htmlFor="editor-seller-email">
                    <Input
                      id="editor-seller-email"
                      type="email"
                      value={editorBillingProfile.sellerEmail}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({ ...prev, sellerEmail: event.target.value }))
                      }
                    />
                  </InvoiceField>
                  <InvoiceField label="Phone" htmlFor="editor-seller-phone">
                    <Input
                      id="editor-seller-phone"
                      value={editorBillingProfile.sellerPhone}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({ ...prev, sellerPhone: event.target.value }))
                      }
                    />
                  </InvoiceField>
                </FieldGroup>
                <InvoiceField label="Tax ID / VAT ID" htmlFor="editor-seller-tax-id">
                  <Input
                    id="editor-seller-tax-id"
                    value={editorBillingProfile.sellerTaxId}
                    onChange={(event) =>
                      setEditorBillingProfile((prev) => ({ ...prev, sellerTaxId: event.target.value }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="Address line 1" htmlFor="editor-seller-address-1">
                  <Input
                    id="editor-seller-address-1"
                    value={editorBillingProfile.sellerAddressLine1}
                    onChange={(event) =>
                      setEditorBillingProfile((prev) => ({
                        ...prev,
                        sellerAddressLine1: event.target.value,
                      }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="Address line 2" htmlFor="editor-seller-address-2">
                  <Input
                    id="editor-seller-address-2"
                    value={editorBillingProfile.sellerAddressLine2}
                    onChange={(event) =>
                      setEditorBillingProfile((prev) => ({
                        ...prev,
                        sellerAddressLine2: event.target.value,
                      }))
                    }
                  />
                </InvoiceField>
                <FieldGroup className="grid gap-4 md:grid-cols-3">
                  <InvoiceField label="Postal code" htmlFor="editor-seller-postal-code">
                    <Input
                      id="editor-seller-postal-code"
                      value={editorBillingProfile.sellerPostalCode}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({
                          ...prev,
                          sellerPostalCode: event.target.value,
                        }))
                      }
                    />
                  </InvoiceField>
                  <InvoiceField label="City" htmlFor="editor-seller-city">
                    <Input
                      id="editor-seller-city"
                      value={editorBillingProfile.sellerCity}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({ ...prev, sellerCity: event.target.value }))
                      }
                    />
                  </InvoiceField>
                  <InvoiceField label="Country" htmlFor="editor-seller-country">
                    <Input
                      id="editor-seller-country"
                      value={editorBillingProfile.sellerCountry}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({ ...prev, sellerCountry: event.target.value }))
                      }
                    />
                  </InvoiceField>
                </FieldGroup>
              </FieldGroup>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Bill to
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onApplyProjectClientDetailsToEditor}>
                <RefreshCw data-icon="inline-start" />
                Use project client details
              </Button>
            </div>
            <FieldGroup className="grid gap-4">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <InvoiceField label="Company name" htmlFor="editor-customer-company-name">
                  <Input
                    id="editor-customer-company-name"
                    value={editorCustomer.companyName}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, companyName: event.target.value }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="Contact / buyer name" htmlFor="editor-customer-name">
                  <Input
                    id="editor-customer-name"
                    value={editorCustomer.name}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </InvoiceField>
              </FieldGroup>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <InvoiceField label="Billing email" htmlFor="editor-customer-email">
                  <Input
                    id="editor-customer-email"
                    type="email"
                    value={editorCustomer.email}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="Phone" htmlFor="editor-customer-phone">
                  <Input
                    id="editor-customer-phone"
                    value={editorCustomer.phone}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </InvoiceField>
              </FieldGroup>
              <InvoiceField label="Tax ID / VAT ID" htmlFor="editor-customer-tax-id">
                <Input
                  id="editor-customer-tax-id"
                  value={editorCustomer.taxId}
                  onChange={(event) =>
                    setEditorCustomer((prev) => ({ ...prev, taxId: event.target.value }))
                  }
                />
              </InvoiceField>
              <InvoiceField label="Address line 1" htmlFor="editor-customer-address-1">
                <Input
                  id="editor-customer-address-1"
                  value={editorCustomer.addressLine1}
                  onChange={(event) =>
                    setEditorCustomer((prev) => ({ ...prev, addressLine1: event.target.value }))
                  }
                />
              </InvoiceField>
              <InvoiceField label="Address line 2" htmlFor="editor-customer-address-2">
                <Input
                  id="editor-customer-address-2"
                  value={editorCustomer.addressLine2}
                  onChange={(event) =>
                    setEditorCustomer((prev) => ({ ...prev, addressLine2: event.target.value }))
                  }
                />
              </InvoiceField>
              <FieldGroup className="grid gap-4 md:grid-cols-3">
                <InvoiceField label="Postal code" htmlFor="editor-customer-postal-code">
                  <Input
                    id="editor-customer-postal-code"
                    value={editorCustomer.postalCode}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, postalCode: event.target.value }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="City" htmlFor="editor-customer-city">
                  <Input
                    id="editor-customer-city"
                    value={editorCustomer.city}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, city: event.target.value }))
                    }
                  />
                </InvoiceField>
                <InvoiceField label="Country" htmlFor="editor-customer-country">
                  <Input
                    id="editor-customer-country"
                    value={editorCustomer.country}
                    onChange={(event) =>
                      setEditorCustomer((prev) => ({ ...prev, country: event.target.value }))
                    }
                  />
                </InvoiceField>
              </FieldGroup>
            </FieldGroup>
          </div>
        </div>

        <div className="border-t border-border/60 pt-8">
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 bg-muted/25 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Line items
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add invoice rows with quantity and net unit price.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addEditorLineItem}>
                <Plus data-icon="inline-start" />
                Add item
              </Button>
            </div>
            <div className="space-y-4 px-4 py-4">
              {editorLineItems.map((item, index) => {
                const quantity = Number.parseFloat(item.quantity);
                const unitPrice = Number.parseFloat(item.unitPrice);
                const lineTotal =
                  Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;

                return (
                  <div key={`invoice-line-item-${index}`} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Item {index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEditorLineItem(index)}
                      >
                        <Trash2 data-icon="inline-start" />
                        Remove
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <FieldGroup className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_180px_180px]">
                        <InvoiceField label="Product / service" htmlFor={`installment-title-${index}`}>
                          <Input
                            id={`installment-title-${index}`}
                            value={item.title}
                            onChange={(event) =>
                              updateEditorLineItem(index, "title", event.target.value)
                            }
                            placeholder="Interior design project"
                          />
                        </InvoiceField>
                        <InvoiceField label="Qty" htmlFor={`installment-quantity-${index}`}>
                          <Input
                            id={`installment-quantity-${index}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                              updateEditorLineItem(index, "quantity", event.target.value)
                            }
                            placeholder="1"
                          />
                        </InvoiceField>
                        <InvoiceField
                          label={editorTaxSettings.taxEnabled ? "Unit price (net)" : "Unit price"}
                          htmlFor={`installment-unit-price-${index}`}
                        >
                          <InputGroup>
                            <InputGroupInput
                              id={`installment-unit-price-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateEditorLineItem(index, "unitPrice", event.target.value)
                              }
                              placeholder="0.00"
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupText>{activeCurrency}</InputGroupText>
                            </InputGroupAddon>
                          </InputGroup>
                        </InvoiceField>
                        <SummaryField
                          label="Line total"
                          value={formatCurrency(lineTotal || 0, activeCurrency)}
                        />
                      </FieldGroup>
                      <InvoiceField label="Description" htmlFor={`installment-description-${index}`}>
                        <Textarea
                          id={`installment-description-${index}`}
                          value={item.description}
                          onChange={(event) =>
                            updateEditorLineItem(index, "description", event.target.value)
                          }
                          placeholder="Optional note visible on the invoice"
                          rows={3}
                        />
                      </InvoiceField>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-4 border-t border-border/60 bg-muted/15 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Payment details
                </p>
                {isCreateMode ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SummaryField
                      label="Bank account number / IBAN"
                      value={editorBillingProfile.bankAccountNumber}
                    />
                    <SummaryField label="SWIFT" value={editorBillingProfile.bankSwift} />
                    <SummaryField
                      label="Account holder"
                      value={editorBillingProfile.bankAccountHolder}
                    />
                    <SummaryField label="Bank name" value={editorBillingProfile.bankName} />
                    <SummaryField
                      label="Payment instructions"
                      value={editorBillingProfile.paymentInstructions}
                      className="md:col-span-2"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        id="editor-bank-account-number"
                        value={editorBillingProfile.bankAccountNumber}
                        onChange={(event) =>
                          setEditorBillingProfile((prev) => ({
                            ...prev,
                            bankAccountNumber: event.target.value,
                          }))
                        }
                        placeholder="Bank account number / IBAN"
                      />
                      <Input
                        id="editor-bank-swift"
                        value={editorBillingProfile.bankSwift}
                        onChange={(event) =>
                          setEditorBillingProfile((prev) => ({ ...prev, bankSwift: event.target.value }))
                        }
                        placeholder="SWIFT"
                      />
                      <Input
                        id="editor-bank-account-holder"
                        value={editorBillingProfile.bankAccountHolder}
                        onChange={(event) =>
                          setEditorBillingProfile((prev) => ({
                            ...prev,
                            bankAccountHolder: event.target.value,
                          }))
                        }
                        placeholder="Account holder"
                      />
                      <Input
                        id="editor-bank-name"
                        value={editorBillingProfile.bankName}
                        onChange={(event) =>
                          setEditorBillingProfile((prev) => ({ ...prev, bankName: event.target.value }))
                        }
                        placeholder="Bank name"
                      />
                    </div>
                    <Textarea
                      id="editor-payment-instructions"
                      rows={3}
                      value={editorBillingProfile.paymentInstructions}
                      onChange={(event) =>
                        setEditorBillingProfile((prev) => ({
                          ...prev,
                          paymentInstructions: event.target.value,
                        }))
                      }
                      placeholder="Payment instructions"
                    />
                  </>
                )}
              </div>

              <div className="min-w-[220px] rounded-2xl border border-border/70 bg-background px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Summary
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(editorTaxBreakdown.net, activeCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {editorTaxSettings.taxEnabled
                        ? `${editorTaxSettings.taxLabel} (${editorTaxSettings.taxRate.toFixed(0)}%)`
                        : `${editorTaxSettings.taxLabel} disabled`}
                    </span>
                    <span>
                      {editorTaxSettings.taxEnabled
                        ? formatCurrency(editorTaxBreakdown.tax, activeCurrency)
                        : formatCurrency(0, activeCurrency)}
                    </span>
                  </div>
                  <div className="border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Total
                      </span>
                      <span className="text-2xl font-semibold tracking-tight">{editorTotalLabel}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Tax settings come from organization settings and are saved with the invoice snapshot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
