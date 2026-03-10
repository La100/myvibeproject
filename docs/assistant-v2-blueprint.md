# Assistant V2 Blueprint

## Goal

Build a tenant-scoped assistant runtime that can safely orchestrate:

- project CRUD through app tools
- reasoning and streaming text through OpenAI Responses API
- grouped confirmations for mutating actions
- optional `shell` and `computer use` execution backends

This system should replace the current assistant incrementally, not through a big-bang rewrite.

## Why V1 Is Hard To Extend

The current assistant mixes several concerns in one flow:

- model orchestration
- pending action storage
- confirmation grouping
- message rendering
- streaming transport
- UI-specific reconciliation

This makes new capabilities such as `computer use`, `shell`, or response-level confirmations much harder than they need to be.

## Core Principles

1. One global engine, tenant-scoped runtime
2. API-first tools, UI automation only when necessary
3. Response group is the primary unit of execution
4. Event log is the source of truth for rendering
5. Confirmation happens at batch level, with item drill-down
6. UI renders events; it does not reconstruct hidden backend state
7. Old assistant and new assistant run side-by-side behind a feature flag

## Runtime Model

### Scope levels

- Global:
  - shared orchestration code
  - OpenAI provider integration
  - tool registry framework
- Organization / team:
  - assistant profile
  - enabled features
  - safety and confirmation policies
  - model defaults
- Project:
  - domain context
  - project-specific tools and integrations
- Thread:
  - conversation state
  - rolling summary
  - current response groups

## New Domain Model

### Assistant profile

Per team configuration for the assistant.

Fields:

- `teamId`
- `defaultModel`
- `displayName`
- `systemPrompt`
- `enabledTools`
- `featureFlags`
- `confirmationMode`
- `memoryMode`

### Response group

A single assistant turn or execution batch.

Fields:

- `groupId`
- `threadId`
- `projectId`
- `teamId`
- `userClerkId`
- `model`
- `provider`
- `status`
- `confirmationPolicy`
- `summary`
- `createdAt`
- `updatedAt`

This is the main unit for:

- one streamed answer
- many tool calls
- one confirmation batch
- one final completion state

### Event log

Append-only timeline for a response group.

Event examples:

- `turn.started`
- `message.user`
- `message.assistant.delta`
- `message.assistant.completed`
- `reasoning.summary.delta`
- `tool.called`
- `tool.output.delta`
- `tool.awaiting_confirmation`
- `tool.confirmed`
- `tool.rejected`
- `tool.completed`
- `turn.awaiting_confirmation`
- `turn.completed`
- `turn.failed`
- `turn.aborted`

### Tool execution

Structured record of every tool run.

Fields:

- `groupId`
- `callId`
- `toolName`
- `toolKind`
- `status`
- `confirmationRequired`
- `args`
- `result`
- `error`
- `createdAt`
- `updatedAt`

## Execution Backends

### App tools

Use for all project-owned data:

- tasks
- shopping items and sections
- labor items and sections
- contacts
- notes
- surveys
- project settings

### Shell

Use for:

- file processing
- reports
- transformations
- import/export preparation
- engineering and ops tasks in controlled contexts

### Computer use

Use only when screen-level interaction is necessary:

- internal UI automation
- external sites without clean APIs
- onboarding and guided setup
- visual QA and bug reproduction

## Confirmation Model

### Default rule

Mutating actions from one response group should appear as one confirmation batch.

### UI behavior

- one top-level confirmation block per response group
- aggregate actions by type for summary
- allow drill-down into individual items
- allow `accept all`, `reject all`, and single-item review

### Why this matters

Grouping by `toolCallId` causes fragmented UX.
Grouping by `responseGroupId` produces predictable confirmation behavior.

## Streaming Model

The UI should subscribe to event streams, not reconstructed messages.

Primary rendering paths:

- assistant text stream
- reasoning summary stream
- tool lifecycle events
- confirmation state changes
- final completion state

## Migration Strategy

### Phase 1

- add v2 tables and domain types
- add feature flag at team/project level
- define event and response-group contracts

### Phase 2

- build orchestrator v2 with OpenAI Responses API
- save response groups and events
- keep existing UI untouched

### Phase 3

- add confirmation batch builder on top of response groups
- migrate inline confirmation UI to event-driven data

### Phase 4

- add thread UI v2
- render directly from event log

### Phase 5

- add `shell`
- add `computer use`

### Phase 6

- migrate selected teams/projects
- remove v1-only confirmation and message reconciliation code

## First Implementation Slice

The first safe vertical slice is:

1. create v2 schema tables
2. create domain types for response groups and events
3. build a pure batch builder for confirmation grouping
4. route one experimental assistant mode into v2 persistence
5. render one grouped confirmation block from v2 data

## Definition Of Done For V2 Alpha

- one response group per assistant turn
- many tool calls can belong to one response group
- one grouped confirmation block renders for mixed actions
- event log can replay a full turn deterministically
- reasoning summary is visible when provided by the model
- old assistant remains functional during rollout
