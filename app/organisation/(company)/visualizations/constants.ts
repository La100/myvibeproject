import type { VisualizationSuggestion } from "./types";

export const VISUALIZATION_PLACEHOLDER = "Describe your visualization...";
export const VISUALIZATION_MAX_FILES = 10;
export const VISUALIZATION_MAX_FILE_SIZE = 20 * 1024 * 1024;

export const VISUALIZATION_SUGGESTIONS: VisualizationSuggestion[] = [
  {
    text: "Minimalist Scandinavian living room with natural oak floors",
    image: "/samplevisuals/sample1.jpeg",
  },
  {
    text: "Japanese zen garden with stone pathway and bamboo",
    image: "https://images.unsplash.com/photo-1585938389612-a552a28d6914?q=80&w=800&auto=format&fit=crop",
  },
  {
    text: "Industrial loft conversion with exposed steel beams",
    image: "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=800&auto=format&fit=crop",
  },
  {
    text: "Mediterranean terrace with olive trees at sunset",
    image: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?q=80&w=800&auto=format&fit=crop",
  },
];
