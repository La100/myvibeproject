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

export interface ToolConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  category: "context" | "search" | "create" | "edit" | "delete";
  color: string;
}

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
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

/**
 * Get tool configuration by name
 * Returns a default config if tool is not found
 */
export function getToolConfig(toolName: string): ToolConfig {
  const config = TOOL_CONFIGS[toolName];
  if (config) return config;

  return {
    icon: Database,
    label: toolName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `Executing ${toolName}`,
    category: "context",
    color: "text-muted-foreground",
  };
}

/**
 * Get category-based styling
 */
export function getCategoryStyles(category: ToolConfig["category"]) {
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
