import { useEffect, useState } from "react"

import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function SurveyForm({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
}) {
  const [title, setTitle] = useState(String(data.title || ""))
  const [description, setDescription] = useState(String(data.description || ""))

  useEffect(() => {
    onUpdate({
      title,
      description: description || undefined,
    })
  }, [description, onUpdate, title])

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="survey-title">Survey Title</FieldLabel>
        <Input
          id="survey-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter survey title"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="survey-description">Description</FieldLabel>
        <Textarea
          id="survey-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-16"
          placeholder="Survey description"
        />
      </Field>
    </FieldGroup>
  )
}
