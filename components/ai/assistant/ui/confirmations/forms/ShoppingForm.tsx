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

export function ShoppingForm({
  data,
  onUpdate,
  currency,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
  currency?: string
}) {
  const priorityValue = typeof data.priority === "string" ? data.priority : "none"

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const raw = value.trim()
      const numericLike = raw.match(/-?\d[\d\s.,]*/)?.[0]
      if (!numericLike) return undefined

      let normalized = numericLike.replace(/\s+/g, "")
      const commaCount = (normalized.match(/,/g) || []).length
      const dotCount = (normalized.match(/\./g) || []).length

      if (commaCount > 0 && dotCount > 0) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".")
        } else {
          normalized = normalized.replace(/,/g, "")
        }
      } else if (commaCount > 0) {
        if (commaCount > 1) {
          normalized = normalized.replace(/,/g, "")
        } else {
          const [intPart, fracPart = ""] = normalized.split(",")
          normalized =
            fracPart.length === 3 ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`
        }
      } else if (dotCount > 1) {
        normalized = normalized.replace(/\./g, "")
      } else if (dotCount === 1) {
        const [intPart, fracPart = ""] = normalized.split(".")
        if (fracPart.length === 3) {
          normalized = `${intPart}${fracPart}`
        }
      }

      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) return parsed
    }
    return undefined
  }

  const quantityValue = toNumber(data.quantity) ?? 1
  const unitPriceValue = (() => {
    const direct = toNumber(data.unitPrice)
    if (direct !== undefined && direct > 0) return direct
    const alias = toNumber(data.price)
    if (alias !== undefined && alias > 0) return alias
    const total = toNumber(data.totalPrice)
    if (total !== undefined && total > 0 && quantityValue > 0) {
      return total / quantityValue
    }
    return undefined
  })()
  const currencySuffix =
    typeof currency === "string" && currency.trim().length > 0
      ? ` (${currency.trim()})`
      : ""

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="shopping-name">Item Name</FieldLabel>
        <Input
          id="shopping-name"
          value={String(data.name || "")}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. Milk"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="shopping-quantity">Quantity</FieldLabel>
          <Input
            id="shopping-quantity"
            type="number"
            value={quantityValue}
            onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shopping-price">
            Price{currencySuffix} (Optional)
          </FieldLabel>
          <Input
            id="shopping-price"
            type="number"
            value={unitPriceValue === undefined ? "" : String(unitPriceValue)}
            onChange={(e) =>
              onUpdate({
                unitPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="0.00"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="shopping-priority">Priority</FieldLabel>
          <Select
            value={priorityValue}
            onValueChange={(value) =>
              onUpdate({ priority: value === "none" ? undefined : value })
            }
          >
            <SelectTrigger id="shopping-priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="shopping-buy-before">Buy Before</FieldLabel>
          <Input
            id="shopping-buy-before"
            type="date"
            value={String(data.buyBefore || "")}
            onChange={(e) => onUpdate({ buyBefore: e.target.value || undefined })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="shopping-category">Category</FieldLabel>
        <Input
          id="shopping-category"
          value={String(data.category || "")}
          onChange={(e) => onUpdate({ category: e.target.value })}
          placeholder="e.g. Dairy"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="shopping-supplier">Supplier</FieldLabel>
          <Input
            id="shopping-supplier"
            value={String(data.supplier || "")}
            onChange={(e) => onUpdate({ supplier: e.target.value })}
            placeholder="Supplier name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shopping-section">Section</FieldLabel>
          <Input
            id="shopping-section"
            value={String(data.sectionName || "")}
            onChange={(e) => onUpdate({ sectionName: e.target.value })}
            placeholder="e.g. Bathroom"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="shopping-dimensions">Dimensions</FieldLabel>
          <Input
            id="shopping-dimensions"
            value={String(data.dimensions || "")}
            onChange={(e) => onUpdate({ dimensions: e.target.value })}
            placeholder="e.g. 120x60 cm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shopping-catalog-number">Catalog Number</FieldLabel>
          <Input
            id="shopping-catalog-number"
            value={String(data.catalogNumber || "")}
            onChange={(e) => onUpdate({ catalogNumber: e.target.value })}
            placeholder="Model / SKU"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="shopping-link">Product Link</FieldLabel>
        <Input
          id="shopping-link"
          value={String(data.productLink || "")}
          onChange={(e) => onUpdate({ productLink: e.target.value })}
          placeholder="https://"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="shopping-notes">Notes</FieldLabel>
        <Input
          id="shopping-notes"
          value={String(data.notes || "")}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Add details..."
        />
      </Field>
    </FieldGroup>
  )
}
