import { useEffect, useState } from "react"

import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function LaborForm({
  data,
  onUpdate,
  currency,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
  currency?: string
}) {
  const [name, setName] = useState(String(data.name || ""))
  const [notes, setNotes] = useState(String(data.notes || ""))
  const [quantity, setQuantity] = useState(String(data.quantity || ""))
  const [unit, setUnit] = useState(String(data.unit || "m²"))
  const [unitPrice, setUnitPrice] = useState(String(data.unitPrice || ""))
  const [sectionName, setSectionName] = useState(String(data.sectionName || ""))
  const currencySuffix =
    typeof currency === "string" && currency.trim().length > 0
      ? ` (${currency.trim()})`
      : ""

  useEffect(() => {
    onUpdate({
      name,
      notes: notes || undefined,
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit: unit || undefined,
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
      sectionName: sectionName || undefined,
    })
  }, [name, notes, onUpdate, quantity, sectionName, unit, unitPrice])

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="labor-name">Work Description</FieldLabel>
        <Input
          id="labor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter work description"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="labor-quantity">Quantity</FieldLabel>
          <Input
            id="labor-quantity"
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="labor-unit">Unit</FieldLabel>
          <Input
            id="labor-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="m², m, hours, pcs"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="labor-price">Unit Price{currencySuffix}</FieldLabel>
        <Input
          id="labor-price"
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          placeholder="0.00"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="labor-section">Section</FieldLabel>
        <Input
          id="labor-section"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="Optional section name"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="labor-notes">Notes</FieldLabel>
        <Textarea
          id="labor-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-16"
          placeholder="Additional notes"
        />
      </Field>
    </FieldGroup>
  )
}
