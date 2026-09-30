# 📐 MUSIC OS 360 — ARCHITECTURE DECISION RECORDS (ADRs)

**Documentation of the main architectural decisions, context, and trade-offs**

---

## ADR-001: Contextual Workspaces as the Main Pattern

### Status
✅ Accepted (2026-05-20)

### Context
Music OS 360 had 22 fragmented modules, linear menu navigation, loss of context between operations, and a broken UX.

### Decision
Implement Contextual Workspaces as the main organization pattern.

**Workspace** = Contextual operational center of an entity (Artist, Release, Campaign, etc)

### Rationale
- ✅ Reduces the navigation needed (fewer clicks)
- ✅ Keeps the operational context
- ✅ Groups related operations
- ✅ Scalable to new entities
- ✅ Significantly improves the UX

### Alternatives Considered
1. **Giant centralized dashboard**: ❌ Cluttered, no context
2. **Expandable modular menu**: ❌ Still fragmented
3. **SPA with global states**: ❌ Complex, hard to maintain

### Trade-offs
- ❌ Requires new infrastructure (Context, activity system)
- ❌ More reusable components
- ❌ Larger bundle size (mitigated by lazy loading)
- ✅ The experience is drastically better

### Implementation
Routes: `/workspace/:type/:id`  
Context: `WorkspaceContext`  
Tabs: Integrated horizontal navigation

---

## ADR-002: Centralized Activity Logging

### Status
✅ Accepted (2026-05-20)

### Context
Without tracking of operations, users do not know the history of changes, auditing is hard, and there is no event timeline.

### Decision
Implement a centralized Activity Logging System.

**Each action generates an `ActivityLog`:**
- Creation, update, deletion
- Approval, rejection, publication
- Any significant operation

### Rationale
- ✅ Automatic auditing
- ✅ Operational timeline
- ✅ Change tracking
- ✅ Real-time notifications
- ✅ Compliance and regulation

### Schema
```
activity_logs (
  id UUID,
  entity_type VARCHAR,           # 'artist', 'release', etc
  entity_id UUID,
  action VARCHAR,                # 'created', 'updated', etc
  description TEXT,
  metadata JSONB,
  user_id UUID,
  user_name VARCHAR,
  user_avatar_url VARCHAR,
  created_at TIMESTAMP
)
```

### Integration Points
- Middleware NestJS: `ActivityLogMiddleware`
- Service: `ActivityLogService.create()`
- Frontend: `useActivityLog()` hook
- Display: `ActivityTimeline` component

### Trade-offs
- ❌ Additional storage (mitigated by archiving)
- ❌ Queries may become slow (indexes)
- ✅ Operational visibility

---

## ADR-003: Coexistence of Old and New Routes

### Status
✅ Accepted (2026-05-20)

### Context
22 modules already exist in production with users who depend on them.

### Decision
**Zero-Breaking-Changes Strategy:**
- Old routes keep working
- New routes (`/workspace/*`) coexist
- Links can point to either
- Gradual, non-disruptive migration

### Implementation
```
// Both work simultaneously
/artistas                         # Old module (keeps working)
/workspace/artist/:id            # New workspace

/lancamentos                      # Old module
/workspace/release/:id           # New workspace
```

### Transition Links
```
// In the old module
<Button onClick={() => navigate(`/workspace/artist/${artistId}`)}>
  Open in new Workspace
</Button>
```

### Deprecation Timeline
```
Week 1-8:   Both routes work (parallel)
Week 9-12:  Deprecation warnings (soft)
Week 13+:   Removal of old routes
```

### Rationale
- ✅ Zero risk of breaking production
- ✅ Users can migrate at their own pace
- ✅ Real production feedback before removing
- ✅ Operational safety

### Trade-offs
- ❌ Temporarily duplicated code
- ❌ Maintenance of both
- ✅ Safety is the priority

---

## ADR-004: React Context + TanStack Query for State Management

### Status
✅ Accepted (2026-05-20)

### Context
Need for state management for workspaces without over-engineering.

