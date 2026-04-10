import type { VisualizationSuggestion } from "./types";

export const VISUALIZATION_PLACEHOLDER =
  "Describe the space, mood, materials, lighting, and camera angle...";
export const VISUALIZATION_MAX_FILES = 10;
export const VISUALIZATION_MAX_FILE_SIZE = 20 * 1024 * 1024;

export const VISUALIZATION_SUGGESTIONS: VisualizationSuggestion[] = [
  {
    title: "Quiet Luxury Living Room",
    description: "Travertine, walnut, sculptural lighting, and warm golden-hour atmosphere.",
    text:
      "Photorealistic editorial interior visualization of a quiet luxury living room with limewashed walls, honed travertine flooring, fluted walnut millwork, an oversized cream modular sofa, a smoked glass coffee table, sculptural brushed metal lighting, sheer curtains, restrained styling, warm late-afternoon sunlight, long soft shadows, 24mm lens, ultra-detailed materials, premium residential atmosphere.",
    image: "/VISUALPROMPTS/visualization-1775837806303.png",
  },
  {
    title: "Material Storyboard",
    description: "A polished palette board with leather, walnut, boucle, stone, and steel.",
    text:
      "Create a refined architectural material board for a warm modern interior: saddle leather, dark walnut, ivory boucle, honed travertine, brushed stainless steel, and soft off-white plaster. Arrange the samples as a clean editorial flat lay with balanced negative space, soft studio shadows, realistic texture detail, luxury presentation, and crisp high-resolution material fidelity.",
    image: "/VISUALPROMPTS/visualization-1775837826519.png",
  },
  {
    title: "Sculptural Reading Corner",
    description: "A hero-shot vignette built around an iconic chair and quiet daylight.",
    text:
      "Photorealistic interior vignette of a sculptural reading corner with an iconic tan leather lounge chair, textured plaster wall, pale stone pedestal, brushed metal lamp, sheer curtains, and warm oak flooring. Compose it like a design magazine hero shot with soft morning daylight, a 50mm lens feel, museum-like styling, subtle imperfections, and rich tactile material realism.",
    image: "/VISUALPROMPTS/visualization-1775837847739.png",
  },
  {
    title: "Loft From Sketch",
    description: "Turn a technical line drawing into a warm, believable loft render.",
    text:
      "Transform an architectural line drawing of a compact loft kitchen and living area into a photorealistic interior render. Preserve the original layout and proportions, then add natural oak cabinetry, cream stone countertops, matte plaster walls, black metal accents, soft indirect lighting, realistic reflections, styled shelves, and lived-in warmth. Keep it high-end, spatially accurate, and clearly rooted in the uploaded sketch.",
    image: "/VISUALPROMPTS/visualization-1775837869786.png",
  },
  {
    title: "Boutique Spa Bathroom",
    description: "Tadelakt, travertine, brushed nickel, and soft skylight serenity.",
    text:
      "Photorealistic spa bathroom visualization with warm beige tadelakt walls, large-format travertine slabs, a monolithic stone vanity, brushed nickel fixtures, a freestanding tub, linen towels, and soft greenery. Illuminate the room with diffused skylight and hidden cove lighting, keep the styling minimal and calming, and emphasize tactile surfaces, subtle reflections, and quiet five-star hospitality mood.",
    image: "/VISUALPROMPTS/visualization-1775837893016.png",
  },
  {
    title: "Monochrome Axonometric",
    description: "A graphic apartment concept diagram with sharp white lines on black.",
    text:
      "Create a minimalist axonometric architectural diagram of a compact apartment on a matte black background with crisp white wall outlines, clean window and door cutouts, subtle depth, and precise geometry. Keep the composition graphic, premium, and editorial, with sharp linework, no labels, and a polished concept-board feel.",
    image: "/VISUALPROMPTS/visualization-1775837915488.png",
  },
];
