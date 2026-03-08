# Myvibe project

**Architektoniczny Project Manager**

Myvibe project is a comprehensive project management tool tailored for architectural projects. It manages teams, projects, tasks, finances (shopping lists, labor, estimations), and interactions with clients through surveys. It features robust AI integration for chat assistance and visualizations.

## 🤖 AI Agent Context
**This section is specifically designed to help AI agents understand the codebase.**

### Architecture Overview
- **Frontend**: Next.js 15 (App Router).
- **Database**: Convex (Realtime, Relational-like document store).
- **Authentication**: Clerk (Organizations mapped to "Teams").
- **Styling**: Tailwind CSS + Shadcn UI.
- **State Management**: React Query (via Convex), Jotai (local state).
- **Rich Text**: Tiptap.

### Key Entities & Relationships (Convex Schema)
*See `convex/schema.ts` for authoritative definitions.*

1.  **Teams (`teams`)**: The top-level hierarchy, mapped 1:1 to Clerk Organizations. Controls subscription status and global settings (currencies, timezone).
2.  **Projects (`projects`)**: Belong to a Team. Contain most operational data (Tasks, Files, Shopping Lists).
    - Statuses: planning, active, on_hold, completed, cancelled.
    - Includes customer portal publishing fields (`clientPanelAccessToken`, panel snapshot settings/version).
3.  **Tasks (`tasks`)**: Work items within a Project.
    - Managed on a Kanban board (todo, in_progress, review, done).
    - Linked to `projects` and `teams`.
4.  **Financials**:
    - `shoppingListItems` & `shoppingListSections`: Material tracking.
    - `laborItems` & `laborSections`: Work/Service tracking.
    - `costEstimations`: Quotes generated from selected shopping/labor items.
5.  **Files (`files`)**: Unified file storage (R2/S3 backed via Convex).
    - Supports `image`, `video`, `pdf`, etc.
    - Integrated with **AI** for text extraction (`extractedText`) and analysis (`pdfAnalysis`).
6.  **AI Integration**:
    - `aiThreads`: Chat sessions with the AI assistant.
    - `aiMessages`: Individual messages in a thread (user/assistant roles).
    - `aiVisualizationSessions`: Dedicated sessions for image generation/visualization.
    - `aiTokenUsage`: Tracks token consumption per user/team.

### Directory Structure
- `/app`: Next.js App Router pages.
    - `/dashboard`: Main authenticated application area.
    - `/organisation`: Organization/Team management.
    - `/onboarding`: User onboarding flows.
    - `/api`: Next.js API Routes (webhooks, etc.).
- `/convex`: Backend logic (schema, queries, mutations, actions).
- `/components`: UI components (feature-based and generic UI).
    - `/ui`: Shadcn/Radix primitives.
    - `/ai`: AI-specific components (chat, visualizations).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- npm / pnpm
- Convex Account
- Clerk Account

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd myvibeproject
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Environment Setup**:
    Create `.env.local` and populate it with keys for Clerk, Convex, OpenAI, Stripe, etc.
    For client-portal email alerts via Resend, add:
    - `RESEND_API_KEY`
    - `RESEND_FROM_EMAIL` (must be a verified sender/domain in Resend, e.g. `Myvibe <notifications@yourdomain.com>`)
    - `NEXT_PUBLIC_BASE_URL` (used for links in email, e.g. `https://app.yourdomain.com`)
    *(See `.env.example` if available)*

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    This starts both the Next.js frontend and the Convex backend.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Convex](https://convex.dev/)
- **Auth**: [Clerk](https://clerk.com/)
- **UI System**: [Tailwind CSS](https://tailwindcss.com/)
- **Payments**: [Stripe](https://stripe.com/)
- **AI**: OpenAI, Google GenAI

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
