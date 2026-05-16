/**
 * Tool Icons & Labels for AI Assistant
 *
 * Maps tool names to icons and human-readable labels
 * for the step-by-step UI display.
 */

import {
  Database,
  Search,
  Layers,
  Edit3,
  type LucideIcon,
} from "lucide-react";
import type { useI18n } from "@/lib/i18n";

export interface ToolConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  category: "context" | "search" | "create" | "edit" | "delete";
  color: string;
}

type TranslationFn = ReturnType<typeof useI18n>["t"];
type ToolCopyKey =
  | "manageTasksLabel"
  | "manageTasksDescription"
  | "manageNotesLabel"
  | "manageNotesDescription"
  | "manageContactsLabel"
  | "manageContactsDescription"
  | "managePaymentsLabel"
  | "managePaymentsDescription"
  | "manageShoppingLabel"
  | "manageShoppingDescription"
  | "manageLaborLabel"
  | "manageLaborDescription"
  | "manageSurveysLabel"
  | "manageSurveysDescription"
  | "loadProjectLabel"
  | "loadProjectDescription"
  | "searchItemsLabel"
  | "searchItemsDescription"
  | "scrapeProductLabel"
  | "scrapeProductDescription"
  | "updateProjectSettingsLabel"
  | "updateProjectSettingsDescription";

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  manage_tasks: {
    icon: Layers,
    label: "Managing Tasks",
    description: "Preparing task changes",
    category: "edit",
    color: "text-primary",
  },
  manage_notes: {
    icon: Layers,
    label: "Managing Notes",
    description: "Preparing note changes",
    category: "edit",
    color: "text-primary",
  },
  manage_contacts: {
    icon: Layers,
    label: "Managing Contacts",
    description: "Preparing contact changes",
    category: "edit",
    color: "text-primary",
  },
  manage_payments: {
    icon: Layers,
    label: "Managing Payments",
    description: "Preparing invoice and payment changes",
    category: "edit",
    color: "text-primary",
  },
  manage_shopping: {
    icon: Layers,
    label: "Managing Shopping",
    description: "Preparing shopping item or section changes",
    category: "edit",
    color: "text-primary",
  },
  manage_labor: {
    icon: Layers,
    label: "Managing Labor",
    description: "Preparing labor item or section changes",
    category: "edit",
    color: "text-primary",
  },
  manage_surveys: {
    icon: Layers,
    label: "Managing Surveys",
    description: "Preparing survey changes",
    category: "edit",
    color: "text-primary",
  },
  load_full_project_context: {
    icon: Database,
    label: "Loading Project Context",
    description: "Loading complete project data",
    category: "context",
    color: "text-muted-foreground",
  },
  search_items: {
    icon: Search,
    label: "Searching Items",
    description: "Looking for matching items",
    category: "search",
    color: "text-primary",
  },
  scrape_shopping_product: {
    icon: Search,
    label: "Scraping Product",
    description: "Importing product details from a product page",
    category: "search",
    color: "text-primary",
  },
  update_project_settings: {
    icon: Edit3,
    label: "Updating Project Settings",
    description: "Preparing project settings updates",
    category: "edit",
    color: "text-primary",
  },
};

const TOOL_COPY_KEYS: Record<
  keyof typeof TOOL_CONFIGS,
  { label: ToolCopyKey; description: ToolCopyKey }
> = {
  manage_tasks: {
    label: "manageTasksLabel",
    description: "manageTasksDescription",
  },
  manage_notes: {
    label: "manageNotesLabel",
    description: "manageNotesDescription",
  },
  manage_contacts: {
    label: "manageContactsLabel",
    description: "manageContactsDescription",
  },
  manage_payments: {
    label: "managePaymentsLabel",
    description: "managePaymentsDescription",
  },
  manage_shopping: {
    label: "manageShoppingLabel",
    description: "manageShoppingDescription",
  },
  manage_labor: {
    label: "manageLaborLabel",
    description: "manageLaborDescription",
  },
  manage_surveys: {
    label: "manageSurveysLabel",
    description: "manageSurveysDescription",
  },
  load_full_project_context: {
    label: "loadProjectLabel",
    description: "loadProjectDescription",
  },
  search_items: {
    label: "searchItemsLabel",
    description: "searchItemsDescription",
  },
  scrape_shopping_product: {
    label: "scrapeProductLabel",
    description: "scrapeProductDescription",
  },
  update_project_settings: {
    label: "updateProjectSettingsLabel",
    description: "updateProjectSettingsDescription",
  },
};

/**
 * Get tool configuration by name
 * Returns a default config if tool is not found
 */
function getToolConfig(toolName: string, t?: TranslationFn): ToolConfig {
  const config = TOOL_CONFIGS[toolName];
  const copyKeys = TOOL_COPY_KEYS[toolName];
  if (config) {
    if (!t || !copyKeys) return config;
    return {
      ...config,
      label: t("toolIcons", copyKeys.label),
      description: t("toolIcons", copyKeys.description),
    };
  }

  return {
    icon: Database,
    label: toolName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description: t
      ? t("toolIcons", "executingTool", { tool: toolName })
      : `Executing ${toolName}`,
    category: "context",
    color: "text-muted-foreground",
  };
}

/**
 * Get category-based styling
 */
function getCategoryStyles(category: ToolConfig["category"]) {
  switch (category) {
    case "context":
      return {
        bgColor: "bg-muted/40",
        borderColor: "border-border/70",
        dotColor: "bg-muted-foreground",
      };
    case "search":
      return {
        bgColor: "bg-primary/10",
        borderColor: "border-primary/20",
        dotColor: "bg-primary",
      };
    case "create":
      return {
        bgColor: "bg-secondary/50",
        borderColor: "border-border/70",
        dotColor: "bg-secondary-foreground",
      };
    case "edit":
      return {
        bgColor: "bg-accent/50",
        borderColor: "border-border/70",
        dotColor: "bg-accent-foreground",
      };
    case "delete":
      return {
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/20",
        dotColor: "bg-destructive",
      };
  }
}

export { TOOL_CONFIGS, getCategoryStyles, getToolConfig };
