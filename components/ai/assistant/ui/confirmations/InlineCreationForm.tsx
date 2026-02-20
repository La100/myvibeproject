"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { format, isValid } from "date-fns";
import {
    Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingContentItem } from "../../data/types";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";

interface InlineCreationFormProps {
    item: PendingContentItem;
    index: number;
    onConfirm: (index: number | string) => Promise<void>;
    onReject: (index: number | string) => void | Promise<void>;
    onUpdate: (index: number | string, updates: Partial<PendingContentItem>) => void;
    confirmationMode?: "always_ask" | "auto_confirm";
    onConfirmationModeChange?: (mode: "always_ask" | "auto_confirm") => void | Promise<void>;
    isModeUpdating?: boolean;
}

export function InlineCreationForm({
    item,
    index,
    onConfirm,
    onReject,
    onUpdate,
    confirmationMode = "always_ask",
    onConfirmationModeChange,
    isModeUpdating = false,
}: InlineCreationFormProps) {
    // Determine operation from item
    const operation = item.operation || 'create';
    const operationVerb = operation === 'delete' ? 'Delete' : (operation === 'edit' || operation === 'bulk_edit') ? 'Update' : 'Create';

    // For edit operations, merge originalItem with updates to get full data
    // For create operations, use data directly
    const baseData = operation === 'edit' && item.originalItem
        ? { ...(item.originalItem as Record<string, unknown>), ...(item.updates || {}) }
        : item.data as Record<string, unknown>;

    const data = baseData;
    const title = typeof data.title === "string" ? data.title : undefined;
    const name = typeof data.name === "string" ? data.name : undefined;
    const description = typeof data.description === "string" ? data.description : undefined;
    const content = typeof data.content === "string" ? data.content : undefined;
    const displayTitle = title || name || "Untitled";
    const displayDescription = description || content;
    const { project } = useProject();
    const teamMembers = useQuery(
        apiAny.teams.getTeamMembers,
        project ? { teamId: project.teamId } : "skip"
    );

    // Determine type and label
    const type = normalizeType(item.type);

    const handleConfirm = async () => {
        await onConfirm(item.functionCall?.callId ?? index);
    };

    const updateData = (updates: Record<string, unknown>) => {
        const id = item.functionCall?.callId ?? index;
        // For edit operations, update the updates field
        // For create operations, update data field
        if (operation === 'edit') {
            onUpdate(id, {
                updates: { ...(item.updates || {}), ...updates }
            });
        } else {
            onUpdate(id, {
                data: { ...data, ...updates }
            });
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-card rounded-xl border border-border shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[60vh] ring-1 ring-border/40">
            <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className={cn("w-2 h-2 rounded-full", getDotColor(type))} />
                    <span>{operationVerb} {getLabel(type)}</span>
                </div>
                {operation === 'edit' && displayTitle && (
                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">{displayTitle}</span>
                )}
            </div>

            <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                {/* Content Forms - only show for create/edit */}
                {operation === 'delete' ? (
                    <div className="space-y-3">
                        <div className="text-base font-medium">
                            {displayTitle}
                        </div>
                        {displayDescription && (
                            <div className="text-sm text-muted-foreground">
                                {displayDescription}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {type === "task" && (
                            <TaskForm
                                data={data}
                                onUpdate={updateData}
                                teamMembers={teamMembers}
                            />
                        )}
                        {type === "note" && <NoteForm data={data} onUpdate={updateData} />}
                        {type === "shopping" && <ShoppingForm data={data} onUpdate={updateData} />}
                        {type === "labor" && <LaborForm data={data} onUpdate={updateData} />}
                        {type === "contact" && <ContactForm data={data} onUpdate={updateData} />}
                        {type === "survey" && <SurveyForm data={data} onUpdate={updateData} />}
                        {(type === "shoppingSection" || type === "laborSection") && (
                            <SectionForm data={data} onUpdate={updateData} type={type} />
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-muted/20 border-t border-border">
                <div className="flex items-center gap-2">
                    <Select
                        value={confirmationMode}
                        onValueChange={(value) => onConfirmationModeChange?.(value as "always_ask" | "auto_confirm")}
                        disabled={isModeUpdating}
                    >
                        <SelectTrigger className="h-8 w-[130px] border-border/50 bg-background text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="always_ask">Always ask</SelectItem>
                            <SelectItem value="auto_confirm">Auto-confirm CRUD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(item.functionCall?.callId ?? index)}
                        className="text-muted-foreground hover:text-foreground h-9 px-3 hover:bg-muted/50"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 shadow-sm font-medium"
                    >
                        {operationVerb} {getLabel(type)}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// --- Sub-Components ---

function TaskForm({
    data,
    onUpdate,
    teamMembers,
}: {
    data: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
    teamMembers?: Array<{ clerkUserId: string; name?: string; email?: string }>;
}) {
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        if (!data.startDate) return undefined;
        const d = new Date(String(data.startDate));
        return isValid(d) ? d : undefined;
    });
    const [endDate, setEndDate] = useState<Date | undefined>(() => {
        if (!data.endDate) return undefined;
        const d = new Date(String(data.endDate));
        return isValid(d) ? d : undefined;
    });
    const [startTime, setStartTime] = useState(startDate ? format(startDate, "HH:mm") : "11:00");
    const [endTime, setEndTime] = useState(endDate ? format(endDate, "HH:mm") : "12:00");
    const assignedToValue = data.assignedTo ? String(data.assignedTo) : "unassigned";
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    const statusValue = typeof data.status === "string" ? data.status : "todo";
    const tagsValue = Array.isArray(data.tags) ? data.tags.join(", ") : String(data.tags || "");

    useEffect(() => {
        if (startDate) {
            const [hours, minutes] = startTime.split(':').map(Number);
            const newDate = new Date(startDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== data.startDate) {
                onUpdate({ startDate: newDate.toISOString() });
            }
        }
    }, [startDate, startTime]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (endDate) {
            const [hours, minutes] = endTime.split(':').map(Number);
            const newDate = new Date(endDate);
            newDate.setHours(hours || 0, minutes || 0);
            if (newDate.toISOString() !== data.endDate) {
                onUpdate({ endDate: newDate.toISOString() });
            }
        }
    }, [endDate, endTime]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80">Title</Label>
                <Input
                    value={String(data.title || data.name || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="Enter title"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80">Description</Label>
                <Input
                    value={String(data.description || "")}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="Add description"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">Status</Label>
                    <Select
                        value={statusValue}
                        onValueChange={(value) => onUpdate({ status: value })}
                    >
                        <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">Priority</Label>
                    <Select
                        value={priorityValue}
                        onValueChange={(value) => onUpdate({ priority: value === "none" ? undefined : value })}
                    >
                        <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
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
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80">Assigned To</Label>
                <Select
                    value={assignedToValue}
                    onValueChange={(value) => {
                        const selected = teamMembers?.find((member) => member.clerkUserId === value);
                        if (value === "unassigned") {
                            onUpdate({ assignedTo: null, assignedToName: undefined });
                            return;
                        }
                        onUpdate({
                            assignedTo: value,
                            assignedToName: selected?.name || selected?.email,
                        });
                    }}
                >
                    <SelectTrigger className="bg-transparent border-border/60 hover:bg-muted/20">
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
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground/80">Tags</Label>
                <Input
                    value={tagsValue}
                    onChange={(e) => {
                        const nextTags = e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean);
                        onUpdate({ tags: nextTags.length > 0 ? nextTags : undefined });
                    }}
                    className="bg-transparent border-border/60 focus:bg-background transition-colors"
                    placeholder="e.g. meeting, painter"
                />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">Start Time</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 px-2.5 truncate border-border/60", !startDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[88px] border-border/60" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground/80">End Time</Label>
                    <div className="flex gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 px-2.5 truncate border-border/60", !endDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[88px] border-border/60" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function NoteForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</Label>
                <Input
                    value={String(data.title || "")}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Note title"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Content</Label>
                <Textarea
                    value={String(data.content || "")}
                    onChange={(e) => onUpdate({ content: e.target.value })}
                    className="min-h-[120px] resize-none border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Type your note here..."
                />
            </div>
        </div>
    );
}

function ShoppingForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const priorityValue = typeof data.priority === "string" ? data.priority : "none";
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="e.g. Milk"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</Label>
                    <Input
                        type="number"
                        value={Number(data.quantity || 1)}
                        onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price (Optional)</Label>
                    <Input
                        type="number"
                        value={Number(data.unitPrice || "")}
                        onChange={(e) => onUpdate({ unitPrice: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="0.00"
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</Label>
                    <Select
                        value={priorityValue}
                        onValueChange={(value) => onUpdate({ priority: value === "none" ? undefined : value })}
                    >
                        <SelectTrigger className="h-9 border-0 border-b border-border/50 rounded-none px-0 focus:ring-0 shadow-none">
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
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buy Before</Label>
                    <Input
                        type="date"
                        value={String(data.buyBefore || "")}
                        onChange={(e) => onUpdate({ buyBefore: e.target.value || undefined })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</Label>
                <Input
                    value={String(data.category || "")}
                    onChange={(e) => onUpdate({ category: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="e.g. Dairy"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</Label>
                    <Input
                        value={String(data.supplier || "")}
                        onChange={(e) => onUpdate({ supplier: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="Supplier name"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Section</Label>
                    <Input
                        value={String(data.sectionName || "")}
                        onChange={(e) => onUpdate({ sectionName: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="e.g. Bathroom"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dimensions</Label>
                    <Input
                        value={String(data.dimensions || "")}
                        onChange={(e) => onUpdate({ dimensions: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="e.g. 120x60 cm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catalog Number</Label>
                    <Input
                        value={String(data.catalogNumber || "")}
                        onChange={(e) => onUpdate({ catalogNumber: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="Model / SKU"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Link</Label>
                <Input
                    value={String(data.productLink || "")}
                    onChange={(e) => onUpdate({ productLink: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="https://"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Input
                    value={String(data.notes || "")}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Add details..."
                />
            </div>
        </div>
    );
}

function ContactForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const contactTypeValue = typeof data.type === "string" ? data.type : "contractor";
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</Label>
                <Input
                    value={String(data.name || "")}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="e.g. John Doe"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name</Label>
                <Input
                    value={String(data.companyName || "")}
                    onChange={(e) => onUpdate({ companyName: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Company name"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
                <Input
                    value={String(data.email || "")}
                    onChange={(e) => onUpdate({ email: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="john@example.com"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
                <Input
                    value={String(data.phone || "")}
                    onChange={(e) => onUpdate({ phone: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="+1 234 567 890"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</Label>
                <Select
                    value={contactTypeValue}
                    onValueChange={(value) => onUpdate({ type: value })}
                >
                    <SelectTrigger className="h-9 border-0 border-b border-border/50 rounded-none px-0 focus:ring-0 shadow-none">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</Label>
                <Input
                    value={String(data.address || "")}
                    onChange={(e) => onUpdate({ address: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Street address"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</Label>
                    <Input
                        value={String(data.city || "")}
                        onChange={(e) => onUpdate({ city: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="City"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Postal Code</Label>
                    <Input
                        value={String(data.postalCode || "")}
                        onChange={(e) => onUpdate({ postalCode: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="Postal code"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</Label>
                    <Input
                        value={String(data.country || "")}
                        onChange={(e) => onUpdate({ country: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="Country"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</Label>
                    <Input
                        value={String(data.website || "")}
                        onChange={(e) => onUpdate({ website: e.target.value })}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="https://"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax ID</Label>
                <Input
                    value={String(data.taxId || "")}
                    onChange={(e) => onUpdate({ taxId: e.target.value })}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Tax ID"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Textarea
                    value={String(data.notes || "")}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                    className="min-h-[100px] resize-none border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Notes"
                />
            </div>
        </div>
    );
}


// --- Helpers ---

function normalizeType(type: string): string {
    if (type.includes("task")) return "task";
    if (type.includes("note")) return "note";
    if (type.includes("shopping") && type.includes("Section")) return "shoppingSection";
    if (type.includes("shopping")) return "shopping";
    if (type.includes("labor") && type.includes("Section")) return "laborSection";
    if (type.includes("labor")) return "labor";
    if (type.includes("survey")) return "survey";
    if (type.includes("contact")) return "contact";
    return "task";
}

function getDotColor(type: string) {
    switch (type) {
        case "task": return "bg-purple-500";
        case "note": return "bg-yellow-500";
        case "shopping": return "bg-green-500";
        case "labor": return "bg-orange-500";
        case "contact": return "bg-blue-500";
        case "survey": return "bg-violet-500";
        case "shoppingSection": return "bg-emerald-500";
        case "laborSection": return "bg-amber-500";
        default: return "bg-gray-500";
    }
}

function LaborForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const [name, setName] = useState(String(data.name || ""));
    const [notes, setNotes] = useState(String(data.notes || ""));
    const [quantity, setQuantity] = useState(String(data.quantity || ""));
    const [unit, setUnit] = useState(String(data.unit || "m²"));
    const [unitPrice, setUnitPrice] = useState(String(data.unitPrice || ""));
    const [sectionName, setSectionName] = useState(String(data.sectionName || ""));

    useEffect(() => {
        onUpdate({
            name,
            notes: notes || undefined,
            quantity: quantity ? parseFloat(quantity) : undefined,
            unit: unit || undefined,
            unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
            sectionName: sectionName || undefined,
        });
    }, [name, notes, quantity, unit, unitPrice, sectionName, onUpdate]);

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Work Description
                </Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Enter work description"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Quantity
                    </Label>
                    <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="0"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="unit" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Unit
                    </Label>
                    <Input
                        id="unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                        placeholder="m², m, hours, pcs"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="unitPrice" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Unit Price (PLN)
                </Label>
                <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="0.00"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="sectionName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Section
                </Label>
                <Input
                    id="sectionName"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none"
                    placeholder="Optional section name"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Notes
                </Label>
                <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none min-h-[60px]"
                    placeholder="Additional notes"
                />
            </div>
        </div>
    );
}

function SurveyForm({ data, onUpdate }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void }) {
    const [title, setTitle] = useState(String(data.title || ""));
    const [description, setDescription] = useState(String(data.description || ""));

    useEffect(() => {
        onUpdate({
            title,
            description: description || undefined,
        });
    }, [title, description, onUpdate]);

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Survey Title
                </Label>
                <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Enter survey title"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                </Label>
                <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none min-h-[80px]"
                    placeholder="Survey description"
                />
            </div>
        </div>
    );
}

function SectionForm({ data, onUpdate, type }: { data: Record<string, unknown>; onUpdate: (u: Record<string, unknown>) => void; type: string }) {
    const [name, setName] = useState(String(data.name || ""));

    useEffect(() => {
        onUpdate({ name });
    }, [name, onUpdate]);

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {type === "shoppingSection" ? "Shopping List" : "Labor"} Section Name
                </Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-medium"
                    placeholder="Enter section name"
                />
            </div>
        </div>
    );
}

function getLabel(type: string) {
    switch (type) {
        case "task": return "Item";
        case "note": return "Note";
        case "shopping": return "Item";
        case "labor": return "Item";
        case "contact": return "Contact";
        case "survey": return "Survey";
        case "shoppingSection": return "Section";
        case "laborSection": return "Section";
        default: return "Item";
    }
}
