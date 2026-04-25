---
id: interior-renovation-management
name: Interior Renovation Project Management
description: Plan the budget, schedule, and coordination of an interior renovation in one workflow.
icon: checklist
category: planning
requiredFileTypes:
  - image
  - pdf
  - document
fileRequired: false
estimatedMinutes: 25
steps:
  - id: project-brief
    name: Project Brief
    prompt: |
      Collect the basic information about the renovation project:

      1. Interior type (apartment/house/commercial space) and room list
      2. Main goals (functionality, aesthetics, resale, rental)
      3. Constraints (living in the space during renovation, children/pets, noise, access)
      4. Budget range (min/max) and spending priorities
      5. Start date and expected completion date
      6. Style inspiration (colors, materials, examples)

      Save the brief as a note. If the user has a floor plan, photos, or contracts, ask them to upload them.
    description: Define the project goals, scope, and constraints.
    enabledTools:
      - create_item
  - id: scope-structure
    name: Scope and Work Structure
    prompt: |
      Define the work scope based on the brief:

      1. Split the renovation by rooms and trades (construction, electrical, plumbing, finishes)
      2. Propose a concrete task list for each part
      3. Identify dependencies (for example, installations before finishes)

      Create tasks for the key work items in the right order.
    description: Break the project into tasks and dependencies.
    enabledTools:
      - create_item
      - create_multiple_items
  - id: budget-procurement
    name: Budget and Procurement
    prompt: |
      Build an initial budget and procurement plan:

      1. Split the budget into categories (materials, labor, furniture, appliances, contingency)
      2. Identify items with long lead times
      3. Propose purchasing priorities

      Add shopping sections and initial items with estimated costs.
    description: Define the budget and initial shopping list.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
      - create_item
  - id: schedule-milestones
    name: Schedule and Milestones
    prompt: |
      Propose a work schedule:

      1. Arrange tasks by phases (demolition, installations, finishes, installation of furniture/equipment)
      2. Estimate phase durations and required technical breaks
      3. Define milestones (for example, installations complete, ready for furniture installation)

      Update task dates according to the schedule.
    description: Set a realistic schedule and milestones.
    enabledTools:
      - update_item
      - update_multiple_items
  - id: team-contracts
    name: Team and Contracts
    prompt: |
      Plan contractor-related work:

      1. Which tasks are DIY, and which require contractors?
      2. How many offers/quotes are needed and from whom?
      3. What documents/contracts are needed (scope, deadlines, warranties)?
      4. Are any administrative approvals or design documents required?

      Add tasks related to contractor selection and documents.
    description: Prepare the contractor collaboration plan.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_item
  - id: risk-quality
    name: Risks and Quality Control
    prompt: |
      Identify risks and create a quality control plan:

      1. Biggest risks (delays, budget overruns, material availability)
      2. How to mitigate them (time and financial contingency, plan B)
      3. Quality control points (installation handover, moisture, levels)
      4. Final handover checklist (punch list)

      Create tasks for quality checks and handovers.
    description: Protect the project and plan handovers.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_item
---

# Interior Renovation Project Management

A workflow for moving from a brief to a schedule and execution management.

## What you will get

- An organized work scope and task list
- An initial budget and shopping list
- A schedule with milestones
- A contractor collaboration plan
- A risk and quality control list
