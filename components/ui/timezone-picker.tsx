"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, LocateFixed } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAJOR_TIMEZONE_GROUPS: Array<{ continent: string; timezones: string[] }> = [
  {
    continent: "Americas",
    timezones: [
      "America/Honolulu",
      "America/Anchorage",
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Toronto",
      "America/Mexico_City",
      "America/Sao_Paulo",
      "America/Buenos_Aires",
    ],
  },
  {
    continent: "Europe",
    timezones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Warsaw",
      "Europe/Madrid",
      "Europe/Rome",
      "Europe/Athens",
      "Europe/Kyiv",
      "Europe/Istanbul",
    ],
  },
  {
    continent: "Africa",
    timezones: [
      "Africa/Cairo",
      "Africa/Johannesburg",
      "Africa/Nairobi",
      "Africa/Lagos",
      "Africa/Casablanca",
    ],
  },
  {
    continent: "Asia",
    timezones: [
      "Asia/Dubai",
      "Asia/Kolkata",
      "Asia/Bangkok",
      "Asia/Shanghai",
      "Asia/Hong_Kong",
      "Asia/Singapore",
      "Asia/Seoul",
      "Asia/Tokyo",
    ],
  },
  {
    continent: "Pacific",
    timezones: [
      "Australia/Perth",
      "Australia/Sydney",
      "Pacific/Auckland",
      "Pacific/Fiji",
      "Pacific/Port_Moresby",
    ],
  },
];

const formatTimezoneLabel = (timezone: string): string =>
  timezone.replaceAll("/", " ").replaceAll("_", " ");

const formatContinentLabel = (name: string): string => name.replaceAll("_", " ");

const getLocationLabel = (timezone: string): string => {
  const parts = timezone.split("/");
  if (parts.length <= 1) {
    return formatTimezoneLabel(timezone);
  }
  return parts.slice(1).join(" ").replaceAll("_", " ");
};

const detectTimezone = (): string => {
  if (typeof window === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const formatTimeInTimezone = (timezone: string, now: Date): string => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return "--:--";
  }
};

type TimezonePickerProps = {
  value: string;
  onValueChange: (timezone: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function TimezonePicker({
  value,
  onValueChange,
  placeholder = "Select timezone...",
  className,
  disabled = false,
}: TimezonePickerProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const groupedTimezones = useMemo(() => {
    return MAJOR_TIMEZONE_GROUPS.map((group) => ({
      continent: group.continent,
      timezones: group.timezones.filter((timezone) => {
        try {
          new Intl.DateTimeFormat(undefined, { timeZone: timezone });
          return true;
        } catch {
          return false;
        }
      }),
    })).filter((group) => group.timezones.length > 0);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [open]);

  const selectedLabel = value ? getLocationLabel(value) : placeholder;

  return (
    <div className="flex w-full items-center gap-2">
      <div className="min-w-0 flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "h-10 w-full min-w-0 justify-between border-input/90 px-3.5 py-2 text-sm font-normal tracking-normal shadow-[0_6px_14px_-12px_rgba(22,22,22,0.45)]",
                className
              )}
              disabled={disabled}
            >
              <span className="truncate">{selectedLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search timezone..." />
              <CommandList className="max-h-[320px]">
                <CommandEmpty>No timezone found.</CommandEmpty>
                {groupedTimezones.map((group) => (
                  <CommandGroup key={group.continent} heading={formatContinentLabel(group.continent).toUpperCase()}>
                    {group.timezones.map((timezone) => (
                      <CommandItem
                        key={timezone}
                        value={`${timezone} ${formatTimezoneLabel(timezone)} ${formatContinentLabel(group.continent)} ${getLocationLabel(timezone)}`}
                        onSelect={() => {
                          onValueChange(timezone);
                          setOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${value === timezone ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{getLocationLabel(timezone)}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                          {formatTimeInTimezone(timezone, now)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => onValueChange(detectTimezone())}
        className="h-10 w-10 shrink-0 rounded-full"
      >
        <LocateFixed className="h-4 w-4" />
        <span className="sr-only">Detect timezone</span>
      </Button>
    </div>
  );
}
