---
id: floor-plan-analysis
name: Floor Plan Analysis
description: Comprehensive floor plan analysis with room identification, dimensions, and renovation task generation.
icon: home
category: analysis
requiredFileTypes:
  - image
  - pdf
fileRequired: true
estimatedMinutes: 15
steps:
  - id: upload-plan
    name: Upload Floor Plan
    description: Upload an apartment floor plan file (photo, scan, or PDF).
    enabledTools:
      - file_upload
  - id: room-analysis
    name: Room Analysis
    prompt: |
      Analyze the uploaded floor plan in detail.

      1. **Rooms**: List all visible rooms with approximate dimensions if the scale is visible.

      2. **Functional layout**: Evaluate the room layout for:
         - Circulation between rooms
         - Access to natural light
         - Functionality for a family
         - Storage potential

      3. **Potential issues**: Identify:
         - Narrow passages
         - Missing ventilation
         - Awkward functional connections

      Present the analysis as a clear bullet list.
    description: Analyze rooms, layout, and potential issues.
    enabledTools:
      - analyze_image
      - create_item
  - id: renovation-scope
    name: Renovation Scope
    prompt: |
      Based on the previous floor plan analysis, help the user define the renovation scope:

      1. Ask which rooms should be renovated
      2. Propose typical work for each selected room:
         - Walls (painting, wallpaper, panels)
         - Floors (replacement, sanding)
         - Installations (electrical, plumbing)
         - Doors/windows
         - Built-in furniture

      Create an initial task list in the project.
    description: Define the work scope for selected rooms.
    enabledTools:
      - create_multiple_items
  - id: materials-list
    name: Materials List
    prompt: |
      Based on the defined renovation scope, prepare an initial material list:

      1. List required materials for each room and work type
      2. Estimate quantities based on approximate dimensions from the floor plan
      3. Split materials into categories (construction, finishes, electrical, plumbing)

      Add materials to the project shopping list with the right sections.
    description: Generate a list of construction and finish materials.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
  - id: schedule
    name: Work Schedule
    prompt: |
      Create a proposed renovation schedule:

      1. Arrange tasks in a logical order (for example, installations first, finishes later)
      2. Estimate the duration of each phase
      3. Include drying, ventilation, and other waiting times
      4. Propose a weekly phase breakdown

      Update dates in previously created tasks to reflect the schedule.
    description: Plan the order and timing of work.
    enabledTools:
      - update_multiple_items
---

# Floor Plan Analysis

This workflow helps you analyze an apartment floor plan and plan a renovation.

## What you will get

- A detailed analysis of rooms and functionality
- A renovation task list matched to your floor plan
- A materials list with estimated quantities
- A proposed work schedule

## Tips

- **Floor plan quality**: Make sure the plan is readable and, where possible, includes dimensions or a scale
- **Format**: Photos (JPG, PNG), scans, and PDF files are supported
- **Orientation**: If the plan is rotated, AI can handle it, but uploading a correctly oriented file works better

## Estimated time

The full workflow takes about 15-20 minutes, depending on apartment complexity and your answers.
