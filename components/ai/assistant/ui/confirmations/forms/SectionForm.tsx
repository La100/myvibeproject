import { useEffect, useState } from "react"

import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SectionForm({
  data,
  onUpdate,
  type,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
  type: string
}) {
  const [name, setName] = useState(String(data.name || ""))

  useEffect(() => {
    onUpdate({ name })
  }, [name, onUpdate])

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="section-name">
          {type === "shoppingSection" ? "Shopping List" : "Labor"} Section Name
        </FieldLabel>
        <Input
          id="section-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter section name"
        />
      </Field>
    </FieldGroup>
  )
}
