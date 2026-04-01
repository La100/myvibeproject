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
    color: "text-amber-500",
  },
  manage_notes: {
    icon: Layers,
    label: "Managing Notes",
    description: "Preparing note changes",
    category: "edit",
    color: "text-amber-500",
  },
  manage_contacts: {
    icon: Layers,
    label: "Managing Contacts",
    description: "Preparing contact changes",
    category: "edit",
    color: "text-amber-500",
  },
  manage_shopping: {
    icon: Layers,
    label: "Managing Shopping",
    description: "Preparing shopping item or section changes",
    category: "edit",
    color: "text-amber-500",
  },
  manage_labor: {
    icon: Layers,
    label: "Managing Labor",
    description: "Preparing labor item or section changes",
    category: "edit",
    color: "text-amber-500",
  },
  manage_surveys: {
    icon: Layers,
    label: "Managing Surveys",
    description: "Preparing survey changes",
    category: "edit",
    color: "text-amber-500",
  },
  load_full_project_context: {
    icon: Database,
    label: "Loading Project Context",
    description: "Loading complete project data",
    category: "context",
    color: "text-purple-500",
  },
  search_items: {
    icon: Search,
    label: "Searching Items",
    description: "Looking for matching items",
    category: "search",
    color: "text-blue-500",
  },
  update_project_settings: {
    icon: Edit3,
    label: "Updating Project Settings",
    description: "Preparing project settings updates",
    category: "edit",
    color: "text-amber-500",
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
    color: "text-gray-500",
  };
}

/**
 * Get category-based styling
 */
export function getCategoryStyles(category: ToolConfig["category"]) {
  switch (category) {
    case "context":
      return {
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        borderColor: "border-purple-200 dark:border-purple-800",
        dotColor: "bg-purple-500",
      };
    case "search":
      return {
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "create":
      return {
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
        dotColor: "bg-green-500",
      };
    case "edit":
      return {
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "delete":
      return {
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800",
        dotColor: "bg-red-500",
      };
  }
}
