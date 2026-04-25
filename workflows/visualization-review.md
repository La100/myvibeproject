---
id: visualization-review
name: Visualization Review
description: Analyze an interior visualization, collect feedback, and create a shopping list from the design.
icon: image
category: analysis
requiredFileTypes:
  - image
  - pdf
fileRequired: true
estimatedMinutes: 20
steps:
  - id: upload-visualization
    name: Upload Visualization
    description: Upload a 3D visualization or interior design file (image or PDF).
    enabledTools:
      - file_upload
  - id: analyze-visualization
    name: Visualization Analysis
    prompt: |
      Analyze the uploaded interior visualization:

      1. **Room**: What type of interior is it? (living room, bedroom, kitchen, etc.)

      2. **Style**: Identify the interior style:
         - Modern/minimalist
         - Scandinavian
         - Industrial
         - Classic
         - Other

      3. **Color palette**: Describe the colors:
         - Dominant colors
         - Accent colors
         - Materials and textures

      4. **Main elements**: List visible furnishings:
         - Furniture
         - Lighting
         - Textiles
         - Plants
         - Decorations

      Present the analysis clearly.
    description: AI will analyze the visualization and identify elements.
    enabledTools:
      - analyze_image
  - id: feedback
    name: Collect Feedback
    prompt: |
      Help collect feedback on the visualization:

      1. **What works?** Ask which design elements the user likes

      2. **What should change?** Which elements need improvement:
         - Furniture layout
         - Colors
         - Lighting
         - Materials
         - Functionality

      3. **Questions for the designer**: Formulate questions/comments to pass to the designer

      Create a note with project feedback.
    description: Collect and structure design feedback.
    enabledTools:
      - create_item
  - id: shopping-list
    name: Shopping List
    prompt: |
      Based on the visualization analysis, create a list of items to purchase:

      **For each visible element provide:**
      - Name/description
      - Category (furniture, lighting, textiles, decorations)
      - Approximate price range
      - Where to search (store type: IKEA, premium, vintage, etc.)

      Split into sections:
      1. Main furniture (sofa, table, bed)
      2. Auxiliary furniture (side tables, shelves, chests)
      3. Lighting
      4. Textiles (rugs, curtains, cushions)
      5. Decorations
      6. Plants

      Add all items to the shopping list with the right sections.
    description: Create a list of furnishings to purchase.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
  - id: implementation-plan
    name: Implementation Plan
    prompt: |
      Create a task list needed to implement the visualization:

      1. **Preparation**:
         - Verify dimensions
         - Check technical feasibility
         - Order material samples

      2. **Orders**:
         - Long-lead furniture first
         - Lighting
         - Textiles and accessories

      3. **Work**:
         - Painting/wallpaper
         - Lighting installation
         - Furniture delivery and assembly
         - Styling accessories

      Create tasks with proposed dates and order.
    description: Plan project implementation.
    enabledTools:
      - create_multiple_items
---

# Visualization Review

A workflow for analyzing an interior visualization and turning the design into a concrete shopping list and task list.

## When to use

- Interior designer projects
- 3D visualizations from tools such as SketchUp or Blender
- Pinterest/Instagram inspiration you want to recreate
- Moodboards and design collages

## What you will get

1. **Detailed analysis** - Style, color palette, and element identification
2. **Collected feedback** - Notes with project comments
3. **Shopping list** - All furnishing elements with categories
4. **Action plan** - Tasks needed to implement the project

## Tips

- **Image quality**: The better the visualization quality, the more accurate the analysis
- **Multiple views**: If you have several views of the same room, upload all of them
- **Context**: After uploading, you can add budget and preference information
