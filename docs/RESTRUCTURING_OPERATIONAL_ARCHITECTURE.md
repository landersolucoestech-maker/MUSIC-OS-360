> Historical record. Kept as recorded; not the current contract.

> Point-in-time planning document (2026-05-20). Current contract: `docs/engineering/README.md`.

# 🎵 MUSIC OS 360 — DEFINITIVE CONTEXTUAL OPERATIONAL ARCHITECTURE

**Version**: 1.0 — Complete Restructuring  
**Date**: 2026-05-20  
**Status**: Planning → Gradual Implementation  

---

## 📋 TABLE OF CONTENTS

1. [Analysis of the Current Structure](#current-analysis)
2. [New Vision: Operational Workspaces](#new-vision)
3. [Contextual Architecture](#architecture)
4. [Smart Navigation](#navigation)
5. [Global UX Standards](#ux-standards)
6. [Technical Structure](#technical-structure)
7. [Route Hierarchy](#routes)
8. [Component System](#components)
9. [Activity & Realtime System](#activity-system)
10. [Implementation Strategy](#implementation)

---

## 1. ANALYSIS OF THE CURRENT STRUCTURE {#current-analysis}

### Existing Modules (Fragmented)
```
accounting/     → Transactions, Invoices
admin/          → Admin Panel
ai/             → Creative AI
artist/         → Artists
auth/           → Authentication
catalog/        → Works Catalog
contracts/      → Contracts
crm/            → CRM
dashboard/      → Generic Dashboard
events/         → Agenda
integrations/   → Integrations
inventory/      → Inventory
leads/          → Leads
licensing/      → Licensing
marketing/      → Marketing
monitoring/     → Rights Monitoring
projects/       → Projects
releases/       → Release Distribution
reports/        → Reports
rh/             → Human Resources
settings/       → Settings
support/        → Support
```

### Identified Problem
- **Menu navigation**: 22+ loose modules
- **Loss of context**: the user navigates from module to module
- **Lack of unification**: Artist, Release, Project are separate
- **Fragmented UX**: each module with its own pattern
- **No timelines**: no integrated activity tracking
- **No operational context**: everything isolated

### Main Entities Identified
- **Artist** (`Artista`, core)
- **Release** (`Lançamento`, core)
- **Work** (`Obra`, composition, core)
- **Contract** (`Contrato`, core)
- **Transaction** (`Transação`, financial)
- **Campaign** (`Campanha`, marketing)
- **Project** (`Projeto`, generic tasks)
- **Task** (`Tarefa`)
- **Event** (`Evento`, calendar)
- **Invoice** (`Nota Fiscal`, fiscal)
- **Sharing** (`Compartilhamento`, shares/external rights receipts)

---

## 2. NEW VISION: OPERATIONAL WORKSPACES {#new-vision}

### Core Concept

**NOT** loose modules.  
**YES** integrated operational contexts.

```
Workspace = Contextual Operational Center of an Entity
```

### The 5 Main Workspaces

#### **1️⃣ ARTIST WORKSPACE**
Operational hub of the artist's career.

```
/workspace/artist/:artistId

├── Overview              (KPIs, releases, active campaigns)
├── Releases              (all releases)
├── Campaigns             (linked campaigns)
├── Collaborations        (active partnerships)
├── Financeiro (Financial)  (revenue, external rights receipts)
├── Contracts             (active and archived contracts)
├── Tasks                 (artist tasks)
├── Assets                (avatars, photos, etc)
├── Team                  (team, collaborators)
├── Calendar              (events and important dates)
├── Analytics             (streams, performance)
├── Activity Timeline     (history of operations)
├── Conversations         (comments and mentions)
├── Approvals             (pending approvals)
└── Settings              (artist settings)
```

**Expected feeling**: "Everything about the artist's career is here"

---

#### **2️⃣ RELEASE WORKSPACE**
Operational hub of the release.

```
/workspace/release/:releaseId

├── Overview              (status, progress, KPIs)
├── Distribution          (platforms, release dates)
├── Assets                (covers, thumbnails, videos)
├── Marketing             (linked campaigns)
├── Content Calendar      (post calendar)
├── Tasks                 (release tasks)
├── Team                  (artists, producers, features)
├── Schedule              (action timeline)
├── Pre-release           (pre-save, playlist pitching)
├── Financial             (costs, revenue)
├── Recebimentos externos de direitos (External rights receipts)  (songwriter splits)
├── Analytics             (streams, listeners)
├── Approvals             (pending approvals)
├── Deliverables          (required files)
├── Activity Timeline     (release operations)
└── Conversations         (project discussions)
```

**Expected feeling**: "I control the whole operation of this release without leaving here"

---

#### **3️⃣ CAMPAIGN WORKSPACE**
Operational hub of marketing campaigns.

```
/workspace/campaign/:campaignId

├── Overview              (goals, budget, KPIs)
├── Goals                 (objectives and metrics)
├── Budget                (allocation, expenses)
├── Tasks                 (campaign tasks)
├── Content               (posts, stories, reels)
├── Assets                (banners, images)
├── Creators              (influencers, collaborators)
├── Timeline              (campaign milestones)
├── Schedule              (scheduled posts)
├── Channels              (Instagram, TikTok, etc)
├── Analytics             (engagement, conversion)
├── Reports               (performance reports)
├── Activity              (history of operations)
└── Conversations         (discussions)
```

**Expected feeling**: "The whole campaign in a single place"

---

#### **4️⃣ PROJECT WORKSPACE**
Operational hub of generic projects.

```
/workspace/project/:projectId

├── Overview              (status, progress)
├── Tasks                 (kanban/list tasks)
├── Timeline              (milestones)
├── Team                  (members)
├── Assets                (files)
├── Budget                (budget)
├── Schedule              (calendar)
├── Analytics             (custom KPIs)
├── Activity              (history)
└── Conversations         (discussions)
```

---

#### **5️⃣ CONTRACT WORKSPACE**
Operational hub of the contract.

```
/workspace/contract/:contractId

├── Overview              (status, important dates)
├── Document              (contract viewer)
├── Financial             (amounts, payments)
├── Parties               (parties involved)
├── Obligations           (obligations)
├── Milestones            (milestones)
├── Tasks                 (associated tasks)
├── History               (event timeline)
├── Approvals             (signatures)
├── Activity              (changes)
└── Conversations         (discussions)
```

---

### Secondary Workspaces (Smaller Contexts)

#### **WORK WORKSPACE (`OBRA WORKSPACE`)** `/workspace/work/:workId`
```
├── Overview              (metadata, ISWC)
├── Registros (Registrations)  (rights, ECAD)
├── Compartilhamento (Sharing) (songwriter shares)
├── Releases              (which releases use it)
├── Recebimentos externos de direitos (External rights receipts)  (history of external rights receipts)
├── Aprovações (Approvals)  (registration, approval)
└── Activity              (history)
```

#### **EVENT WORKSPACE (`EVENTO WORKSPACE`)** `/workspace/event/:eventId`
```
├── Overview              (date, venue, details)
├── Lineup                (artists)
├── Tasks                 (event tasks)
├── Budget                (costs)
├── Timeline              (schedule)
├── Team                  (production team)
├── Logistics             (transport, lodging)
├── Analytics             (commercial, attendance)
└── Activity              (history)
```

---

## 3. CONTEXTUAL ARCHITECTURE {#architecture}

### 3.1 Route Organization

```
/workspace
  /artist/:id
    /overview
    /releases
    /campaigns
    /financial
    /contracts
    /tasks
    /assets
    /team
    /calendar
    /analytics
    /activity
    /conversations
    /approvals
    /settings

  /release/:id
    /overview
    /distribution
    /assets
    /marketing
    /content
    /tasks
    /team
    /schedule
    /financial
    /recebimentos externos de direitos
    /analytics
    /approvals
    /activity
    /conversations

  /campaign/:id
    /overview
    /goals
    /budget
    /tasks
    /content
    /assets
    /creators
    /timeline
    /schedule
    /analytics
    /reports
    /activity

  /project/:id
    /overview
    /tasks
    /timeline
    /team
    /assets
    /budget
    /schedule
    /activity

  /contract/:id
    /overview
    /document
    /financial
    /parties
    /obligations
    /tasks
    /approvals
    /activity

/library (quick access to all resources)
  /artists
  /releases
  /campaigns
  /contracts
  /projects
  /works
  /events

/dashboard (organization overview)
  /overview
  /kpis
  /recent-activity
  /approvals-pending

/settings
  /organization
  /team
  /integrations
  /workflows
  /notifications
```

### 3.2 Reorganized Module Folder Structure

```
apps/web/src/modules/
├── workspace/                      # NEW: Workspace orchestrator
│   ├── components/
│   │   ├── WorkspaceShell.tsx
│   │   ├── WorkspaceNav.tsx
│   │   ├── WorkspaceSidebar.tsx
│   │   ├── WorkspaceHeader.tsx
│   │   ├── ActivityTimeline.tsx
│   │   └── ContextualQuickActions.tsx
│   ├── hooks/
│   │   ├── useWorkspaceContext.ts
│   │   ├── useWorkspaceNav.ts
│   │   └── useActivityFeed.ts
│   ├── layouts/
│   │   ├── WorkspaceLayout.tsx
│   │   └── WorkspaceSidebarLayout.tsx
│   └── types/
│       └── workspace.types.ts
│
├── contexts/                       # NEW: Operational contexts
│   ├── artist-workspace/
│   ├── release-workspace/
│   ├── campaign-workspace/
│   ├── project-workspace/
│   └── contract-workspace/
│
├── artist/                         # REFACTOR: From isolated module to data provider
│   ├── components/
│   │   └── → moved to workspace/contexts/artist-workspace
│   ├── pages/
│   │   └── → archived (use workspace)
│   ├── services/
│   ├── hooks/
│   ├── types/
│   └── queries/
│
├── releases/                       # REFACTOR: From isolated module to data provider
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   └── queries/
│
├── campaigns/                      # NEW: Extract from marketing
│   ├── components/
│   ├── services/
│   ├── types/
│   └── queries/
│
├── activity-log/                   # NEW: Centralized activity system
│   ├── components/
│   │   ├── ActivityTimeline.tsx
│   │   ├── ActivityCard.tsx
│   │   └── ActivityFeed.tsx
│   ├── services/
│   ├── hooks/
│   ├── types/
│   └── queries/
│
├── shared-workspace-components/    # NEW: Reusable components
│   ├── OverviewCard.tsx
│   ├── MetricsGrid.tsx
│   ├── TimelineSection.tsx
│   ├── TeamMembersCard.tsx
│   ├── TaskList.tsx
│   ├── FileUploadZone.tsx
│   ├── ContextualQuickActions.tsx
│   └── WorkspaceEmptyState.tsx
│
└── [other modules stay, but decentralized]
```

---

## 4. SMART NAVIGATION {#navigation}

### 4.1 Contextual Sidebar

**Today**: Generic menu with 22 modules  
**Tomorrow**: Sidebar that changes according to the context

```
CONTEXTUAL SIDEBAR STRUCTURE

┌─────────────────────────────────────┐
│ 🎵 Music OS 360                     │
├─────────────────────────────────────┤
│ [Current Workspace Indicator]       │
│                                     │
│ 🎤 MC Lander                        │  ← Current context
│ Artist Workspace                    │
├─────────────────────────────────────┤
│ WORKSPACE NAVIGATION                │
│ • Overview        [current]         │
│ • Releases        (3)               │
│ • Campaigns       (1)               │
│ • Financial       [pending]         │
│ • Tasks          (5)               │
│ • Calendar                          │
│ • Team                              │
├─────────────────────────────────────┤
│ QUICK ACCESS                        │
│ • Create Release                    │
│ • New Campaign                      │
│ • Upload Asset                      │
├─────────────────────────────────────┤
│ LIBRARY (Global)                    │
│ • Artists                           │
│ • Releases                          │
│ • Projects                          │
│ • Campaigns                         │
│ • Contracts                         │
├─────────────────────────────────────┤
│ SYSTEM                              │
│ • Dashboard                         │
│ • Settings                          │
│ • Help & Support                    │
│ • [User Menu]                       │
└─────────────────────────────────────┘
```

### 4.2 Operational Breadcrumb

```
Music OS → Workspace: Artist MC Lander → Overview
           Workspace: Release "Noite Fria" → Distribution
           Workspace: Campaign "Summer 2026" → Analytics
```

### 4.3 Command Center (⌘K / Ctrl+K)

```
Global fuzzy search + contextual actions:

> artist mc lander
  🎤 Go to Artist Workspace
  📊 View Analytics
  📋 Create Release
  👥 Manage Team

> release "noite fria"
  🎵 Open Release
  📊 View Analytics
  🎬 Manage Assets
  ✅ View Approvals

> campaign summer 2026
  📢 Open Campaign
  📊 Analytics
  ✏️ Edit Details
  🗓️ View Schedule
```

### 4.4 Contextual Quick Actions

In each workspace, top-right:

```
[+ Add] [⋯ More] [? Help]
```

Which expands to:
```
+ Create Release
+ Add Collaborator
+ Upload Asset
+ Create Task
+ Schedule Post
```

---

## 5. GLOBAL UX STANDARDS {#ux-standards}

### 5.1 Anatomy of a Workspace

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar  │ Header                                            │
│ (Nav)    ├─────────────────────────────────────────────────┤
│          │ Breadcrumb | Title & Status | Quick Actions      │
│          ├─────────────────────────────────────────────────┤
│          │                                                   │
│          │ Tabs / Navigation (Horizontal)                   │
│          │ Overview | Releases | Tasks | Financial | ...    │
│          │                                                   │
│          ├─────────────────────────────────────────────────┤
│          │                                                   │
│          │              MAIN CONTENT AREA                   │
│          │                                                   │
│          │  (Grid, Cards, Tables, Kanban, Tabs)            │
│          │                                                   │
│          │                                                   │
│          │                                                   │
│          ├─────────────────────────────────────────────────┤
│          │ Contextual Sidebar (Right, Optional)             │
│          │ - Compact Timeline                               │
│          │ - Quick Stats                                    │
│          │ - Pending Actions                                │
│          │ - Recent Activity                                │
│          │                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Standardized Card Pattern

```tsx
// WorkspaceCard - reusable pattern
<Card className="workspace-card">
  <CardHeader>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </div>
      <Badge variant="secondary" className="text-xs">{status}</Badge>
    </div>
    {subtitle && <CardDescription>{subtitle}</CardDescription>}
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter className="flex gap-2">
    {/* Actions */}
  </CardFooter>
</Card>
```

### 5.3 Standard Activity Timeline

```
Compact timeline with:
- Operation icon
- Timestamp
- Description
- Author (avatar)
- Context (link)

Example (PT-BR UI copy: "Release distributed to DSPs, 2 hours ago by João Silva";
"Asset approved, 4 hours ago by Maria Santos"; "Payment processed, 1 day ago"):
┌─────────────────────────────────────────┐
│ 📤 Release distribuído para DSPs        │
│ há 2 horas por João Silva               │
│                                          │
│ 👤 Asset aprovado                       │
│ há 4 horas por Maria Santos             │
│                                          │
│ 💰 Pagamento processado                 │
│ há 1 dia                                │
└─────────────────────────────────────────┘
```

### 5.4 Standardized Visual States

```
State (PT-BR label)  | Color        | Icon         | Meaning
────────────────────┼──────────────┼──────────────┼──────────
Ativo (Active)      | Green        | CheckCircle  | Operational
Pendente (Pending)  | Amber        | Clock        | Waiting
Bloqueado (Blocked) | Red          | AlertCircle  | Attention
Rascunho (Draft)    | Gray         | FileText     | Incomplete
Arquivado (Archived)| Muted        | Archive      | History
Processando (Processing) | Blue    | Loader       | In progress
```

### 5.5 Workspace Table Pattern

```
┌──────────────────────────────────────────────┐
│ ☐ Item | Status | Date | Owner | Actions (⋯) │
├──────────────────────────────────────────────┤
│ ☐ ... | ⚡ ... | ... | @... | ⋯             │
│ ☐ ... | ✓  ... | ... | @... | ⋯             │
└──────────────────────────────────────────────┘

Always:
- Checkbox for bulk actions
- Status with a visual badge
- Creation/modification date
- Owner/author
- Actions menu (⋯)
```

### 5.6 Empty States

```
When opening an empty workspace (PT-BR UI copy: "No release registered" /
"Start creating your first release"):

    🎵
    
Nenhum lançamento registrado

"Comece a criar seu primeiro lançamento"

[+ Create Release] [Learn More]
```

---

## 6. TECHNICAL STRUCTURE {#technical-structure}

### 6.1 Context Architecture

```typescript
// contexts/WorkspaceContext.tsx
interface WorkspaceContextValue {
  // Identification
  workspaceType: 'artist' | 'release' | 'campaign' | 'project' | 'contract';
  workspaceId: string;
  
  // Entity
  entity: Artist | Release | Campaign | Project | Contract;
  isLoading: boolean;
  error: Error | null;
  
  // Navigation
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  
  // UI state
  selectedItems: string[];
  setSelectedItems: (ids: string[]) => void;
  
  // Activity
  activities: Activity[];
  isLoadingActivities: boolean;
  
  // Realtime
  isConnected: boolean;
  subscribers: number;
}

export const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);
```

### 6.2 Standard Hook

```typescript
// hooks/useWorkspaceContext.ts
export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return context;
}
```

### 6.3 Query Structure

```typescript
// queries/useArtistWorkspace.ts
export function useArtistWorkspace(artistId: string) {
  // Load artist
  const artist = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => artistService.getById(artistId),
  });
  
  // Load releases
  const releases = useQuery({
    queryKey: ['releases', artistId],
    queryFn: () => releaseService.getByArtist(artistId),
  });
  
  // Load activities
  const activities = useQuery({
    queryKey: ['activities', artistId],
    queryFn: () => activityService.getByEntity('artist', artistId),
  });
  
  // Load financial
  const financial = useQuery({
    queryKey: ['financial', artistId],
    queryFn: () => financialService.getByArtist(artistId),
  });
  
  return {
    artist: artist.data,
    releases: releases.data,
    activities: activities.data,
    financial: financial.data,
    isLoading: artist.isPending || releases.isPending,
    error: artist.error || releases.error,
  };
}
```

### 6.4 Realtime Integration

```typescript
// hooks/useWorkspaceRealtime.ts
export function useWorkspaceRealtime(
  workspaceType: string,
  entityId: string
) {
  const { supabase } = useSupabase();
  
  useEffect(() => {
    // Subscribe to updates
    const channel = supabase
      .channel(`workspace:${workspaceType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: workspaceType,
          filter: `id=eq.${entityId}`,
        },
        (payload) => {
          // Update context
          invalidateQuery([workspaceType, entityId]);
        }
      )
      .subscribe();
    
    return () => channel.unsubscribe();
  }, [workspaceType, entityId]);
}
```

### 6.5 Activity System

```typescript
// services/activityService.ts
export class ActivityService {
  // Records an action
  async logActivity(data: {
    entityType: 'artist' | 'release' | 'campaign' | 'project' | 'contract';
    entityId: string;
    action: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'published';
    description: string;
    userId: string;
    metadata?: Record<string, any>;
  }) {
    return db.insert('activity_logs').values({
      ...data,
      created_at: new Date(),
    });
  }
  
  // Loads the activities of an entity
  async getByEntity(entityType: string, entityId: string) {
    return db
      .select()
      .from('activity_logs')
      .where('entity_type', entityType)
      .where('entity_id', entityId)
      .orderBy('created_at', 'desc')
      .limit(50);
  }
}
```

---

## 7. ROUTE HIERARCHY {#routes}

### 7.1 Reorganized Routes File

```typescript
// app/routes/workspace.routes.tsx
export const workspaceRoutes = [
  // Artist Workspace
  {
    path: "/workspace/artist/:artistId",
    element: <P><ArtistWorkspaceLayout /></P>,
    children: [
      { path: "overview", element: <ArtistOverview /> },
      { path: "releases", element: <ArtistReleases /> },
      { path: "campaigns", element: <ArtistCampaigns /> },
      { path: "financial", element: <ArtistFinancial /> },
      { path: "contracts", element: <ArtistContracts /> },
      { path: "tasks", element: <ArtistTasks /> },
      { path: "assets", element: <ArtistAssets /> },
      { path: "team", element: <ArtistTeam /> },
      { path: "calendar", element: <ArtistCalendar /> },
      { path: "analytics", element: <ArtistAnalytics /> },
      { path: "activity", element: <ArtistActivity /> },
      { path: "conversations", element: <ArtistConversations /> },
      { path: "approvals", element: <ArtistApprovals /> },
      { path: "settings", element: <ArtistSettings /> },
      { path: "", element: <Navigate to="overview" /> },
    ],
  },
  
  // Release Workspace
  {
    path: "/workspace/release/:releaseId",
    element: <P><ReleaseWorkspaceLayout /></P>,
    children: [
      { path: "overview", element: <ReleaseOverview /> },
      { path: "distribution", element: <ReleaseDistribution /> },
      { path: "assets", element: <ReleaseAssets /> },
      { path: "marketing", element: <ReleaseMarketing /> },
      { path: "content", element: <ReleaseContent /> },
      { path: "tasks", element: <ReleaseTasks /> },
      { path: "team", element: <ReleaseTeam /> },
      { path: "schedule", element: <ReleaseSchedule /> },
      { path: "financial", element: <ReleaseFinancial /> },
      { path: "recebimentos externos de direitos", element: <ReleaseRecebimentos externos de direitos /> },
      { path: "analytics", element: <ReleaseAnalytics /> },
      { path: "approvals", element: <ReleaseApprovals /> },
      { path: "activity", element: <ReleaseActivity /> },
      { path: "", element: <Navigate to="overview" /> },
    ],
  },
  
  // Campaign Workspace
  {
    path: "/workspace/campaign/:campaignId",
    element: <P><CampaignWorkspaceLayout /></P>,
    children: [
      { path: "overview", element: <CampaignOverview /> },
      { path: "goals", element: <CampaignGoals /> },
      { path: "budget", element: <CampaignBudget /> },
      { path: "tasks", element: <CampaignTasks /> },
      { path: "content", element: <CampaignContent /> },
      { path: "creators", element: <CampaignCreators /> },
      { path: "timeline", element: <CampaignTimeline /> },
      { path: "schedule", element: <CampaignSchedule /> },
      { path: "analytics", element: <CampaignAnalytics /> },
      { path: "reports", element: <CampaignReports /> },
      { path: "activity", element: <CampaignActivity /> },
      { path: "", element: <Navigate to="overview" /> },
    ],
  },
  
  // Project Workspace
  {
    path: "/workspace/project/:projectId",
    element: <P><ProjectWorkspaceLayout /></P>,
    children: [
      { path: "overview", element: <ProjectOverview /> },
      { path: "tasks", element: <ProjectTasks /> },
      { path: "timeline", element: <ProjectTimeline /> },
      { path: "team", element: <ProjectTeam /> },
      { path: "assets", element: <ProjectAssets /> },
      { path: "activity", element: <ProjectActivity /> },
      { path: "", element: <Navigate to="overview" /> },
    ],
  },
  
  // Contract Workspace
  {
    path: "/workspace/contract/:contractId",
    element: <P><ContractWorkspaceLayout /></P>,
    children: [
      { path: "overview", element: <ContractOverview /> },
      { path: "document", element: <ContractDocument /> },
      { path: "financial", element: <ContractFinancial /> },
      { path: "parties", element: <ContractParties /> },
      { path: "obligations", element: <ContractObligations /> },
      { path: "milestones", element: <ContractMilestones /> },
      { path: "activity", element: <ContractActivity /> },
      { path: "", element: <Navigate to="overview" /> },
    ],
  },
];

// app/routes/library.routes.tsx
export const libraryRoutes = [
  { path: "/library/artists", element: <P><ArtistsLibrary /></P> },
  { path: "/library/releases", element: <P><ReleasesLibrary /></P> },
  { path: "/library/campaigns", element: <P><CampaignsLibrary /></P> },
  { path: "/library/projects", element: <P><ProjectsLibrary /></P> },
  { path: "/library/contracts", element: <P><ContractsLibrary /></P> },
  { path: "/library/works", element: <P><WorksLibrary /></P> },
  { path: "/library/events", element: <P><EventsLibrary /></P> },
];
```

---

## 8. COMPONENT SYSTEM {#components}

### 8.1 Reusable Components for Workspaces

```typescript
// components/shared-workspace/WorkspaceCard.tsx
export function WorkspaceCard({
  icon: Icon,
  title,
  subtitle,
  status,
  children,
  action,
  footer,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  status?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {subtitle && <CardDescription>{subtitle}</CardDescription>}
            </div>
          </div>
          {status && <Badge variant="secondary">{status}</Badge>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {(action || footer) && (
        <CardFooter className="flex items-center justify-between">
          <div>{footer}</div>
          <div>{action}</div>
        </CardFooter>
      )}
    </Card>
  );
}

// components/shared-workspace/WorkspaceMetrics.tsx
export function WorkspaceMetrics({
  metrics,
}: {
  metrics: Array<{
    label: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: 'up' | 'down' | 'neutral';
    color: 'primary' | 'success' | 'warning' | 'destructive';
  }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {m.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{m.value}</p>
              </div>
              <m.icon className={cn("h-8 w-8", colorClass(m.color))} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// components/shared-workspace/WorkspaceActivityTimeline.tsx
export function WorkspaceActivityTimeline({
  activities,
  isLoading,
}: {
  activities: Activity[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex gap-3">
          <div className="relative flex flex-col items-center">
            <activity.iconComponent className="h-4 w-4 text-muted-foreground" />
            {i < activities.length - 1 && (
              <div className="absolute top-6 w-0.5 h-6 bg-border" />
            )}
          </div>
          <div className="flex-1 pb-6">
            <p className="text-sm font-medium text-foreground">
              {activity.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(activity.created_at), {
                locale: ptBR,
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// components/shared-workspace/WorkspaceTeamCard.tsx
export function WorkspaceTeamCard({
  team,
  onAddMember,
  onRemoveMember,
}: {
  team: TeamMember[];
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Team</CardTitle>
          <Button size="sm" variant="ghost" onClick={onAddMember}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {team.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatarUrl} />
                  <AvatarFallback>{member.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveMember(member.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// components/shared-workspace/WorkspaceContextualSidebar.tsx
export function WorkspaceContextualSidebar({
  workspace,
  activities,
  pendingApprovals,
  quickStats,
}) {
  return (
    <div className="sticky top-0 h-screen overflow-y-auto border-l border-border bg-card/50 p-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </h3>
        <WorkspaceActivityTimeline activities={activities.slice(0, 5)} />
      </div>
      
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pending
        </h3>
        {pendingApprovals.map((approval) => (
          <div key={approval.id} className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs">
            {approval.description}
          </div>
        ))}
      </div>
      
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Stats
        </h3>
        {quickStats.map((stat) => (
          <div key={stat.label} className="flex justify-between text-xs py-1">
            <span className="text-muted-foreground">{stat.label}</span>
            <span className="font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 8.2 Layout Components

```typescript
// layouts/WorkspaceLayout.tsx
export function WorkspaceLayout({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: React.ReactNode;
}) {
  const { currentTab, setCurrentTab } = useWorkspaceContext();
  const tabs = WORKSPACE_TABS[workspace.type];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <WorkspaceSidebar workspace={workspace} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <WorkspaceHeader workspace={workspace} />

        {/* Tabs */}
        <div className="border-b border-border bg-card/50 px-6">
          <div className="flex gap-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={cn(
                  'py-3 text-sm font-medium border-b-2 transition-colors',
                  currentTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.badge && (
                  <Badge className="ml-2" variant="secondary">
                    {tab.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>

      {/* Contextual Sidebar (Right) */}
      <WorkspaceContextualSidebar workspace={workspace} />
    </div>
  );
}
```

---

## 9. ACTIVITY & REALTIME SYSTEM {#activity-system}

### 9.1 Database Schema

```sql
-- activity_logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity and Operation
  entity_type VARCHAR NOT NULL,  -- 'artist', 'release', 'campaign', etc
  entity_id UUID NOT NULL,
  action VARCHAR NOT NULL,       -- 'created', 'updated', 'approved', etc
  
  -- Description and Metadata
  description TEXT NOT NULL,
  metadata JSONB,
  
  -- Author
  user_id UUID NOT NULL,
  user_name VARCHAR,
  user_avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX (entity_type, entity_id, created_at DESC),
  INDEX (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- real-time subscriptions
CREATE TABLE realtime_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id UUID NOT NULL,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (user_id, entity_type, entity_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 9.2 Activity Middleware (Backend)

```typescript
// api/middleware/activityLogger.ts
export async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  description: string,
  userId: string,
  metadata?: Record<string, any>
) {
  const db = getDatabase();
  
  await db.insert('activity_logs').values({
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    user_id: userId,
    user_name: user.name,
    user_avatar_url: user.avatar_url,
    metadata,
    created_at: new Date(),
  });
  
  // Broadcast to realtime subscribers
  await broadcastActivity({
    entityType,
    entityId,
    action,
    description,
    user: { id: userId, name: user.name, avatar: user.avatar_url },
  });
}

// Usage example (the activity description is PT-BR user-facing copy: "Release ... was updated"):
app.patch('/api/releases/:id', async (req, res) => {
  const release = await updateRelease(req.params.id, req.body);
  
  await logActivity(
    'release',
    req.params.id,
    'updated',
    `Release "${release.nome}" foi atualizada`,
    req.user.id,
    { changes: req.body }
  );
  
  res.json(release);
});
```

---

## 10. IMPLEMENTATION STRATEGY {#implementation}

### 10.1 Implementation Timeline (Non-disruptive)

```
PHASE 1: Foundation (Weeks 1-2)
├── [ ] Create the folder structure for workspace/
├── [ ] Implement WorkspaceContext
├── [ ] Create base hooks (useWorkspaceContext, etc)
├── [ ] Implement ActivityService in the backend
├── [ ] Create the activity_logs and realtime_subscribers tables
└── Result: Technical infrastructure ready

PHASE 2: Artist Workspace (Weeks 3-4)
├── [ ] Create ArtistWorkspaceLayout
├── [ ] Implement Artist Overview
├── [ ] Integrate Releases view
├── [ ] Add Activity Timeline
├── [ ] Connect Financial view
└── Result: Artist Workspace functional

PHASE 3: Release Workspace (Weeks 5-6)
├── [ ] Create ReleaseWorkspaceLayout
├── [ ] Implement Release Overview
├── [ ] Integrate Distribution view
├── [ ] Add Assets management
├── [ ] Connect Analytics
└── Result: Release Workspace functional

PHASE 4: Campaign Workspace (Week 7)
├── [ ] Create CampaignWorkspaceLayout
├── [ ] Implement Campaign Overview
├── [ ] Integrate Goals and Budget
├── [ ] Add Analytics
└── Result: Campaign Workspace functional

PHASE 5: Library & Navigation (Week 8)
├── [ ] Create Library pages (Artists, Releases, etc)
├── [ ] Implement Contextual Sidebar
├── [ ] Add Command Center (⌘K)
├── [ ] Integrate Quick Actions
└── Result: Complete contextual navigation

PHASE 6: Polish & Optimization (Week 9)
├── [ ] Performance tests
├── [ ] Realtime synchronization testing
├── [ ] UI/UX refinements
├── [ ] Documentation
└── Result: System ready for production
```

### 10.2 Zero-Breaking-Changes Strategy

**All the old modules stay functional**

```
Today:
/artistas         → Artist List Page
/accounting       → Accounting Page

After (addition, not replacement):
/artistas                  → Artist List (keeps working)
/accounting                → Accounting (keeps working)

/workspace/artist/:id      → Artist Workspace (new)
/workspace/release/:id     → Release Workspace (new)

Gradually:
1. Add links to workspaces in the old modules
2. Update the sidebar to show both routes
3. Migrate data and relationships
4. Deprecate the old modules after validation
```

### 10.3 Implementation Checklist

```
INITIAL SETUP
[ ] Create the /modules/workspace folder
[ ] Create /modules/activity-log
[ ] Create /modules/shared-workspace-components
[ ] Setup of types and interfaces
[ ] Setup of queries and services

FIRST ENTITY (Artist)
[ ] ArtistWorkspaceLayout.tsx
[ ] WorkspaceContext (artist-specific)
[ ] useArtistWorkspace hook
[ ] Artist Overview page
[ ] Artist Releases section
[ ] Artist Financial section
[ ] Artist Activity Timeline
[ ] Artist Settings
[ ] Link from the artist module → workspace

SECOND ENTITY (Release)
[ ] ReleaseWorkspaceLayout.tsx
[ ] useReleaseWorkspace hook
[ ] Release Overview
[ ] Release Distribution
[ ] Release Assets
[ ] Release Analytics
[ ] Link from the releases module → workspace

THIRD ENTITY (Campaign)
[ ] CampaignWorkspaceLayout.tsx
[ ] useCampaignWorkspace hook
[ ] Campaign Overview
[ ] Campaign Goals and Budget
[ ] Campaign Analytics
[ ] Link from the marketing module → workspace

LIBRARY & NAVIGATION
[ ] /library/artists page
[ ] /library/releases page
[ ] /library/campaigns page
[ ] Contextual Sidebar component
[ ] Command Center component
[ ] Quick Actions component
[ ] Sidebar updates

ACTIVITY SYSTEM
[ ] Activity service backend
[ ] Activity logs table
[ ] Real-time subscriptions
[ ] Activity Timeline component
[ ] Activity feed in workspaces

TESTING & OPTIMIZATION
[ ] Performance test
[ ] Realtime test
[ ] UX test
[ ] Documentation
[ ] Gradual deploy
```

### 10.4 Technical Priorities

```
MUST HAVE (Weeks 1-4)
✓ WorkspaceContext working
✓ Basic Artist Workspace
✓ Activity logging
✓ Accepted performance

SHOULD HAVE (Weeks 5-7)
- Release Workspace
- Campaign Workspace
- Realtime sync
- Contextual sidebar

NICE TO HAVE (Week 8+)
- Command Center
- Advanced analytics
- Light automations
- Custom workspaces
```

---

## 11. EXPECTED FINAL RESULT

### What the Experience Will Be Like

```
User opens the application
↓
Navigates to Artists (Library)
↓
Clicks on "MC Lander"
↓
Opens the Artist Workspace

[360° view of the artist's career]
├── Overview with KPIs
├── Active releases (3)
├── Campaigns in progress (1)
├── Financials of the period
├── Pending tasks (5)
├── Activity timeline (last 2h)
├── Team and collaborators
└── Quick actions

User clicks on a release
↓
Opens the Release Workspace

[360° view of that release]
├── Distribution status
├── Pending assets
├── Linked campaigns
├── Release tasks
├── Real-time analytics
├── Operations timeline
└── Team involved

Feeling: "Everything connected. Everything here. Smooth operation."
```

---

## 12. NEXT STEPS

1. **Architecture Validation**: Review with the team
2. **Structure Setup**: Create base folders and files
3. **Phase 1 Implementation**: Technical foundation
4. **Artist Workspace Prototyping**: Validate the UX
5. **Gradual Rollout**: Test, feedback, optimization

---

**This is the blueprint for transforming Music OS 360 from a set of fragmented modules into a modern, contextual, fluid and thoroughly organized music operating system.**