### Decision
- **React Context**: UI state (currentTab, selectedItems, sidebarOpen)
- **TanStack Query**: Server state (entity, activities, financials)
- **Do not use Redux, Zustand**: Over-engineering

### Architecture
```
┌─────────────────────────────┐
│ Server State (React Query)  │
│ - Artist, Release data      │
│ - Activities                │
│ - Financial info            │
└────────────┬────────────────┘
             │ useQuery()
┌────────────▼────────────────┐
│ WorkspaceContext (UI State) │
│ - currentTab                │
│ - selectedItems             │
│ - sidebarOpen               │
└─────────────────────────────┘
```

### Rationale
- ✅ React Query: automatic queries, caching, retry
- ✅ Context: simple, no extra dependencies
- ✅ Clear separation: server vs UI state
- ✅ Less boilerplate

### Hooks Pattern
```typescript
const workspaceContext = useWorkspace(type, id);      // Server + UI state
const { activities } = useActivityLog(type, id);      // Server state
const { currentTab, setCurrentTab } = useWorkspaceContext(); // UI state
```

### Trade-offs
- ❌ No time-travel debugging (Redux)
- ❌ No Redux DevTools
- ✅ Much simpler
- ✅ Sufficient performance

---

## ADR-005: Activity Timeline as a First-Class Feature

### Status
✅ Accepted (2026-05-20)

### Context
Users cannot see what happened with an operation, the history is invisible, collaboration is hard.

### Decision
**The Activity Timeline is shown in every workspace:**
- The right sidebar always shows the latest activities
- Compact but informative timeline
- Clickable for more details
- Realtime when possible

### Components
```
ActivityTimeline          # Displays the list of activities
ActivityCard             # A single activity item
ActivityFeed             # Real-time feed
```

### Display Pattern
```
┌──────────────────────────────┐
│ ACTIVITY (Right Sidebar)     │
├──────────────────────────────┤
│ ● Release distribuído        │ ← Dot indicates the action
│   há 2h por João             │ ← Timestamp, author
│                              │
│ ● Assets aprovados           │
│   há 4h por Maria            │
│                              │
│ ● Campanha iniciada          │
│   há 1d                      │
(PT-BR UI copy: "Release distributed", "2h ago by João", "Assets approved", "Campaign started", "1d ago")
└──────────────────────────────┘
```

### Rationale
- ✅ Operational visibility
- ✅ Better collaboration
- ✅ Automatic tracking
- ✅ Built-in auditing

### Trade-offs
- ❌ Requires the activity logging system
- ✅ Operational transparency

---

## ADR-006: Realtime Subscriptions with Supabase (Optional)

### Status
⏳ Optional in Phase 1 (Implement in Phase 2)

### Context
Multiple users editing the same workspace need to see changes in real time.

### Decision
Use Supabase Realtime to:
- Update activities in real time
- Notify status changes
- Synchronize data between users

### Schema
```
Channel: workspace:{type}:{id}
Events:
  - activity_created
  - entity_updated
  - user_joined / user_left
```

### Implementation
```typescript
// Subscribe
supabase
  .channel(`workspace:artist:${artistId}`)
  .on('postgres_changes', ...)
  .subscribe();

// Broadcast
supabase.channel(`workspace:artist:${artistId}`)
  .send('broadcast', { event: 'activity_created', payload });
```

### Trade-offs
- ❌ External dependency (Supabase)
- ❌ Additional cost
- ✅ Real-time sync
- ✅ Better collaborative UX

### Alternative: WebSockets
- More control
- More complex to manage
- Supabase is easier

---

## ADR-007: 5 Main Workspaces (Not Infinite)

### Status
✅ Accepted (2026-05-20)

### Context
Exactly how many workspaces should we create? Risk of proliferation.

### Decision
Start with 5 main workspaces:
1. **Artist**: The artist's career
2. **Release**: Music release
3. **Campaign**: Marketing campaign
4. **Project**: Generic project (tasks)
5. **Contract**: Contract management

And 3 secondary ones:
- **Work**: Work/Composition (`Obra`)
- **Event**: Event
- **Client**: Client (CRM)

