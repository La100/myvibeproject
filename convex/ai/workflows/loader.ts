/**
 * Workflow Loader
 * 
 * Loads and parses workflow definitions from .md files.
 * Since Convex actions run on the server, we need to import workflows
 * at build time or load them from storage.
 * 
 * This module provides:
 * 1. Pre-loaded workflow definitions (imported at build time)
 * 2. Functions to get workflow metadata and full definitions
 */

import type {
  WorkflowDefinition,
  WorkflowMetadata,
  WorkflowStep,
  WorkflowIcon,
  WorkflowFileType,
} from "./types";

// ============================================
// WORKFLOW DEFINITIONS
// ============================================

/**
 * Pre-defined workflows loaded at build time
 * In a production app, these could be loaded from:
 * - File storage (Convex storage)
 * - A dedicated table in the database
 * - External CMS
 */
export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "floor-plan-analysis",
    name: "Apartment Floor Plan Analysis",
    description: "Comprehensive floor plan analysis with room identification, dimensions, and a generated renovation task list.",
    icon: "floor-plan" as WorkflowIcon,
    category: "analysis",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: true,
    estimatedMinutes: 15,
    steps: [
      {
        id: "upload",
        name: "Upload Floor Plan",
        prompt: null,
        requiresUpload: true,
        description: "Upload an apartment floor plan file (photo, scan, or PDF).",
      },
      {
        id: "room-analysis",
        name: "Room Analysis",
        prompt: `Analyze the uploaded apartment floor plan and identify:

1. **Rooms**: List all visible rooms with approximate dimensions (if scale is visible).

2. **Functional Layout**: Evaluate the layout in terms of:
   - Movement between rooms
   - Access to natural light
   - Family usability

3. **Potential Issues**: Identify likely issues such as:
   - Tight passageways
   - Missing ventilation
   - Awkward functional connections

Present your analysis in a clear bullet-point format.`,
        description: "AI will analyze the plan and identify the rooms.",
        enabledTools: ["create_note"],
      },
      {
        id: "renovation-scope",
        name: "Renovation Scope",
        prompt: `Based on the previous floor plan analysis, help the user define renovation scope:

1. Ask which rooms should be renovated
2. Suggest typical work for each selected room:
   - Walls (painting, wallpaper, wall panels)
   - Floors (replacement, refinishing)
   - Installations (electrical, plumbing)
   - Joinery (doors, windows)

Create an initial task list in the project.`,
        description: "Define renovation scope for selected rooms.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
      {
        id: "material-list",
        name: "Material List",
        prompt: `Based on the defined renovation scope, prepare an initial material list:

1. For each room and work type, list required materials
2. Estimate quantities using approximate dimensions from the plan
3. Group materials into categories (construction, finishing, electrical, plumbing)

Add materials to the project shopping list with appropriate sections.`,
        description: "Generate a list of construction and finishing materials.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "schedule",
        name: "Schedule",
        prompt: `Create a proposed renovation schedule:

1. Order tasks in a logical sequence (for example: installations before finishes)
2. Estimate the duration of each phase
3. Include drying/curing and ventilation time where needed
4. Propose weekly phase breakdowns

Update dates in previously created tasks to match this schedule.`,
        description: "Plan task order and timelines.",
        enabledTools: ["edit_task", "edit_multiple_tasks"],
      },
    ],
    content: `# Apartment Floor Plan Analysis

This workflow helps you comprehensively analyze an apartment floor plan and plan a renovation.

## What you get
- Detailed analysis of rooms and functional layout
- Renovation task list tailored to your floor plan
- Material list with estimated quantities
- Suggested work schedule`,
  },
  {
    id: "kitchen-renovation",
    name: "Kitchen Renovation",
    description: "Complete kitchen renovation guide, from layout planning to shopping list.",
    icon: "kitchen" as WorkflowIcon,
    category: "renovation",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 20,
    steps: [
      {
        id: "current-state",
        name: "Current State",
        prompt: `Let's plan the kitchen renovation. Start by gathering current-state details:

Ask the user about:
1. Kitchen dimensions (length x width)
2. Current layout (open kitchen, separate room, with island)
3. Main pain points in the current kitchen
4. Elements that must stay (for example window, doors, installations)

If the user uploaded a photo/plan, analyze it and ask follow-up questions.`,
        description: "Describe the current kitchen and key issues.",
        requiresUpload: false,
      },
      {
        id: "layout-planning",
        name: "Layout Planning",
        prompt: `Based on collected information, propose an optimal kitchen layout:

1. **Work Triangle**: Place refrigerator, sink, and cooktop
2. **Storage Zone**: Position upper and lower cabinets
3. **Counter Space**: Estimate usable prep surface
4. **Appliances**: Place large appliances (dishwasher, oven, microwave)

Create a note with the proposed layout.`,
        description: "Plan the new kitchen layout.",
        enabledTools: ["create_note"],
      },
      {
        id: "style-selection",
        name: "Style Selection",
        prompt: `Help the user choose kitchen finishes and style:

1. **Cabinet Fronts**:
   - Modern (flat, matte/gloss)
   - Classic (framed, profiled)
   - Scandinavian (wood, white)

2. **Countertop**:
   - Laminate (budget)
   - Quartz composite (durable)
   - Wood (natural, high maintenance)
   - Natural stone (premium)

3. **Backsplash / Wall Above Counter**:
   - Classic tiles
   - Tempered glass
   - Wall panel

Save the selected options as a note/spec.`,
        description: "Choose style and finishing materials.",
        enabledTools: ["create_note"],
      },
      {
        id: "appliances",
        name: "Kitchen Appliances",
        prompt: `Prepare a kitchen appliance list:

1. **Essential**:
   - Cooktop (induction/gas/electric)
   - Oven (built-in/freestanding)
   - Hood (telescopic/island/built-in)
   - Refrigerator (built-in/freestanding)
   - Dishwasher

2. **Optional**:
   - Microwave
   - Coffee machine
   - Food processor

Add selected appliances to the shopping list with estimated prices.`,
        description: "Plan kitchen appliance requirements.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "materials-budget",
        name: "Materials and Budget",
        prompt: `Prepare a complete material list and estimate the budget:

1. **Kitchen furniture** (cabinets, fronts, handles)
2. **Countertops**
3. **Sink and faucet**
4. **Lighting** (main + under-cabinet)
5. **Tiles / wall panels**
6. **Paint / wallpaper** (if applicable)
7. **Installation materials** (electrical, plumbing)

For each category, provide an estimated cost and add it to the shopping list.
Finish with a total budget summary.`,
        description: "Create a full shopping list with budget estimates.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "tasks-schedule",
        name: "Tasks and Schedule",
        prompt: `Create a kitchen renovation task list in the correct sequence:

1. **Preparation** (1-2 days):
   - Remove old furniture
   - Protect floors and neighboring rooms

2. **Installations** (3-5 days):
   - Electrical work (new points, lighting)
   - Plumbing work (relocations, new connections)

3. **Wall Finishes** (2-3 days):
   - Surface prep/plastering
   - Painting/tiling

4. **Furniture Installation** (1-2 days):
   - Lower and upper cabinets
   - Countertops

5. **Appliances and Finishing** (1-2 days):
   - Appliance hookups
   - Lighting installation
   - Cleanup

Create tasks with assigned dates.`,
        description: "Plan execution tasks and timeline.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Kitchen Renovation

A complete guide that walks you through the full kitchen renovation planning process.`,
  },
  {
    id: "bathroom-renovation",
    name: "Bathroom Renovation",
    description: "From demolition to finishing, plan a bathroom renovation step by step.",
    icon: "bathroom" as WorkflowIcon,
    category: "renovation",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 20,
    steps: [
      {
        id: "assessment",
        name: "Current Assessment",
        prompt: `Let's start bathroom renovation planning. Gather the following details:

1. **Dimensions**: Bathroom size (length x width x height)
2. **Current Fixtures**: What is there now? (bathtub/shower, toilet, sink, washer)
3. **Installations**: Do you know where water and drain risers are?
4. **Technical Condition**: Any issues (moisture, mold, leaks)?
5. **What Stays**: Will any existing fixtures remain?

If a photo or floor plan is uploaded, analyze it and ask follow-up questions.`,
        description: "Describe the current bathroom condition.",
        requiresUpload: false,
      },
      {
        id: "layout",
        name: "New Layout",
        prompt: `Based on the information, propose a bathroom layout:

1. **Bathing Zone**:
   - Bathtub (classic, corner, freestanding)
   - Shower cabin (walk-in, tray, no tray)
   - Bathtub + shower combo

2. **Toilet Zone**:
   - Floor-mounted or wall-hung toilet?
   - Is a bidet or bidet seat needed?

3. **Sink Zone**:
   - One sink or two?
   - Vanity cabinet
   - Mirror (regular or illuminated)

4. **Additional Elements**:
   - Washing machine (inside bathroom or separate)
   - Radiator (ladder type?)
   - Storage

Create a note with the proposed layout.`,
        description: "Plan the new bathroom layout.",
        enabledTools: ["create_note"],
      },
      {
        id: "finishes",
        name: "Finishes",
        prompt: `Select finishing materials:

1. **Floor Tiles**:
   - Size (30x30, 60x60, other)
   - Type (porcelain, terracotta)
   - Style (wood-look, stone-look, solid color)

2. **Wall Tiles**:
   - Tile height (full-height, 2m, half wall)
   - Accent mosaic?

3. **Ceiling**:
   - Paint
   - PVC panels
   - Suspended ceiling

4. **Color Palette**:
   - Bright/minimal
   - Dark/dramatic
   - Warm/natural

Save the finishing specification as a note.`,
        description: "Choose tiles and finishing details.",
        enabledTools: ["create_note"],
      },
      {
        id: "fixtures",
        name: "Fixtures and Ceramics",
        prompt: `Prepare a fixtures and ceramics list:

**Ceramics**:
- Toilet (brand, model, estimated price)
- Sink/sinks
- Bathtub or shower base

**Fixtures**:
- Sink faucet
- Bathtub/shower faucet
- Rain shower / hand shower
- Drains

**Accessories**:
- Mirror
- Bathroom cabinet
- Accessories (hooks, soap dish, toilet paper holder)

Add everything to the shopping list by category.`,
        description: "Select fixtures and sanitary ceramics.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "materials",
        name: "Construction Materials",
        prompt: `List the construction materials needed for the renovation:

**Substrate Preparation**:
- Tile adhesive (kg per m2)
- Grout (color, quantity)
- Waterproofing (shower/bathtub zones)
- Leveling compound (if needed)

**Installations**:
- Pipes (PEX/PP for water)
- Drainage (pipes, elbows, reducers)
- Toilet frame system (if wall-hung)
- Electrical wires (gauge)

**Finishing**:
- Sanitary silicone
- Profiles/trims
- Paint (if ceiling is painted)

Estimate quantities from dimensions and add items to the shopping list.`,
        description: "Construction material list.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items"],
      },
      {
        id: "execution-plan",
        name: "Execution Plan",
        prompt: `Create a detailed execution schedule:

**Phase 1: Demolition** (1-2 days)
- Remove old ceramics
- Remove old tiles
- Debris disposal

**Phase 2: Installations** (2-4 days)
- Plumbing (new water and drain points)
- Electrical (lighting, fan, sockets)
- Install toilet frame system

**Phase 3: Waterproofing and Plaster** (2-3 days)
- Wall leveling
- Waterproofing in wet zones
- Drying time

**Phase 4: Tiling** (3-5 days)
- Wall tile installation
- Floor tile installation
- Grouting

**Phase 5: Installation and Finish** (2-3 days)
- Final fixture installation (ceramics, fittings)
- Furniture and accessories installation
- Cleanup and handover

Create tasks with timeline dates.`,
        description: "Bathroom renovation schedule.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Bathroom Renovation

A complete assistant to plan your bathroom renovation from start to finish.`,
  },
  {
    id: "visualization-review",
    name: "Visualization Review",
    description: "Analyze an interior visualization, collect feedback, and build a shopping list from the design.",
    icon: "visualization" as WorkflowIcon,
    category: "design",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: true,
    estimatedMinutes: 15,
    steps: [
      {
        id: "upload",
        name: "Upload Visualization",
        prompt: null,
        requiresUpload: true,
        description: "Upload a 3D visualization or interior design file (image or PDF).",
      },
      {
        id: "analysis",
        name: "Visualization Analysis",
        prompt: `Analyze the uploaded interior visualization:

1. **Room Type**: What kind of room is this? (living room, bedroom, kitchen, etc.)

2. **Style**: Identify the interior style:
   - Modern / Minimalist
   - Scandinavian
   - Industrial
   - Classic / Hampton
   - Boho / Eclectic
   - Other

3. **Color Palette**: Describe the colors:
   - Dominant colors
   - Accent colors
   - Materials and textures

4. **Main Elements**: List visible furnishing elements:
   - Furniture
   - Lighting
   - Decorative accessories
   - Plants

Present the analysis clearly.`,
        description: "AI will analyze the visualization and identify key elements.",
        enabledTools: ["create_note"],
      },
      {
        id: "feedback",
        name: "Feedback and Notes",
        prompt: `Help gather feedback for the visualization:

1. **What works well?** Ask which design elements are successful

2. **What should change?** Identify what needs adjustment:
   - Furniture layout
   - Color palette
   - Lighting
   - Specific furniture/accessories

3. **Questions for the designer**: Formulate notes/questions to pass on

Create a project note with this feedback.`,
        description: "Collect comments and improvement suggestions.",
        enabledTools: ["create_note"],
      },
      {
        id: "shopping-list",
        name: "Shopping List",
        prompt: `Based on the visualization analysis, create a shopping list of items to buy:

**For each visible item, include:**
- Product name / description
- Category (furniture, lighting, textiles, decor)
- Approximate price range
- Where to look (store type: IKEA, premium, vintage, etc.)

**Group items by category:**
1. Main furniture (sofa, table, bed)
2. Supporting furniture (side tables, shelves, dressers)
3. Lighting
4. Textiles (rugs, curtains, pillows)
5. Decor and accessories
6. Plants

Add all items to the shopping list with proper sections.`,
        description: "Create a list of furnishing items to purchase.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
      {
        id: "tasks",
        name: "Execution Tasks",
        prompt: `Create a task list needed to implement the visualization:

1. **Preparation**:
   - Measure the room
   - Order material samples
   - Visit showrooms

2. **Orders**:
   - Long lead-time furniture (order first)
   - Lighting
   - Textiles
   - Decor

3. **Implementation**:
   - Any renovation work needed
   - Painting
   - Furniture delivery and assembly
   - Final styling/accessory placement

Create tasks with suggested order and dates.`,
        description: "Plan project execution.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
    ],
    content: `# Visualization Review

A workflow for turning an interior visualization into a concrete shopping and execution plan.`,
  },
  {
    id: "interior-renovation-management",
    name: "Interior Renovation Project Management",
    description: "Plan scope, budget, schedule, and contractor coordination in one workflow.",
    icon: "checklist" as WorkflowIcon,
    category: "planning",
    requiredFileTypes: ["image", "pdf", "document"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 25,
    steps: [
      {
        id: "project-brief",
        name: "Project Brief",
        prompt: `Gather core information about the renovation project:

1. Property type (apartment/house/commercial) and room list
2. Main goals (functionality, aesthetics, resale, rental)
3. Constraints (living during renovation, children/pets, noise, access)
4. Budget range (min/max) and spending priorities
5. Planned start date and target completion date
6. Style inspirations (colors, materials, examples)

Save the brief as a note. If the user has plans/photos/contracts, ask for upload.`,
        description: "Define project goals, scope, and constraints.",
        enabledTools: ["create_note"],
      },
      {
        id: "scope-structure",
        name: "Scope and Work Breakdown",
        prompt: `Based on the brief, define scope of work:

1. Split renovation by rooms and disciplines (construction, electrical, plumbing, finishes)
2. For each part, propose a list of concrete tasks
3. Mark dependencies (for example installations before finishes)

Create key tasks in a logical sequence.`,
        description: "Break down the project into tasks and dependencies.",
        enabledTools: ["create_task", "create_multiple_tasks"],
      },
      {
        id: "budget-procurement",
        name: "Budget and Procurement",
        prompt: `Build an initial budget and procurement plan:

1. Split budget into categories (materials, labor, furniture, appliances, contingency)
2. Identify long lead-time items
3. Propose purchasing priorities

Add shopping sections and initial items with estimated costs.`,
        description: "Define budget and initial shopping plan.",
        enabledTools: ["create_shopping_section", "create_multiple_shopping_items", "create_note"],
      },
      {
        id: "schedule-milestones",
        name: "Schedule and Milestones",
        prompt: `Propose a work schedule:

1. Organize tasks into phases (demolition, installations, finishing, assembly)
2. Estimate phase durations and technical waiting times
3. Define milestones (for example installation complete, ready for furniture installation)

Update task dates according to the schedule.`,
        description: "Set a realistic schedule and milestones.",
        enabledTools: ["edit_task", "edit_multiple_tasks"],
      },
      {
        id: "team-contracts",
        name: "Team and Contracts",
        prompt: `Plan contractor-related execution topics:

1. Which work is DIY vs contractor-delivered?
2. How many quotes should be collected, and from whom?
3. Which documents/contracts are needed (scope, dates, warranties)?
4. Are administrative approvals or design documents required?

Add tasks related to contractor selection and documentation.`,
        description: "Prepare contractor collaboration plan.",
        enabledTools: ["create_task", "create_multiple_tasks", "create_note"],
      },
      {
        id: "risk-quality",
        name: "Risks and Quality Control",
        prompt: `Identify project risks and a quality-control plan:

1. Top risks (delays, budget overruns, material availability)
2. Mitigations (time/financial contingency, backup options)
3. Quality checkpoints (installation checks, moisture, leveling)
4. Final handover checklist (punch list)

Create tasks for quality control and acceptance checks.`,
        description: "Secure the project and plan acceptance checks.",
        enabledTools: ["create_task", "create_multiple_tasks", "create_note"],
      },
    ],
    content: `# Interior Renovation Project Management

This workflow helps move from project brief to execution schedule and delivery management.

## What you get
- Structured scope and task list
- Initial budget and shopping list
- Milestone-based schedule
- Contractor collaboration plan
- Risk and quality-control checklist`,
  },
  {
    id: "material-estimation",
    name: "Material Estimation",
    description: "Estimate required quantities and costs of construction materials based on room dimensions.",
    icon: "materials" as WorkflowIcon,
    category: "planning",
    requiredFileTypes: ["image", "pdf"] as WorkflowFileType[],
    fileRequired: false,
    estimatedMinutes: 10,
    steps: [
      {
        id: "dimensions",
        name: "Room Dimensions",
        prompt: `Collect room details for material estimation:

**Basic dimensions:**
1. Room length (meters)
2. Room width (meters)
3. Room height (typically 2.5m or 2.7m)

**Openings:**
4. Number and size of windows (for example 1.5m x 1.2m)
5. Number and size of doors (standard 0.9m x 2m)

**Additional details:**
6. Any alcoves, sloped ceilings, or unusual elements?

If a plan/photo is uploaded, analyze it and ask follow-up details.`,
        description: "Provide room dimensions.",
        requiresUpload: false,
      },
      {
        id: "scope",
        name: "Work Scope",
        prompt: `What kind of work are you planning? Select all that apply:

**Walls:**
- [ ] Painting
- [ ] Skim coat / plastering
- [ ] Wallpaper
- [ ] Ceramic tiles
- [ ] Wall panels

**Floor:**
- [ ] Laminate flooring
- [ ] Wood / parquet
- [ ] Tiles
- [ ] Carpet
- [ ] Self-leveling screed

**Ceiling:**
- [ ] Painting
- [ ] Suspended ceiling (drywall)
- [ ] Ceiling panels

**Installations:**
- [ ] Electrical work (how many points?)
- [ ] Lighting (how many fixtures?)

Save scope as a note.`,
        description: "Define what work will be performed.",
        enabledTools: ["create_note"],
      },
      {
        id: "calculations",
        name: "Quantity Calculations",
        prompt: `Based on dimensions and scope, calculate required quantities:

**Formulas used:**
- Wall area = (2 x length + 2 x width) x height - windows - doors
- Floor area = length x width
- Ceiling area = length x width

**Material assumptions:**
- Paint: ~0.15L/m2 (2 coats = 0.3L/m2)
- Skim coat: ~1.2kg/m2 (2mm thickness)
- Tile adhesive: ~4kg/m2
- Grout: ~0.5kg/m2 (for 30x30 tiles)
- Panels: +10% cutting waste
- Tiles: +15% cutting waste and spare

Present detailed calculations with quantities.`,
        description: "AI will calculate required material quantities.",
        enabledTools: ["create_note"],
      },
      {
        id: "shopping-list",
        name: "Priced Shopping List",
        prompt: `Create a shopping list with estimated pricing:

For each material include:
- Quantity with contingency
- Unit price (budget/mid/premium range)
- Estimated total cost

**Categories:**
1. Core materials (paint, skim coat, adhesives)
2. Finishes (panels, tiles, trims)
3. Tools and accessories (rollers, trowels, tapes)
4. Installations (if applicable)

End with a full material cost summary.

Add all items to the shopping list in sections.`,
        description: "Material list with prices and estimate.",
        enabledTools: ["create_shopping_item", "create_multiple_shopping_items", "create_shopping_section"],
      },
    ],
    content: `# Material Estimation

A quick calculator for construction material quantities and costs.`,
  },
];

// ============================================
// ACCESSOR FUNCTIONS
// ============================================

/**
 * Get all available workflows as metadata (for selector UI)
 */
export function getWorkflowsMetadata(): WorkflowMetadata[] {
  return WORKFLOWS.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    icon: w.icon,
    category: w.category,
    stepCount: w.steps.length,
    estimatedMinutes: w.estimatedMinutes,
    requiredFileTypes: w.requiredFileTypes,
  }));
}

/**
 * Get a specific workflow by ID
 */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

/**
 * Get workflows filtered by category
 */
export function getWorkflowsByCategory(category: string): WorkflowDefinition[] {
  return WORKFLOWS.filter((w) => w.category === category);
}

/**
 * Get a specific step from a workflow
 */
export function getWorkflowStep(workflowId: string, stepId: string): WorkflowStep | undefined {
  const workflow = getWorkflow(workflowId);
  return workflow?.steps.find((s) => s.id === stepId);
}

/**
 * Get the next step in a workflow
 */
export function getNextStep(workflowId: string, currentStepId: string): WorkflowStep | undefined {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return undefined;
  
  const currentIndex = workflow.steps.findIndex((s) => s.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= workflow.steps.length - 1) {
    return undefined;
  }
  
  return workflow.steps[currentIndex + 1];
}

/**
 * Check if a workflow requires file upload
 */
export function workflowRequiresFile(workflowId: string): boolean {
  const workflow = getWorkflow(workflowId);
  return workflow?.fileRequired ?? false;
}

/**
 * Get all workflow IDs
 */
export function getWorkflowIds(): string[] {
  return WORKFLOWS.map((w) => w.id);
}
