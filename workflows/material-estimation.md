---
id: material-estimation
name: Material Estimation
description: Calculate construction material quantities and costs based on room dimensions.
icon: calculator
category: estimation
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 20
steps:
  - id: room-info
    name: Room Information
    prompt: |
      Collect room information for material estimation:

      1. Room length in meters
      2. Room width in meters
      3. Room height (standard 2.5 m or 2.7 m)
      4. Number and size of windows
      5. Number and size of doors
      6. Are there any niches, sloped ceilings, or unusual elements?

      If the user uploaded a floor plan or photo, analyze it and ask for missing details.
    description: Collect dimensions and room details.
    enabledTools:
      - analyze_image
  - id: work-scope
    name: Work Scope
    prompt: |
      What work are you planning? Select all that apply:

      **Walls:**
      - [ ] Painting
      - [ ] Skim coating/filling
      - [ ] Wallpaper
      - [ ] Ceramic tiles
      - [ ] Wall panels

      **Floor:**
      - [ ] Laminate/wood panels
      - [ ] Parquet
      - [ ] Tiles
      - [ ] Carpet
      - [ ] Self-leveling screed

      **Ceiling:**
      - [ ] Painting
      - [ ] Suspended ceiling

      **Installations:**
      - [ ] Electrical (how many points?)
      - [ ] Lighting (how many sources?)

      Save the work scope as a note.
    description: Define which work will be performed.
    enabledTools:
      - create_item
  - id: quantity-calculation
    name: Quantity Calculations
    prompt: |
      Based on dimensions and work scope, calculate required quantities:

      **Formulas used:**
      - Wall area = (2 x length + 2 x width) x height - windows - doors
      - Floor area = length x width
      - Ceiling area = length x width

      **For materials:**
      - Skim coat: about 1.2 kg/m2 (2 mm thickness)
      - Tile adhesive: about 4 kg/m2
      - Grout: about 0.5 kg/m2 (for 30 x 30 tiles)
      - Panels: +10% cutting waste
      - Tiles: +15% cutting waste and reserve

      Present detailed calculations with quantities.
    description: AI will calculate required material quantities.
    enabledTools:
      - create_item
  - id: shopping-list
    name: Shopping List with Prices
    prompt: |
      Create a shopping list with estimated prices:

      For each material provide:
      - Quantity including reserve
      - Unit price (economy/mid-range/premium range)
      - Estimated total cost

      Categories:
      1. Basic materials (paint, skim coats, adhesives)
      2. Finishes (panels, tiles, trims)
      3. Tools and accessories (rollers, trowels, tapes)
      4. Installations, if applicable

      Finish with a total material cost summary.

      Add everything to the shopping list split into sections.
    description: Materials list with prices and cost estimate.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
---

# Material Estimation

A quick calculator for construction material quantities and costs.

## How it works

1. Enter room dimensions
2. Select the work scope
3. AI calculates material quantities
4. You receive a shopping list with prices

## Calculation accuracy

Calculations include:
- **Cutting reserve**: 10-15% depending on material
- **Technical losses**: Allowances for drying and absorption
- **Practical packaging**: Rounding to standard package sizes

## Prices

Prices are indicative for the Polish market and include:
- **Economy**: DIY stores, basic brands
- **Mid-range**: Wholesalers, better brands
- **Premium**: Professional products

## Tips

- **Accurate dimensions**: The more accurate the dimensions, the more precise the calculations
- **Openings**: Remember windows and doors - they reduce wall material quantities
- **Reserve**: Always buy a little more - it is better to have spare material than to buy from another batch later

## Typical material use

| Material | Use per m2 |
|---|---|
| Paint | 0.1-0.15 l |
| Skim coat | 1.0-1.5 kg |
| Tile adhesive | 3-5 kg |