### Rationale
- ✅ Covers 80% of the use cases
- ✅ Not infinite (keeps focus)
- ✅ Extensible to new types
- ✅ Each one has a clear purpose

### How to Add New Workspace
```
1. Create the WorkspaceContext
2. Create hooks
3. Create the layout
4. Create pages/tabs
5. Add to routes
6. Link from the related module
```

### Trade-offs
- ❌ Not everything can be a workspace
- ✅ Focus and consistency

---

## ADR-008: Horizontal Tabs for Navigation inside a Workspace

### Status
✅ Accepted (2026-05-20)

### Context
How to organize multiple sections inside a workspace?

### Decision
Use **Horizontal Tabs** (not a sidebar):
- Overview | Releases | Campaigns | Financial | ...
- Always visible
- Fast switching
- Mobile: horizontal scroll

### Pattern
```
┌─────────────────────────────────┐
│ [Overview] [Releases] [Tasks] ▶ │  ← Tabs with scroll
└─────────────────────────────────┘

Click → Changes the content below
```

### Rationale
- ✅ Less visual sidebar
- ✅ More content space
- ✅ Tabs are easy to discover
- ✅ Mobile friendly

### Alternative: Sidebar inside the workspace
- Less content space
- More confusing alongside the global sidebar

### Trade-offs
- ❌ Fewer tabs visible at a time (solution: scroll)
- ✅ Clean interface

---

## ADR-009: Reusable Components in shared-workspace-components

### Status
✅ Accepted (2026-05-20)

### Context
Each workspace needs to display: cards, metrics, timelines, standard tables.

### Decision
Create a `/shared-workspace-components` folder with reusable components:
- `WorkspaceCard`
- `WorkspaceMetrics`
- `ActivityTimeline`
- `WorkspaceTeamCard`
- `WorkspaceContextualSidebar`
- Etc...

### Rationale
- ✅ DRY: Do not repeat code
- ✅ Consistency: Same pattern
- ✅ Maintenance: Fix a bug once
- ✅ Scalability: New workspace is quick

### Governance
```
Before creating a new component:
✓ Check whether a similar one exists
✓ If it exists, reuse it
✓ If not, create a generic and reusable one
```

### Trade-offs
- ❌ More components at the start
- ✅ Less repeated code later

---

## ADR-010: URL Format: /workspace/{type}/{id}/tabs?

### Status
✅ Accepted (2026-05-20)

### Context
How to structure workspace URLs?

### Decision
```
/workspace/artist/:artistId
/workspace/artist/:artistId/overview
/workspace/artist/:artistId/releases
/workspace/release/:releaseId
/workspace/release/:releaseId/overview
/workspace/release/:releaseId/distribution
```

**Default**: `/overview` if not specified

### Query Params (Optional)
```
?filter=status:active
?sort=date:desc
?view=kanban
```

### Rationale
- ✅ RESTful
- ✅ Easy deeplink
- ✅ Bookmarkable
- ✅ State in the URL

### Implementation
```typescript
// useWorkspaceContext() reads currentTab from the URL
// navigate(`/workspace/${type}/${id}/${tab}`) changes the URL
```

### Trade-offs
- ❌ Slightly long URL
- ✅ All states are shareable

---

## ADR-011: Performance: Lazy Loading and Code Splitting

### Status
✅ Accepted (2026-05-20)

### Context
Many workspaces, many components = large bundle.

### Decision
- Workspace components: `lazy()`
- Tabs: load on demand
- Activity timeline: virtual scrolling if > 100 items
- Analytics charts: dynamic recharts

### Implementation
```typescript
// Lazy load workspace pages
const ArtistOverview = lazy(() => import('./pages/ArtistOverview'));
const ArtistReleases = lazy(() => import('./pages/ArtistReleases'));

// In route
<Suspense fallback={<Skeleton />}>
  <ArtistOverview />
</Suspense>
```

### Metrics
- Main bundle: < 500KB
- Workspace bundle: ~100KB (lazy)
- First paint: < 2s
- TTI: < 3.5s

### Trade-offs
- ❌ More initial setup
- ✅ Faster in production

---

## ADR-012: Do Not Build a Massive Workflow Engine

