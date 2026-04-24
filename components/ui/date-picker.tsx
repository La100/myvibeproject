"use client"

import * as React from "react"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  calendarClassName?: string
  calendarClassNames?: React.ComponentProps<typeof Calendar>["classNames"]
  disabled?: React.ComponentProps<typeof Calendar>["disabled"]
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
}

export function DatePicker({ 
  date, 
  onDateChange, 
  placeholder = "Pick a date",
  className,
  calendarClassName,
  calendarClassNames,
  disabled,
  captionLayout = "dropdown",
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {date ? format(date, "PPP") : placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          disabled={disabled}
          captionLayout={captionLayout === "dropdown" ? "label" : captionLayout}
          className={cn("rounded-md border shadow-sm", calendarClassName)}
          classNames={calendarClassNames}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
