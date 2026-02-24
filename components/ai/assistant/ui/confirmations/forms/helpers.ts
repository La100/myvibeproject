export function normalizeType(type: string): string {
  if (type.includes("projectSettings") || type.includes("project_settings")) return "projectSettings";
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

export function getDotColor(_type?: string): string {
  void _type;
  return "bg-emerald-500";
}

export function getLabel(type: string): string {
  switch (type) {
    case "note":
      return "Note";
    case "contact":
      return "Contact";
    case "survey":
      return "Survey";
    case "projectSettings":
      return "Project Settings";
    case "shoppingSection":
    case "laborSection":
      return "Section";
    default:
      return "Item";
  }
}
