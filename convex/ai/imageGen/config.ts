export const IMAGE_GENERATION_CONFIG = {
  // Stable lower-cost model for team-wide visualization quotas
  MODEL_ID: "gemini-2.5-flash-image",

  // System prompt for architectural visualizations
  SYSTEM_PROMPT: `You are an expert architectural visualization artist. When generating images:
- Create photorealistic, high-quality architectural renders
- Pay attention to lighting, materials, and atmosphere
- Include realistic textures and environmental details
- Consider time of day, weather, and seasonal elements
- Ensure proper scale and perspective
- Add subtle details like furniture, plants, and people where appropriate
- When user asks to modify or refine an image, keep the same general style but apply the requested changes`,

  // Generation parameters
  GENERATION_CONFIG: {
    responseModalities: ["TEXT", "IMAGE"],
  },
};
