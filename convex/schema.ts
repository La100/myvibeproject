import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Teams (mapped to Clerk Organizations)
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clerkOrgId: v.string(), // Organization ID from Clerk
    slug: v.string(), // New field for unique slug
    imageUrl: v.optional(v.string()), // Added imageUrl for the team logo
    createdBy: v.optional(v.string()), // Clerk user ID - now optional
    currency: v.optional(v.union(
      v.literal("USD"), // US Dollar
      v.literal("EUR"), // Euro
      v.literal("PLN"), // Polish Zloty
      v.literal("GBP"), // British Pound
      v.literal("CAD"), // Canadian Dollar
      v.literal("AUD"), // Australian Dollar
      v.literal("JPY"), // Japanese Yen
      v.literal("CHF"), // Swiss Franc
      v.literal("SEK"), // Swedish Krona
      v.literal("NOK"), // Norwegian Krone
      v.literal("DKK"), // Danish Krone
      v.literal("CZK"), // Czech Koruna
      v.literal("HUF"), // Hungarian Forint
      v.literal("CNY"), // Chinese Yuan
      v.literal("INR"), // Indian Rupee
      v.literal("BRL"), // Brazilian Real
      v.literal("MXN"), // Mexican Peso
      v.literal("KRW"), // South Korean Won
      v.literal("SGD"), // Singapore Dollar
      v.literal("HKD"), // Hong Kong Dollar
    )),
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    // Stripe subscription fields
    stripeCustomerId: v.optional(v.string()), // Stripe customer ID
    subscriptionStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("unpaid"),
      v.null()
    )),
    subscriptionId: v.optional(v.string()), // Stripe subscription ID
    subscriptionPlan: v.optional(v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("ai"),
      v.literal("ai_scale"),
      v.literal("pro"),
      v.literal("enterprise")
    )),
    subscriptionPriceId: v.optional(v.string()), // Stripe price ID
    currentPeriodStart: v.optional(v.number()), // Unix timestamp
    currentPeriodEnd: v.optional(v.number()), // Unix timestamp
    trialEnd: v.optional(v.number()), // Unix timestamp
    cancelAtPeriodEnd: v.optional(v.boolean()),
    subscriptionLimits: v.optional(v.object({
      id: v.string(),
      name: v.string(),
      maxProjects: v.number(),
      maxTeamMembers: v.number(),
      maxStorageGB: v.number(),
      hasAdvancedFeatures: v.boolean(),
      hasAIFeatures: v.optional(v.boolean()),
      price: v.number(),
      aiMonthlyTokens: v.optional(v.number()), // Monthly AI tokens
    })),
    // Simple AI tokens field - manually editable in dashboard
    aiTokens: v.optional(v.number()), // Total tokens available for this team
    timezone: v.optional(v.string()), // Team timezone (e.g. "Europe/Warsaw")
  })
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]), // Added index

  // Architectural projects
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    teamId: v.id("teams"),
    slug: v.string(),
    projectId: v.number(), // Numeric project ID for users
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    customer: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"), // US Dollar
      v.literal("EUR"), // Euro
      v.literal("PLN"), // Polish Zloty
      v.literal("GBP"), // British Pound
      v.literal("CAD"), // Canadian Dollar
      v.literal("AUD"), // Australian Dollar
      v.literal("JPY"), // Japanese Yen
      v.literal("CHF"), // Swiss Franc
      v.literal("SEK"), // Swedish Krona
      v.literal("NOK"), // Norwegian Krone
      v.literal("DKK"), // Danish Krone
      v.literal("CZK"), // Czech Koruna
      v.literal("HUF"), // Hungarian Forint
      v.literal("CNY"), // Chinese Yuan
      v.literal("INR"), // Indian Rupee
      v.literal("BRL"), // Brazilian Real
      v.literal("MXN"), // Mexican Peso
      v.literal("KRW"), // South Korean Won
      v.literal("SGD"), // Singapore Dollar
      v.literal("HKD"), // Hong Kong Dollar
    )),
    taxEnabled: v.optional(v.boolean()),
    taxRate: v.optional(v.number()),
    createdBy: v.string(), // Clerk user ID
    // Project owner responsible for client notifications and updates
    responsibleClerkUserId: v.optional(v.string()),
    clientNotificationsLastReadAt: v.optional(v.number()),
    assignedTo: v.array(v.string()), // Array of Clerk user IDs
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.optional(v.object({ name: v.string(), color: v.string() })),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    // Public, link-only customer panel token.
    clientPanelAccessToken: v.optional(v.string()),
    clientPanelPublishedSettings: v.optional(v.object({
      showShoppingList: v.optional(v.boolean()),
      showFiles: v.optional(v.boolean()),
      showMoodboard: v.optional(v.boolean()),
      showSurveys: v.optional(v.boolean()),
      showTasks: v.optional(v.boolean()),
      showLabor: v.optional(v.boolean()),
      showContacts: v.optional(v.boolean()),
      showBudget: v.optional(v.boolean()),
      showPayments: v.optional(v.boolean()),
      showNotes: v.optional(v.boolean()),
      showSupplier: v.optional(v.boolean()),
      showPrice: v.optional(v.boolean()),
    })),
    clientPanelDataVersion: v.optional(v.number()),
    clientPanelDataUpdatedAt: v.optional(v.number()),
    paymentCustomerName: v.optional(v.string()),
    paymentCustomerEmail: v.optional(v.string()),
    stripeProjectCustomerId: v.optional(v.string()),
    // Custom AI assistant prompt override
    customAiPrompt: v.optional(v.string()),
    // If true, CRUD tool calls from AI are auto-confirmed in the assistant UI
    aiAutoConfirmCrud: v.optional(v.boolean()),
    // Messaging bot configuration (project-scoped assistant integration)
    telegramBotUsername: v.optional(v.string()), // Telegram bot username (without @)
    telegramBotToken: v.optional(v.string()), // Telegram bot token from @BotFather
    telegramWebhookSecret: v.optional(v.string()), // Secret validated by Telegram webhook
    whatsappNumber: v.optional(v.string()), // Reserved for WhatsApp integration
  })
    .index("by_team", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"])
    .index("by_project_id", ["projectId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"])
    .index("by_client_panel_access_token", ["clientPanelAccessToken"])
    .index("by_telegram_webhook_secret", ["telegramWebhookSecret"]),

  // Tasks in projects
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    content: v.optional(v.string()), // Rich text content from Tiptap editor
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
      v.null()
    )),
    assignedTo: v.optional(v.union(v.string(), v.null())), // Clerk user ID
    createdBy: v.string(), // Clerk user ID
    startDate: v.optional(v.number()), // Unix timestamp (UTC)
    endDate: v.optional(v.number()), // Unix timestamp (UTC)
    tags: v.array(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_assigned_to", ["assignedTo"]),

  // Folders for file organization
  folders: defineTable({
    name: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    parentFolderId: v.optional(v.id("folders")), // For nested folders
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentFolderId"]),

  // Files and documents
  files: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    folderId: v.optional(v.id("folders")), // Which folder contains the file
    fileType: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("document"),
      v.literal("drawing"),
      v.literal("model"),
      v.literal("other")
    ),
    storageId: v.string(), // R2 storage key
    size: v.number(),
    mimeType: v.string(),
    uploadedBy: v.string(), // Clerk user ID
    version: v.number(),
    isLatest: v.boolean(),
    origin: v.optional(v.union(
      v.literal("general"),
      v.literal("ai")
    )),
    extractedText: v.optional(v.string()), // Text extracted from file
    textExtractionStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    // PDF analysis with Vertex AI
    pdfAnalysis: v.optional(v.string()), // Analysis results for PDF files
    analysisStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    // For moodboard images - which section they belong to
    moodboardSection: v.optional(v.string()),
    // AI generation prompt (for AI-generated files)
    aiPrompt: v.optional(v.string()),
    // If true, file is included in the next published customer portal snapshot
    showInClientPortal: v.optional(v.boolean()),
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_task", ["taskId"])
    .index("by_folder", ["folderId"])
    .index("by_uploaded_by", ["uploadedBy"])
    .index("by_moodboard_section", ["projectId", "moodboardSection"]),

  // Comments
  comments: defineTable({
    content: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    fileId: v.optional(v.id("files")),
    authorId: v.string(), // Clerk user ID
    parentCommentId: v.optional(v.id("comments")), // For replies
    isEdited: v.boolean(),
    editedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_task", ["taskId"])
    .index("by_file", ["fileId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentCommentId"]),

  // Team members (only admin/member - internal team)
  teamMembers: defineTable({
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member")
    ),
    permissions: v.array(v.string()),
    projectIds: v.optional(v.array(v.id("projects"))),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_team_and_user", ["teamId", "clerkUserId"])
    .index("by_user", ["clerkUserId"])
    .index("by_team", ["teamId"]),

  // Team invitations (synchronized with Clerk)
  invitations: defineTable({
    clerkInvitationId: v.string(),
    teamId: v.id("teams"),
    email: v.string(),
    role: v.string(), // 'admin', 'member'
    status: v.string(), // 'pending', 'accepted', 'revoked'
    invitedBy: v.string(), // Clerk user ID
  })
    .index("by_clerk_invitation_id", ["clerkInvitationId"])
    .index("by_team", ["teamId"]),

  // Users
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    displayName: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    preferredCurrency: v.optional(v.union(
      v.literal("USD"),
      v.literal("EUR"),
      v.literal("PLN"),
      v.literal("GBP"),
      v.literal("CAD"),
      v.literal("AUD"),
      v.literal("JPY"),
      v.literal("CHF"),
      v.literal("SEK"),
      v.literal("NOK"),
      v.literal("DKK"),
      v.literal("CZK"),
      v.literal("HUF"),
      v.literal("CNY"),
      v.literal("INR"),
      v.literal("BRL"),
      v.literal("MXN"),
      v.literal("KRW"),
      v.literal("SGD"),
      v.literal("HKD"),
    )),
    preferredTimezone: v.optional(v.string()),
    onboardingCompletedAt: v.optional(v.number()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  projectEmbeddings: defineTable({
    projectId: v.id("projects"),
    embedding: v.array(v.float64()),
    text: v.string(),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["projectId"],
  }),

  shoppingListSections: defineTable({
    name: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    order: v.number(),
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_project", ["projectId"]),

  shoppingListItems: defineTable({
    name: v.string(),
    notes: v.optional(v.string()),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    buyBefore: v.optional(v.number()),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    category: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()), // Unit type (pcs, m², m, kg, etc.)
    unitPrice: v.optional(v.number()),
    totalPrice: v.optional(v.number()),
    // Item can be marked as an alternative for another shopping item
    alternativeToItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    // Stored on base item: which alternative was chosen by customer
    selectedAlternativeItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    // Customer feedback from public portal (stored on base item)
    customerDecision: v.optional(
      v.union(v.literal("accepted"), v.literal("rejected"), v.null())
    ),
    customerDecisionComment: v.optional(v.union(v.string(), v.null())),
    customerDecisionUpdatedAt: v.optional(v.number()),
    customerDecisionByName: v.optional(v.union(v.string(), v.null())),
    realizationStatus: v.union(
      v.literal("PLANNED"),
      v.literal("ORDERED"),
      v.literal("IN_TRANSIT"),
      v.literal("DELIVERED"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.optional(v.string()), // Clerk user ID
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_section", ["sectionId"])
    .index("by_status", ["realizationStatus"]),

  // Published customer panel snapshot (sections).
  clientPanelSections: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    order: v.number(),
  })
    .index("by_project", ["projectId"]),

  // Published customer panel snapshot (items/options).
  clientPanelItems: defineTable({
    projectId: v.id("projects"),
    sourceItemId: v.id("shoppingListItems"),
    name: v.string(),
    realizationStatus: v.optional(v.union(
      v.literal("PLANNED"),
      v.literal("ORDERED"),
      v.literal("IN_TRANSIT"),
      v.literal("DELIVERED"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    )),
    notes: v.optional(v.string()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    category: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    quantity: v.number(),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    totalPrice: v.optional(v.number()),
    sectionName: v.optional(v.string()),
    sectionOrder: v.number(),
    alternativeToSourceItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    selectedAlternativeSourceItemId: v.optional(v.union(v.id("shoppingListItems"), v.null())),
    customerDecision: v.optional(
      v.union(v.literal("accepted"), v.literal("rejected"), v.null())
    ),
    customerDecisionComment: v.optional(v.union(v.string(), v.null())),
    customerDecisionUpdatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_source", ["projectId", "sourceItemId"]),

  // Published customer panel snapshot (files).
  clientPanelFiles: defineTable({
    projectId: v.id("projects"),
    sourceFileId: v.id("files"),
    name: v.string(),
    fileType: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("document"),
      v.literal("drawing"),
      v.literal("model"),
      v.literal("other")
    ),
    storageId: v.string(),
    mimeType: v.string(),
    size: v.number(),
    folderName: v.optional(v.string()),
    moodboardSection: v.optional(v.string()),
    uploadedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_source", ["projectId", "sourceFileId"]),

  // Project payment installments managed in Stripe.
  projectPayments: defineTable({
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.optional(v.number()),
    order: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("uncollectible")
    ),
    createdBy: v.string(),
    updatedAt: v.number(),
    stripeInvoiceId: v.optional(v.string()),
    stripeHostedInvoiceUrl: v.optional(v.string()),
    stripeInvoiceNumber: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    lastStripeSyncAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_order", ["projectId", "order"])
    .index("by_stripe_invoice_id", ["stripeInvoiceId"]),

  // Labor sections for grouping labor items
  laborSections: defineTable({
    name: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    order: v.number(),
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_project", ["projectId"]),

  // Labor items for work/services
  laborItems: defineTable({
    name: v.string(), // Work description (e.g., "Tile installation")
    notes: v.optional(v.string()),
    referenceLink: v.optional(v.union(v.string(), v.null())),
    attachmentFileId: v.optional(v.union(v.id("files"), v.null())),
    quantity: v.number(),
    unit: v.string(), // Unit type (m², hours, pcs, lm, etc.)
    unitPrice: v.optional(v.number()),
    totalPrice: v.optional(v.number()),
    sectionId: v.optional(v.union(v.id("laborSections"), v.null())),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.optional(v.string()), // Clerk user ID (contractor)
    startDate: v.optional(v.number()), // Planned start
    endDate: v.optional(v.number()), // Planned end
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_section", ["sectionId"]),

  // Cost Estimations / Quotations
  costEstimations: defineTable({
    title: v.string(), // Estimation title
    estimationNumber: v.optional(v.string()), // Optional estimation number (e.g., "EST-2026-001")
    location: v.optional(v.string()), // Work location/address
    estimationDate: v.number(), // Date created (Unix timestamp)
    plannedStartDate: v.optional(v.number()), // Planned start of work (Unix timestamp)
    validUntil: v.optional(v.number()), // Quote valid until (Unix timestamp)
    vatPercent: v.number(), // VAT percentage (default 23%)
    discountPercent: v.optional(v.number()), // Discount percentage
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    // Selected items from shopping list (materials)
    materialItemIds: v.array(v.id("shoppingListItems")),
    // Selected items from labor list
    laborItemIds: v.array(v.id("laborItems")),
    // Calculated totals (stored for quick access)
    laborTotal: v.optional(v.number()),
    materialsTotal: v.optional(v.number()),
    netTotal: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    grossTotal: v.optional(v.number()),
    // Customer info (optional, can be linked to contacts)
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")), // Link to contacts table
    notes: v.optional(v.string()),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"]),

  // Activity log (Changelog)
  activityLog: defineTable({
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")), // Task-specific activity
    userId: v.string(), // Clerk User ID
    actionType: v.string(), // e.g. "task.create", "task.update", "task.status_change", "file.upload", "comment.add"
    details: v.any(), // e.g. { taskTitle: "...", fromStatus: "...", toStatus: "..." }
    entityId: v.string(), // ID of related object (e.g. taskId)
    entityType: v.optional(v.string()), // Type of entity (e.g. "task", "file", "comment")
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_task", ["taskId"])
    .index("by_entity", ["entityId", "entityType"]),

  // Surveys
  surveys: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    createdBy: v.string(), // Clerk user ID
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed")
    ),
    isRequired: v.boolean(), // whether the survey is mandatory
    allowMultipleResponses: v.boolean(), // whether it can be filled multiple times
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Survey questions
  surveyQuestions: defineTable({
    surveyId: v.id("surveys"),
    questionText: v.string(),
    questionType: v.union(
      v.literal("text_short"), // short text
      v.literal("text_long"), // long text
      v.literal("multiple_choice"), // multiple choice
      v.literal("single_choice"), // single choice
      v.literal("rating"), // rating scale
      v.literal("yes_no"), // yes/no
      v.literal("number"), // number
      v.literal("file") // file upload
    ),
    options: v.optional(v.array(v.string())), // options for multiple/single choice
    isRequired: v.boolean(),
    order: v.number(), // question order
    ratingScale: v.optional(v.object({
      min: v.number(),
      max: v.number(),
      minLabel: v.optional(v.string()),
      maxLabel: v.optional(v.string())
    })), // for rating type
  })
    .index("by_survey", ["surveyId"])
    .index("by_order", ["surveyId", "order"]),

  // Survey responses
  surveyResponses: defineTable({
    surveyId: v.id("surveys"),
    respondentId: v.string(), // Clerk user ID
    respondentName: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    isComplete: v.boolean(),
    submittedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      timeSpent: v.optional(v.number()) // time in seconds
    })),
  })
    .index("by_survey", ["surveyId"])
    .index("by_respondent", ["respondentId"])
    .index("by_project", ["projectId"])
    .index("by_survey_and_respondent", ["surveyId", "respondentId"]),

  // Answers to specific questions
  surveyAnswers: defineTable({
    responseId: v.id("surveyResponses"),
    questionId: v.id("surveyQuestions"),
    surveyId: v.id("surveys"),
    answerType: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rating"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("file")
    ),
    textAnswer: v.optional(v.string()),
    choiceAnswers: v.optional(v.array(v.string())), // for multiple choice
    ratingAnswer: v.optional(v.number()),
    numberAnswer: v.optional(v.number()),
    booleanAnswer: v.optional(v.boolean()),
    fileAnswer: v.optional(v.object({
      fileId: v.id("files"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string()
    })),
  })
    .index("by_response", ["responseId"])
    .index("by_question", ["questionId"])
    .index("by_survey", ["surveyId"]),



  // Contacts/Address Book
  contacts: defineTable({
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    type: v.union(
      v.literal("contractor"), // wykonawca
      v.literal("supplier"),   // dostawca
      v.literal("subcontractor"), // podwykonawca
      v.literal("other")       // inne
    ),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    isActive: v.boolean(),
    website: v.optional(v.string()),
    taxId: v.optional(v.string()), // NIP/VAT ID
  })
    .index("by_team", ["teamId"])
    .index("by_type", ["type"])
    .index("by_created_by", ["createdBy"])
    .index("by_company_name", ["companyName"]),

  // Contact assignments to projects
  projectContacts: defineTable({
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    teamId: v.id("teams"),
    role: v.optional(v.string()), // rola w projekcie np. "główny wykonawca"
    assignedBy: v.string(), // Clerk user ID
    assignedAt: v.number(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_contact", ["contactId"])
    .index("by_team", ["teamId"])
    .index("by_project_and_contact", ["projectId", "contactId"]),

  // Project Notes
  notes: defineTable({
    title: v.string(),
    content: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.number(),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"]),

  // AI Token Usage Tracking
  aiTokenUsage: defineTable({
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    model: v.string(),
    feature: v.optional(
      v.union(
        v.literal("assistant"),
        v.literal("visualizations"),
        v.literal("other")
      )
    ),
    requestType: v.union(
      v.literal("chat"),
      v.literal("embedding"),
      v.literal("other")
    ),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    billableTokens: v.optional(v.number()),
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userClerkId"])
    .index("by_thread", ["threadId"]),

  // Product Library
  productLibrary: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    sku: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    weight: v.optional(v.number()),
    material: v.optional(v.string()),
    color: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    isActive: v.boolean(),
  })
    .index("by_team", ["teamId"])
    .index("by_category", ["category"])
    .index("by_supplier", ["supplier"])
    .index("by_brand", ["brand"])
    .index("by_created_by", ["createdBy"]),

  // AI Chat Threads - conversation sessions
  aiThreads: defineTable({
    threadId: v.string(), // Unique thread identifier
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(), // User who started the thread
    title: v.optional(v.string()), // Optional thread title
    lastMessageAt: v.number(), // Timestamp of last message
    messageCount: v.optional(v.number()), // Total messages in thread
    lastMessagePreview: v.optional(v.string()),
    lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
    lastResponseId: v.optional(v.string()), // OpenAI Response ID (not currently used)
    agentThreadId: v.optional(v.string()), // Convex Agent Thread ID
    abortedAt: v.optional(v.number()), // Timestamp when user requested abort
  })
    .index("by_thread_id", ["threadId"])
    .index("by_project", ["projectId"])
    .index("by_user", ["userClerkId"]),

  // AI Chat Messages - individual messages in threads
  aiMessages: defineTable({
    threadId: v.string(), // Reference to aiThreads
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")), // Message sender
    content: v.string(), // Message content
    tokenUsage: v.optional(v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    })),
    ragContext: v.optional(v.string()), // RAG context used for this message
    metadata: v.optional(
      v.object({
        fileId: v.optional(v.string()),
        fileName: v.optional(v.string()),
        fileType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        mode: v.optional(v.string()),
      })
    ),
    messageIndex: v.number(), // Order of message in thread (0, 1, 2, ...)
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_index", ["threadId", "messageIndex"]),

  // AI Visualization Sessions - conversation sessions for image generation
  aiVisualizationSessions: defineTable({
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    userClerkId: v.string(),
    title: v.optional(v.string()), // Auto-generated from first prompt
    lastMessageAt: v.number(), // Timestamp for sorting
    messageCount: v.number(), // Number of messages in session
    imageCount: v.number(), // Number of generated images
    previewImageUrl: v.optional(v.string()), // URL of last generated image for preview
    previewStorageKey: v.optional(v.string()), // Storage key for preview
  })
    .index("by_team", ["teamId"])
    .index("by_team_and_user", ["teamId", "userClerkId"])
    .index("by_user", ["userClerkId"])
    .index("by_last_message", ["teamId", "lastMessageAt"]),

  // AI Visualization Messages - messages within a visualization session
  aiVisualizationMessages: defineTable({
    sessionId: v.id("aiVisualizationSessions"),
    teamId: v.id("teams"),
    role: v.union(v.literal("user"), v.literal("model")),
    text: v.string(),
    messageIndex: v.number(), // Order in conversation
    // For model messages with images
    imageStorageKey: v.optional(v.string()),
    imageMimeType: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    generationId: v.optional(v.id("aiGeneratedImages")), // Reference to generation record
    // For user messages with reference images
    referenceImages: v.optional(v.array(v.object({
      storageKey: v.string(),
      mimeType: v.string(),
      name: v.string(),
    }))),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_index", ["sessionId", "messageIndex"]),

  // AI Generated Images - tracks all image generations from Gemini
  aiGeneratedImages: defineTable({
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    sessionId: v.optional(v.id("aiVisualizationSessions")), // Link to conversation session
    prompt: v.string(),
    model: v.string(), // e.g. "gemini-3-pro-image-preview" or "gemini-2.5-flash-image"
    storageKey: v.optional(v.string()), // R2 storage key
    fileUrl: v.optional(v.string()), // Direct URL to image
    mimeType: v.string(),
    sizeBytes: v.optional(v.number()),
    durationMs: v.number(), // How long generation took
    promptTokens: v.optional(v.number()),
    responseTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    billableTokens: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    savedToFiles: v.boolean(), // Whether user saved it to project files
    fileId: v.optional(v.id("files")), // Reference to files table if saved
    referenceImageCount: v.optional(v.number()), // How many reference images were used
    textResponse: v.optional(v.string()), // Any text response from model
    error: v.optional(v.string()), // Error message if generation failed
    success: v.boolean(),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userClerkId"])
    .index("by_success", ["success"])
    .index("by_session", ["sessionId"]),

  // AI Function Calls - tracks function calls for threading continuity
  aiFunctionCalls: defineTable({
    threadId: v.string(), // Reference to aiThreads
    projectId: v.id("projects"),
    responseId: v.string(), // OpenAI Response ID that generated this call
    callId: v.string(), // OpenAI call_id for the function call
    functionName: v.string(), // Name of the function called
    arguments: v.string(), // JSON stringified arguments
    result: v.optional(v.string()), // JSON stringified result after confirmation
    status: v.union(
      v.literal("pending"), // Waiting for user confirmation
      v.literal("confirmed"), // User confirmed, executed
      v.literal("rejected"), // User rejected
      v.literal("replayed"), // Already replayed in a subsequent message
    ),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_status", ["threadId", "status"])
    .index("by_response_id", ["responseId"]),

  // Messaging platform channels connected to assistants/projects.
  messagingChannels: defineTable({
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    externalUserId: v.string(), // Telegram chat ID / external platform user ID
    userClerkId: v.optional(v.string()), // Internal user who approved pairing
    threadId: v.optional(v.string()), // AI thread bound to this channel
    isActive: v.boolean(),
    lastMessageAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_platform_and_external_id", ["platform", "externalUserId"])
    .index("by_user", ["userClerkId"]),

  // Temporary pairing tokens.
  messagingPairingTokens: defineTable({
    token: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    usedByExternalId: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_project_and_platform", ["projectId", "platform"])
    .index("by_user", ["userClerkId"]),

  // Pending pairing requests awaiting approval in assistant settings.
  messagingPairingRequests: defineTable({
    projectId: v.id("projects"),
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    externalUserId: v.string(),
    pairingCode: v.string(),
    metadata: v.optional(v.any()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_code", ["pairingCode"])
    .index("by_external_id", ["platform", "externalUserId"]),




});
