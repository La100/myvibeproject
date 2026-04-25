---
id: bathroom-renovation
name: Bathroom Renovation
description: Plan a bathroom renovation step by step, from demolition to finishing.
icon: bath
category: renovation
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 30
steps:
  - id: current-bathroom
    name: Current Bathroom
    prompt: |
      Start planning the bathroom renovation. Collect the following information:

      1. **Dimensions**: Bathroom dimensions (length x width x height)
      2. **Current fixtures**: What is there now? (bathtub/shower, toilet, sink, washing machine?)
      3. **Installations**: Do you know where the sewage and water risers are?
      4. **Technical condition**: Any problems (moisture, mold, leaks)?
      5. **What stays?**: Will any current fixtures remain?

      If the user uploaded a photo or floor plan, analyze it and ask additional questions.
    description: Describe the current bathroom.
    enabledTools:
      - analyze_image
  - id: new-layout
    name: New Layout
    prompt: |
      Based on the information, propose a bathroom layout:

      1. **Bathing zone**:
         - Bathtub (standard, corner, freestanding)
         - Shower (walk-in, cabin, shower tray)

      2. **Toilet zone**:
         - Wall-hung or standing toilet
         - Is a bidet or washlet needed?

      3. **Sink zone**:
         - Sink size
         - Vanity cabinet
         - Mirror (standard or with lighting)

      4. **Storage and washing machine**:
         - Cabinets
         - Washing machine in the bathroom or elsewhere?

      Create a note with the proposed layout.
    description: Plan the new bathroom layout.
    enabledTools:
      - create_item
  - id: finishes
    name: Finishes
    prompt: |
      Choose finish materials:

      1. **Floor tiles**:
         - Size and format
         - Anti-slip class
         - Color/style

      2. **Wall tiles**:
         - Tile height (to ceiling, 2 m, half wall)
         - Feature wall
         - Grout color

      3. **Paint**:
         - Bathroom paint for ceiling/walls

      4. **Lighting**:
         - Main lighting
         - Mirror lighting
         - Warm/natural light

      Save the finish specification.
    description: Choose tiles and finishes.
    enabledTools:
      - create_item
  - id: fixtures
    name: Fixtures and Sanitaryware
    prompt: |
      Prepare a fixtures and sanitaryware list:

      - Bathtub or shower
      - Toilet and flush frame
      - Sink
      - Faucet
      - Shower set
      - Rain shower / hand shower
      - Drains
      - Mirror
      - Bathroom cabinet
      - Accessories (towel rails, toilet paper holder)

      Add everything to the shopping list by category.
    description: Choose fixtures and sanitaryware.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
  - id: building-materials
    name: Building Materials
    prompt: |
      List construction materials needed for the renovation:

      **Substrate preparation**:
      - Tile adhesive (kg per m2)
      - Grout (color, quantity)
      - Waterproofing (for shower/bathtub)
      - Leveling mortar if needed

      **Installations**:
      - Pipes and fittings
      - WC frame if wall-hung
      - Electrical wires (cross-section)

      **Finishing**:
      - Silicone
      - Paint if the ceiling is painted
      - Profiles and trims

      Calculate quantities based on dimensions and add them to the shopping list.
    description: Building materials list.
    enabledTools:
      - create_multiple_items
  - id: schedule
    name: Work Schedule
    prompt: |
      Create a detailed work schedule:

      **Stage 1: Demolition** (1-2 days)
      - Remove old sanitaryware
      - Remove tiles
      - Dispose of rubble

      **Stage 2: Installations** (2-4 days)
      - Plumbing changes
      - Electrical work (lighting, fan, outlets)
      - WC frame installation

      **Stage 3: Substrate preparation** (1-2 days)
      - Level walls
      - Waterproofing
      - Drying

      **Stage 4: Tiles** (3-5 days)
      - Install wall tiles
      - Install floor tiles
      - Grouting

      **Stage 5: Installation and finishing** (2-3 days)
      - Final sanitaryware installation
      - Furniture and accessories installation
      - Cleaning and handover

      Create tasks with deadlines.
    description: Plan bathroom renovation work.
    enabledTools:
      - create_multiple_items
---

# Bathroom Renovation

A complete wizard that helps you plan a bathroom renovation from start to finish.

## Process stages

1. **Condition assessment** - Analysis of the current bathroom and your needs
2. **New layout** - Optimal placement of elements
3. **Finishes** - Selection of tiles and materials
4. **Fixtures** - Sanitaryware and fittings
5. **Materials** - Construction materials list
6. **Schedule** - Work order and timeline

## Important information

### Installations

A bathroom contains many installations. Make sure that:
- You have access to water/sewage risers or know where they are
- Ventilation works properly
- Electrical work complies with bathroom safety zones

### Waterproofing

**CRITICAL**: Shower and bathtub zones MUST be waterproofed. This is not a place to save money.

### Estimated costs

- **Small bathroom (3-4 m2)**: 12,000 - 20,000 PLN
- **Medium bathroom (5-7 m2)**: 18,000 - 35,000 PLN
- **Large bathroom (8 m2+)**: 30,000 - 60,000 PLN

*Labor + materials, excluding premium fixtures and sanitaryware*

## Tips

- **Photos**: Upload photos of the current bathroom to support planning
- **Dimensions**: Accurate dimensions are critical for material calculations
- **Budget**: Leave a 15-20% reserve for unexpected expenses