### Status
✅ Accepted (2026-05-20)

### Context
Temptation: build a complex automatic workflow engine.

### Decision
**DO NOT:**
- Complex workflow engine
- BPM (Business Process Management)
- Rules engine
- Magic automations

**DO:**
- Simple and obvious automations
- Clear manual actions
- Explicit status transitions
- Activity logging of everything

### Simple Automations
```
Release approved
  → Create marketing tasks
  → Notify the team

Campaign finished
  → Generate report
  → Update analytics
```

### Rationale
- ✅ Simple to understand
- ✅ Easy to maintain
- ✅ Not a "black box"
- ❌ Less automation than it could have

### Trade-offs
- ❌ Less automation
- ✅ Much simpler
- ✅ Users understand what happens

---

## ADR-013: No Hidden "Superpowers"

### Status
✅ Accepted (2026-05-20)

### Context
Sometimes we want to create "hidden" features for power users.

### Decision
**All features must be obvious:**
- If a button exists, it is visible
- If an action exists, it is in the menu
- No hidden shortcuts
- No operational "Easter eggs"

### Rationale
- ✅ Clear interface
- ✅ No confusion
- ✅ Accessible to everyone
- ✅ Simple documentation

### Exception
- Keyboard shortcuts (⌘K, etc) may be discovered

---

## ADR-014: Single Activity Log Table (Not One per Entity)

### Status
✅ Accepted (2026-05-20)

### Context
Should we have a single `activity_logs` table or one per entity type?

### Decision
**A single `activity_logs` table** with the fields:
- `entity_type` (VARCHAR)
- `entity_id` (UUID)

Do not create separate tables:
- `artist_activities`
- `release_activities`
- `campaign_activities`

### Rationale
- ✅ Easier queries
- ✅ Global search possible
- ✅ Fewer tables
- ✅ Simple indexes

### Indexes
```sql
INDEX (entity_type, entity_id, created_at DESC)
INDEX (user_id)
```

### Trade-offs
- ❌ Potentially large table
- ✅ Simpler

---

## ADR-015: User Avatar in Activity (Not Only the Name)

### Status
✅ Accepted (2026-05-20)

### Context
The activity log shows who performed the action. Only the name or include the avatar?

### Decision
Include `user_avatar_url` in each activity log.

**Schema:**
```
user_id UUID
user_name VARCHAR
user_avatar_url VARCHAR  ← Add this
```

### Rationale
- ✅ More visual timeline
- ✅ Quick identification
- ✅ Better UX
- ✅ Little overhead

### Display
```
┌─────────────┐
│ ● [👤] Release distribuído (PT-BR UI copy: "Release distributed")
│    João Silva
│    2h ago
└─────────────┘
```

### Trade-offs
- ❌ More stored data
- ✅ Better interface

---

## ADR-016: Do Not Over-Optimize Early

### Status
✅ Accepted (2026-05-20)

### Context
Temptation: optimize everything from day 1.

### Decision
**Implement simple first:**
- Then: measure performance
- Then: optimize what is really a problem

### Performance Roadmap
- Weeks 1-8: Functional, not optimized
- Week 9: Measure with Lighthouse
- If score < 80: optimize
- If score > 80: it is fine

### Trade-offs
- ❌ Faster development
- ✅ Better than premature optimization

---

## ADR-017: TypeScript Strict Mode Is Mandatory

### Status
✅ Accepted (2026-05-20)

### Context
Should the TypeScript config be strict?

### Decision
**Yes, strict mode everywhere:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true
  }
}
```

### Rationale
- ✅ Fewer bugs
- ✅ Better autocompletion
- ✅ Safe refactoring
- ✅ Inline documentation

### Trade-offs
- ❌ More verbose
- ✅ Safer

---

## Upcoming ADRs (In development)

- ADR-018: Testing Strategy (E2E, Integration, Unit)
- ADR-019: Error Handling Pattern
- ADR-020: Notification System
- ADR-021: Mobile App Strategy

---

**This document is a living record. It will be updated as new decisions are made.**

**Last updated**: 2026-05-20
