import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function ContactForm({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
}) {
  const contactTypeValue =
    typeof data.type === "string" ? data.type : "contractor"

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="contact-name">Full Name</FieldLabel>
        <Input
          id="contact-name"
          value={String(data.name || "")}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. John Doe"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="contact-company">Company Name</FieldLabel>
        <Input
          id="contact-company"
          value={String(data.companyName || "")}
          onChange={(e) => onUpdate({ companyName: e.target.value })}
          placeholder="Company name"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contact-email">Email</FieldLabel>
          <Input
            id="contact-email"
            value={String(data.email || "")}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="john@example.com"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
          <Input
            id="contact-phone"
            value={String(data.phone || "")}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="+1 234 567 890"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="contact-type">Type</FieldLabel>
        <Select value={contactTypeValue} onValueChange={(value) => onUpdate({ type: value })}>
          <SelectTrigger id="contact-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="subcontractor">Subcontractor</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="contact-address">Address</FieldLabel>
        <Input
          id="contact-address"
          value={String(data.address || "")}
          onChange={(e) => onUpdate({ address: e.target.value })}
          placeholder="Street address"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contact-city">City</FieldLabel>
          <Input
            id="contact-city"
            value={String(data.city || "")}
            onChange={(e) => onUpdate({ city: e.target.value })}
            placeholder="City"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-postal">Postal Code</FieldLabel>
          <Input
            id="contact-postal"
            value={String(data.postalCode || "")}
            onChange={(e) => onUpdate({ postalCode: e.target.value })}
            placeholder="Postal code"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="contact-country">Country</FieldLabel>
          <Input
            id="contact-country"
            value={String(data.country || "")}
            onChange={(e) => onUpdate({ country: e.target.value })}
            placeholder="Country"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-website">Website</FieldLabel>
          <Input
            id="contact-website"
            value={String(data.website || "")}
            onChange={(e) => onUpdate({ website: e.target.value })}
            placeholder="https://"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="contact-tax-id">Tax ID</FieldLabel>
        <Input
          id="contact-tax-id"
          value={String(data.taxId || "")}
          onChange={(e) => onUpdate({ taxId: e.target.value })}
          placeholder="Tax ID"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="contact-notes">Notes</FieldLabel>
        <Textarea
          id="contact-notes"
          value={String(data.notes || "")}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          className="min-h-16 resize-none"
          placeholder="Notes"
        />
      </Field>
    </FieldGroup>
  )
}
