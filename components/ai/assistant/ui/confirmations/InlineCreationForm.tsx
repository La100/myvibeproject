"use client";

import { useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PendingContentItem } from "../../data/types";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  ContactForm,
  LaborForm,
  NoteForm,
  ProjectSettingsForm,
  SectionForm,
  ShoppingForm,
  SurveyForm,
  TaskForm,
  getDotColor,
  getLabel,
  normalizeType,
} from "./forms";

interface InlineCreationFormProps {
  item: PendingContentItem;
  index: number;
  onConfirm: (index: number | string) => Promise<void>;
  onReject: (index: number | string) => void | Promise<void>;
  onUpdate: (index: number | string, updates: Partial<PendingContentItem>) => void;
}

export function InlineCreationForm({
  item,
  index,
  onConfirm,
  onReject,
  onUpdate,
}: InlineCreationFormProps) {
  const { project } = useProject();
  const projectCurrency =
    typeof project.currency === "string" && project.currency.trim().length > 0
      ? project.currency.trim()
      : undefined;
  const type = normalizeType(item.type);

  const operation = item.operation || "create";
  const isEditOperation = operation === "edit" || operation === "bulk_edit";
  const operationVerb = operation === "delete" ? "Delete" : (operation === "edit" || operation === "bulk_edit") ? "Update" : "Create";

  const projectSettingsDefaults: Record<string, unknown> = type === "projectSettings"
    ? {
      name: project.name || "",
      description: project.description || "",
      status: project.status || "planning",
      currency: project.currency || "PLN",
      customer: project.customer || "",
      location: project.location || "",
      budget: project.budget,
      coverImageUrl: project.coverImageUrl || "",
    }
    : {};

  const payloadData = (item.data || {}) as Record<string, unknown>;
  const payloadUpdates = (item.updates || {}) as Record<string, unknown>;
  const payloadOriginal = (item.originalItem || {}) as Record<string, unknown>;

  const baseData = (() => {
    if (isEditOperation && type === "projectSettings") {
      const { projectId: _projectId, ...dataWithoutProjectId } = payloadData;
      void _projectId;
      return {
        ...projectSettingsDefaults,
        ...payloadOriginal,
        ...dataWithoutProjectId,
        ...payloadUpdates,
      };
    }

    if (isEditOperation && item.originalItem) {
      return { ...payloadOriginal, ...payloadUpdates };
    }

    if (type === "projectSettings") {
      const { projectId: _projectId, ...dataWithoutProjectId } = payloadData;
      void _projectId;
      return {
        ...projectSettingsDefaults,
        ...dataWithoutProjectId,
      };
    }

    return payloadData;
  })();

  const data = baseData;
  const title = typeof data.title === "string" ? data.title : undefined;
  const name = typeof data.name === "string" ? data.name : undefined;
  const description = typeof data.description === "string" ? data.description : undefined;
  const content = typeof data.content === "string" ? data.content : undefined;
  const displayTitle = title || name || "Untitled";
  const displayDescription = description || content;
  const teamMembers = useQuery(
    apiAny.teams.getTeamMembers,
    project ? { teamId: project.teamId } : "skip",
  );

  const handleConfirm = async () => {
    await onConfirm(item.clientId ?? item.functionCall?.callId ?? index);
  };

  const updateData = (updates: Record<string, unknown>) => {
    const id = item.clientId ?? item.functionCall?.callId ?? index;
    if (isEditOperation) {
      onUpdate(id, {
        updates: { ...(item.updates || {}), ...updates },
      });
    } else {
      onUpdate(id, {
        data: { ...data, ...updates },
      });
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[48vh]">
      <div className="px-4 py-2.5 border-b border-border/70 bg-card flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className={cn("w-2 h-2 rounded-full", getDotColor(type))} />
          <span>{operationVerb} {getLabel(type)}</span>
        </div>
        {isEditOperation && displayTitle && (
          <span className="text-xs text-muted-foreground truncate max-w-[220px]">{displayTitle}</span>
        )}
      </div>

      <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {operation === "delete" ? (
          <div className="space-y-3">
            <div className="text-base font-medium">{displayTitle}</div>
            {displayDescription && (
              <div className="text-sm text-muted-foreground">{displayDescription}</div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2 border-b border-border/60 pb-3">
              <div className="text-base font-medium">{displayTitle}</div>
              {displayDescription && (
                <div className="text-sm text-muted-foreground line-clamp-2">{displayDescription}</div>
              )}
            </div>

            {type === "task" && <TaskForm data={data} onUpdate={updateData} teamMembers={teamMembers} />}
            {type === "note" && <NoteForm data={data} onUpdate={updateData} />}
            {type === "shopping" && <ShoppingForm data={data} onUpdate={updateData} currency={projectCurrency} />}
            {type === "labor" && <LaborForm data={data} onUpdate={updateData} currency={projectCurrency} />}
            {type === "contact" && <ContactForm data={data} onUpdate={updateData} />}
            {type === "survey" && <SurveyForm data={data} onUpdate={updateData} />}
            {type === "projectSettings" && <ProjectSettingsForm data={data} onUpdate={updateData} />}
            {(type === "shoppingSection" || type === "laborSection") && (
              <SectionForm data={data} onUpdate={updateData} type={type} />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end px-4 py-2.5 bg-card border-t border-border/70">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReject(item.clientId ?? item.functionCall?.callId ?? index)}
            className="text-muted-foreground hover:text-foreground h-8 px-3 hover:bg-muted/30"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="bg-foreground text-background hover:bg-foreground/90 h-8 px-4 shadow-sm font-medium"
          >
            {operationVerb} {getLabel(type)}
          </Button>
        </div>
      </div>
    </div>
  );
}
