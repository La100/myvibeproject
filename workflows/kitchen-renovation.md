---
id: kitchen-renovation
name: Kitchen Renovation
description: A complete kitchen renovation guide, from layout planning to the shopping list.
icon: chef-hat
category: renovation
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 30
steps:
  - id: current-state
    name: Current State
    prompt: |
      Help plan the kitchen renovation. Start by collecting information about the current state:

      Ask the user about:
      1. Kitchen dimensions (length x width)
      2. Current layout (open-plan, separate kitchen, with island)
      3. Current installations (water, sewage, gas, electrical)
      4. Any elements to keep (for example window, doors, installations)
      5. Main problems with the current kitchen

      If the user uploaded a photo or floor plan, analyze it and ask follow-up questions.
    description: Analyze the current kitchen state.
    enabledTools:
      - analyze_image
  - id: layout-planning
    name: Layout Planning
    prompt: |
      Based on the collected information, propose an optimal kitchen layout:

      1. **Work triangle**: Propose fridge, sink, and stove placement
      2. **Storage zone**: Place upper and lower cabinets
      3. **Worktop space**: Estimate available work surface
      4. **Appliances**: Place large appliances (dishwasher, oven, microwave)
      5. **Ergonomics**: Check passage widths and cabinet heights

      Create a note with the proposed layout.
    description: Plan the new kitchen layout.
    enabledTools:
      - create_item
  - id: style-selection
    name: Style Selection
    prompt: |
      Help the user choose the kitchen finish style:

      1. **Cabinet fronts**:
         - Modern (smooth, matte/gloss)
         - Classic (framed)
         - Scandinavian (wood, white)

      2. **Worktop**:
         - Laminate (economy)
         - Quartz composite (durable)
         - Wood (natural, requires care)
         - Natural stone (premium)

      3. **Tiles/wall above worktop**:
         - Ceramic tiles
         - Tempered glass
         - Wall panel

      Save the user's choices as a specification note.
    description: Choose style and finish materials.
    enabledTools:
      - create_item
  - id: appliances
    name: Appliances
    prompt: |
      Prepare a kitchen appliance list:

      1. **Essential**:
         - Hob (induction/gas/electric)
         - Oven (built-in/freestanding)
         - Dishwasher
         - Fridge (built-in/freestanding)
         - Range hood

      2. **Optional**:
         - Microwave
         - Coffee machine
         - Wine cooler

      Add selected appliances to the shopping list with estimated prices.
    description: Plan kitchen appliances.
    enabledTools:
      - create_multiple_items
  - id: materials-budget
    name: Materials and Budget
    prompt: |
      Prepare a complete materials list and estimate the budget:

      1. Kitchen furniture (cabinets, fronts, hardware)
      2. Worktop and backsplash
      3. Sink and faucet
      4. Lighting (main + under-cabinet)
      5. Tiles/wall panels
      6. Paint/wallpaper, if applicable
      7. Installation materials (electrical, plumbing)

      Provide estimated costs for each category and add them to the shopping list.
      Finish with the total budget summary.
    description: Create a complete shopping list with budget.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
  - id: renovation-tasks
    name: Renovation Tasks
    prompt: |
      Create a kitchen renovation task list in the right order:

      1. **Demolition** (1-2 days):
         - Remove old furniture
         - Protect floors and other rooms

      2. **Installations** (3-5 days):
         - Electrical work (new points, lighting)
         - Plumbing work (relocations, new connections)

      3. **Wall finishes** (2-3 days):
         - Skim coat/plaster
         - Painting
         - Tiles/panel above worktop

      4. **Furniture installation** (1-2 days):
         - Lower and upper cabinets
         - Worktop

      5. **Appliances and finishing** (1-2 days):
         - Connect appliances
         - Install lighting
         - Cleaning

      Create tasks with assigned dates.
    description: Generate a renovation work schedule.
    enabledTools:
      - create_multiple_items
---

# Kitchen Renovation

A complete guide that walks you through the whole kitchen renovation planning process.

## What you will get

1. **Current state** - Analysis of what you have and what you want to change
2. **Layout planning** - Optimal element placement
3. **Style selection** - Materials and finishes
4. **Appliances** - List of required equipment
5. **Materials and budget** - Complete shopping list with costs
6. **Work schedule** - Tasks in the right order

## Tips

- **Photos help**: Upload a photo of the current kitchen or a floor plan so AI can advise better
- **Dimensions matter**: The more accurate the dimensions, the more precise the estimates
- **Budget**: Keep an approximate budget in mind to help select materials

## Estimated costs

- **Budget renovation**: 15,000 - 30,000 PLN
- **Mid-range standard**: 30,000 - 50,000 PLN
- **Premium renovation**: 50,000+ PLN
