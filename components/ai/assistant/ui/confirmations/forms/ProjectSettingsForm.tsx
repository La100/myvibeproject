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

export function ProjectSettingsForm({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
}) {
  const statusValue = typeof data.status === "string" ? data.status : "planning"
  const currencyValue = typeof data.currency === "string" ? data.currency : "PLN"

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="project-settings-name">Project Name</FieldLabel>
        <Input
          id="project-settings-name"
          value={String(data.name || "")}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Project name"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="project-settings-description">Description</FieldLabel>
        <Textarea
          id="project-settings-description"
          value={String(data.description || "")}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="min-h-[72px] resize-none"
          placeholder="Project description"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="project-settings-status">Status</FieldLabel>
          <Select value={statusValue} onValueChange={(value) => onUpdate({ status: value })}>
            <SelectTrigger id="project-settings-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="project-settings-currency">Currency</FieldLabel>
          <Select
            value={currencyValue}
            onValueChange={(value) => onUpdate({ currency: value })}
          >
            <SelectTrigger id="project-settings-currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="PLN">PLN</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="AUD">AUD</SelectItem>
              <SelectItem value="JPY">JPY</SelectItem>
              <SelectItem value="CHF">CHF</SelectItem>
              <SelectItem value="SEK">SEK</SelectItem>
              <SelectItem value="NOK">NOK</SelectItem>
              <SelectItem value="DKK">DKK</SelectItem>
              <SelectItem value="CZK">CZK</SelectItem>
              <SelectItem value="HUF">HUF</SelectItem>
              <SelectItem value="CNY">CNY</SelectItem>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="BRL">BRL</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="KRW">KRW</SelectItem>
              <SelectItem value="SGD">SGD</SelectItem>
              <SelectItem value="HKD">HKD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="project-settings-client">Client</FieldLabel>
          <Input
            id="project-settings-client"
            value={String(data.customer || "")}
            onChange={(e) => onUpdate({ customer: e.target.value })}
            placeholder="Client name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="project-settings-location">Location</FieldLabel>
          <Input
            id="project-settings-location"
            value={String(data.location || "")}
            onChange={(e) => onUpdate({ location: e.target.value })}
            placeholder="City / address"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="project-settings-budget">Budget</FieldLabel>
        <Input
          id="project-settings-budget"
          type="number"
          value={
            data.budget === undefined || data.budget === null
              ? ""
              : String(data.budget)
          }
          onChange={(e) =>
            onUpdate({ budget: e.target.value ? Number(e.target.value) : undefined })
          }
          placeholder="Project budget"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="project-settings-cover">Cover Image URL</FieldLabel>
        <Input
          id="project-settings-cover"
          value={String(data.coverImageUrl || "")}
          onChange={(e) => onUpdate({ coverImageUrl: e.target.value })}
          placeholder="https://example.com/cover.jpg"
        />
      </Field>
    </FieldGroup>
  )
}
