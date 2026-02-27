export const IMAGE_GENERATION_CONFIG = {
  // Nano Banana Pro model (Gemini 3 Pro Image Preview)
  MODEL_ID: "gemini-3-pro-image-preview",

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
    imageConfig: {
      imageSize: "4K", // Options: '2K', '4K'
    },
  },
};
