import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function NoteForm({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
}) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="note-title">Title</FieldLabel>
        <Input
          id="note-title"
          value={String(data.title || "")}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Note title"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="note-content">Content</FieldLabel>
        <Textarea
          id="note-content"
          value={String(data.content || "")}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="min-h-24 resize-none"
          placeholder="Type your note here..."
        />
      </Field>
    </FieldGroup>
  )
}
