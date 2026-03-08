import { useEffect, useRef, useState } from "react"
import { format, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function TaskForm({
  data,
  onUpdate,
  teamMembers,
}: {
  data: Record<string, unknown>
  onUpdate: (u: Record<string, unknown>) => void
  teamMembers?: Array<{ clerkUserId: string; name?: string; email?: string }>
}) {
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    if (!data.startDate) return undefined
    const nextDate = new Date(String(data.startDate))
    return isValid(nextDate) ? nextDate : undefined
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    if (!data.endDate) return undefined
    const nextDate = new Date(String(data.endDate))
    return isValid(nextDate) ? nextDate : undefined
  })
  const [startTime, setStartTime] = useState(
    startDate ? format(startDate, "HH:mm") : "11:00"
  )
  const [endTime, setEndTime] = useState(
    endDate ? format(endDate, "HH:mm") : "12:00"
  )
  const assignedToValue = data.assignedTo ? String(data.assignedTo) : "unassigned"
  const priorityValue = typeof data.priority === "string" ? data.priority : "none"
  const statusValue = typeof data.status === "string" ? data.status : "todo"
  const tagsValue = Array.isArray(data.tags)
    ? data.tags.join(", ")
    : String(data.tags || "")
  const onUpdateRef = useRef(onUpdate)
  const startDateIsoRef = useRef(
    typeof data.startDate === "string" ? data.startDate : undefined
  )
  const endDateIsoRef = useRef(
    typeof data.endDate === "string" ? data.endDate : undefined
  )

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    startDateIsoRef.current =
      typeof data.startDate === "string" ? data.startDate : undefined
  }, [data.startDate])

  useEffect(() => {
    endDateIsoRef.current =
      typeof data.endDate === "string" ? data.endDate : undefined
  }, [data.endDate])

  useEffect(() => {
    if (startDate) {
      const [hours, minutes] = startTime.split(":").map(Number)
      const nextDate = new Date(startDate)
      nextDate.setHours(hours || 0, minutes || 0)
      if (nextDate.toISOString() !== startDateIsoRef.current) {
        onUpdateRef.current({ startDate: nextDate.toISOString() })
      }
    }
  }, [startDate, startTime])

  useEffect(() => {
    if (endDate) {
      const [hours, minutes] = endTime.split(":").map(Number)
      const nextDate = new Date(endDate)
      nextDate.setHours(hours || 0, minutes || 0)
      if (nextDate.toISOString() !== endDateIsoRef.current) {
        onUpdateRef.current({ endDate: nextDate.toISOString() })
      }
    }
  }, [endDate, endTime])

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="task-confirmation-title">Title</FieldLabel>
        <Input
          id="task-confirmation-title"
          value={String(data.title || data.name || "")}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Enter title"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="task-confirmation-description">Description</FieldLabel>
        <Input
          id="task-confirmation-description"
          value={String(data.description || "")}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Add description"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="task-confirmation-status">Status</FieldLabel>
          <Select value={statusValue} onValueChange={(value) => onUpdate({ status: value })}>
            <SelectTrigger id="task-confirmation-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="task-confirmation-priority">Priority</FieldLabel>
          <Select
            value={priorityValue}
            onValueChange={(value) =>
              onUpdate({ priority: value === "none" ? undefined : value })
            }
          >
            <SelectTrigger id="task-confirmation-priority">
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
      </div>
      <Field>
        <FieldLabel htmlFor="task-confirmation-assigned-to">Assigned To</FieldLabel>
        <Select
          value={assignedToValue}
          onValueChange={(value) => {
            const selected = teamMembers?.find(
              (member) => member.clerkUserId === value
            )
            if (value === "unassigned") {
              onUpdate({ assignedTo: null, assignedToName: undefined })
              return
            }
            onUpdate({
              assignedTo: value,
              assignedToName: selected?.name || selected?.email,
            })
          }}
        >
          <SelectTrigger id="task-confirmation-assigned-to">
            <SelectValue placeholder="Select a person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers?.map((member) => (
              <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                {member.name || member.email || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="task-confirmation-tags">Tags</FieldLabel>
        <Input
          id="task-confirmation-tags"
          value={tagsValue}
          onChange={(e) => {
            const nextTags = e.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
            onUpdate({ tags: nextTags.length > 0 ? nextTags : undefined })
          }}
          placeholder="e.g. meeting, painter"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Start Time</FieldLabel>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon data-icon="inline-start" />
                  <span className="truncate">
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-28"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel>End Time</FieldLabel>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon data-icon="inline-start" />
                  <span className="truncate">
                    {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-28"
            />
          </div>
        </Field>
      </div>
    </FieldGroup>
  )
}
