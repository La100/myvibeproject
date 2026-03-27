import { useEffect, useState } from "react"
import { getFirstNonEmptyString } from "@/components/ai/assistant/data/hooks/pendingItemsHelpers"

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
  const resolvedInitialName = getFirstNonEmptyString(
    data.name,
    data.sectionName,
    data.title,
    data.section,
    (data.sectionData as Record<string, unknown> | undefined)?.name,
    (data.sectionData as Record<string, unknown> | undefined)?.sectionName,
    (data.sectionData as Record<string, unknown> | undefined)?.title,
    (data.sectionData as Record<string, unknown> | undefined)?.section,
    (data.data as Record<string, unknown> | undefined)?.name,
    (data.data as Record<string, unknown> | undefined)?.sectionName,
    (data.data as Record<string, unknown> | undefined)?.title,
    (data.data as Record<string, unknown> | undefined)?.section,
  ) ?? "";
  const [name, setName] = useState(resolvedInitialName)

  useEffect(() => {
    setName(resolvedInitialName)
  }, [resolvedInitialName])

  useEffect(() => {
    onUpdate({ name, sectionName: name })
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
