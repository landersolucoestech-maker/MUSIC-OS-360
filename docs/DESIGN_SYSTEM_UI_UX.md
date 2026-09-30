# 🎨 MUSIC OS 360 — DESIGN SYSTEM & UI/UX STANDARDS

**Visual Standards, Components and User Experience for Workspaces**

---

## 🎯 DESIGN PRINCIPLES

### 1. Contextual Simplicity
- Show only what is relevant to the current context
- No information overload
- Clear visual hierarchy

### 2. Global Consistency
- Same pattern in all workspaces
- Reusable components
- Single design tokens

### 3. Depth Without Complexity
- Progressive actions (basic → advanced)
- Minimize navigation
- Maximize contextualization

### 4. Operational Fluidity
- Smooth transitions
- Immediate feedback
- State always clear

---

## 🎨 COLOR PALETTE AND TOKENS

### Design Tokens

```css
/* Status Colors */
--status-success: #10b981;      /* Approved, Published, Active */
--status-warning: #f59e0b;      /* Pending, Attention */
--status-error: #ef4444;        /* Error, Cancelled */
--status-info: #3b82f6;         /* Information, Processing */
--status-muted: #6b7280;        /* Archived, Inactive */

/* Action Colors */
--action-primary: #7c3aed;      /* Primary actions */
--action-secondary: #64748b;    /* Secondary actions */
--action-success: #10b981;      /* Confirm, Save */
--action-danger: #ef4444;       /* Delete, Cancel */

/* Entity Type Colors */
--entity-artist: #8b5cf6;       /* Purple */
--entity-release: #3b82f6;      /* Blue */
--entity-campaign: #ec4899;     /* Pink */
--entity-project: #14b8a6;      /* Teal */
--entity-contract: #f59e0b;     /* Amber */
--entity-work: #6366f1;         /* Indigo */
--entity-event: #06b6d4;        /* Cyan */
```

### Semantic Colors

```css
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;
--muted: #6b7280;
```

---

## 📐 TYPOGRAPHY

### Hierarchy

```
Hero Title        (4xl, bold, 42px)
Page Title        (3xl, semibold, 30px)
Section Title     (2xl, semibold, 24px)
Card Title        (lg, semibold, 18px)
Body              (base, regular, 16px)
Small Text        (sm, regular, 14px)
Caption           (xs, regular, 12px)
Mono (Code)       (mono, sm, 14px)
```

### Font Stack

```
Body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", sans-serif
Mono: "Fira Code", "Monaco", "Courier New", monospace
```

---

## 📦 STANDARDIZED COMPONENTS

### 1. Standard Card (Workspace Card)

```
┌─────────────────────────────────┐
│ [Icon] Title       [Status Badge]│
│        Subtitle                  │
├─────────────────────────────────┤
│ Content Area                    │
│                                 │
├─────────────────────────────────┤
│ [Footer]       [Action Button] │
└─────────────────────────────────┘

Specs:
- Radius: 12px
- Border: 1px solid border/40
- Shadow: sm (0 1px 2px)
- Padding: 16px (header), 16px (content)
- Gap between sections: 12px
```

### 2. Standard Badge

```
Status Badges (PT-BR UI labels: Publicado = Published, Pendente = Pending, Cancelado = Cancelled):
┌──────────────┐
│ ✓ Publicado  │  → Green, filled
└──────────────┘

┌──────────────┐
│ ⏱ Pendente   │  → Amber, filled
└──────────────┘

┌──────────────┐
│ ✗ Cancelado  │  → Red, outline
└──────────────┘

Action Badges:
[New] [In Progress] [Review] [Done]
```

### 3. Standardized Button

```
PRIMARY (Main action)
┌─────────────────┐
│ + Create Release│  → Background: primary, Text: white
└─────────────────┘

SECONDARY (Secondary action)
┌──────────────┐
│ Edit Details │  → Background: secondary, Text: foreground
└──────────────┘

GHOST (Link-like)
┌─────────────┐
│ View Details│  → No background, Text: primary
└─────────────┘

DESTRUCTIVE (Destructive actions)
┌───────────────┐
│ Delete Item   │  → Background: red, Text: white
└───────────────┘

Icon Buttons:
[⋯] [↗] [✎] [✗]  → 32x32px, Ghost variant
```

### 4. Standard Input

```
Textbox:
┌─────────────────────────┐
│ Label                   │
├─────────────────────────┤
│ [Input field            │
│ with placeholder]       │
│                         │
│ Helper text (optional)  │
└─────────────────────────┘

Select:
┌──────────────────────┐
│ Label                │
├──────────────────────┤
│ [Selected Value ▼]   │
└──────────────────────┘

Checkbox:
☑ Label for checkbox

Radio:
◉ Option 1
○ Option 2
○ Option 3

Toggle Switch:
┌─ Toggle Label
│ [●─────] ON
```

### 5. Tab Navigation

```
┌─────────────────────────────────────────┐
│ Overview │ Releases │ Tasks │ Financial │
└─────────────────────────────────────────┘
    ▲
 Active tab has border-b colored
 
Normal tab: border-b transparent, text muted
Hover tab:  border-b transparent, text foreground
Active tab: border-b primary, text foreground
```

### 6. Dropdown Menu

```
[Button ▼]
    │
    ├─ [🔍] View Details
    ├─ [✎] Edit
    ├─ ─────────────  (separator)
    └─ [✗] Delete
```

### 7. Modals and Drawers

```
Modal (Center):
┌──────────────────────────────────┐
│ Modal Title         [✕]          │
├──────────────────────────────────┤
│ Modal Content                    │
│                                  │
│                                  │
├──────────────────────────────────┤
│ [Cancel]         [Confirm Action]│
└──────────────────────────────────┘

Drawer (Right-side):
┌────────────────┐
│ Title    [✕]   │
├────────────────┤
│ Content        │
│                │
│                │
├────────────────┤
│ [Actions]      │
└────────────────┘

Width: 480px (tablet), 360px (mobile)
```

### 8. Standard Table

```
┌──┬────────┬──────────┬──────────┬──────────┬────────┐
│☐ │ Item   │ Status   │ Date     │ Owner    │ Action │
├──┼────────┼──────────┼──────────┼──────────┼────────┤
│☐ │ Item 1 │ ✓ Done   │ 2026-01-15 │ @user1 │ [⋯]  │
├──┼────────┼──────────┼──────────┼──────────┼────────┤
│☐ │ Item 2 │ ⏱ Pending│ 2026-01-16 │ @user2 │ [⋯]  │
└──┴────────┴──────────┴──────────┴──────────┴────────┘

- Alternating row colors (zebra striping)
- Hover row: bg slightly darker
- Checkbox for bulk actions
- Status with a visual badge
```

### 9. Activity Timeline

```
┌────────────────────────────────────┐
│ ● Released to all platforms        │
│   2 hours ago by João Silva        │
│                                    │
│ ● Assets approved                  │
│   4 hours ago by Maria Santos      │
│                                    │
│ ● Campaign started                 │
│   1 day ago                        │
└────────────────────────────────────┘

Dot color = action type
- Green: Success/approval
- Blue: Update
- Orange: Warning/pending
- Red: Error/rejection
```

### 10. Empty State

```
        ╔════╗
        ║ 📁 ║
        ╚════╝
        
   No items yet
   
"Create your first release to get started"

     [+ Create Release]
```

---

## 🎯 WORKSPACE LAYOUTS

### Layout Type 1: Overview (Artist/Release)

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar │ Header: Artist Name | Status | Quick Actions        │
│         ├─────────────────────────────────────────────────────┤
│         │ Tabs: Overview | Releases | Campaigns | Financial... │
│         ├─────────────────────────────────────────────────────┤
│         │                                                      │
│         │ ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│         │ │ Metric 1     │  │ Metric 2     │  │ Metric 3   │ │
│         │ │ 123,456      │  │ 89,012       │  │ 345        │ │
│         │ └──────────────┘  └──────────────┘  └────────────┘ │
│         │                                                      │
│         │ ┌────────────────────────────────────────────────┐  │
│         │ │ Recent Activity                                │  │
│         │ │ ✓ Released to all platforms  2h ago          │  │
│         │ │ ✓ Assets approved             4h ago          │  │
│         │ └────────────────────────────────────────────────┘  │
│         │                                                      │
│         │ ┌──────────────────┐  ┌──────────────────┐          │
│         │ │ Releases (3)     │  │ Campaigns (1)    │          │
│         │ │ • Item 1         │  │ • Campaign Name  │          │
│         │ │ • Item 2         │  │   Budget: R$1k   │          │
│         │ │ • Item 3         │  │                  │          │
│         │ └──────────────────┘  └──────────────────┘          │
│         │                                                      │
├─────────┼─────────────────────────────────────────────────────┤
│Timeline │ [Compact activity]                                   │
│Activity │                                                      │
└─────────┴─────────────────────────────────────────────────────┘
```

### Layout Type 2: Data-Heavy (Marketing/Analytics)

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar │ Header | Tabs | Filters | Export              │
├──────────────────────────────────────────────────────────┤
│         │                                                │
│         │ ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│         │ │ Stat 1     │  │ Stat 2     │  │ Stat 3   │ │
│         │ └────────────┘  └────────────┘  └──────────┘ │
│         │                                                │
│         │ ┌─────────────────────────────────────────┐  │
│         │ │ [📊 Chart/Graph Area]                   │  │
│         │ │                                         │  │
│         │ │                                         │  │
│         │ └─────────────────────────────────────────┘  │
│         │                                                │
│         │ ┌─────────────────────────────────────────┐  │
│         │ │ Data Table                              │  │
│         │ │ ┌───┬──────┬──────┬──────┬──────┬────┐ │  │
│         │ │ │☑ │ Item │ Val1 │ Val2 │ Val3 │[⋯]│ │  │
│         │ │ ├───┼──────┼──────┼──────┼──────┼────┤ │  │
│         │ │ │☐ │ Item │ Val1 │ Val2 │ Val3 │[⋯]│ │  │
│         │ │ └───┴──────┴──────┴──────┴──────┴────┘ │  │
│         │ └─────────────────────────────────────────┘  │
│         │                                                │
├─────────┼──────────────────────────────────────────────┤
│Sidebar  │ Quick Stats / Pending                        │
│Activity │                                                │
└─────────┴──────────────────────────────────────────────┘
```

### Layout Type 3: Task Management (Kanban/List)

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar │ Header | Tabs | View Toggle (List/Board)     │
├──────────────────────────────────────────────────────────┤
│         │                                                │
│         │ [Backlog]  [To Do]  [In Progress]  [Done]     │
│         │   (3)       (5)       (2)           (8)       │
│         │   ┌─────┐  ┌─────┐  ┌──────┐     ┌──────┐   │
│         │   │Task1│  │Task2│  │Task 3│     │Task 8│   │
│         │   │ P1  │  │ P0  │  │ P0   │     │ P2   │   │
│         │   └─────┘  └─────┘  └──────┘     └──────┘   │
│         │   ┌─────┐  ┌─────┐  ┌──────┐     ┌──────┐   │
│         │   │Task2│  │Task3│  │Task 4│     │Task 9│   │
│         │   └─────┘  └─────┘  └──────┘     └──────┘   │
│         │            ┌─────┐  ┌──────┐                 │
│         │            │Task4│  │Task 5│                 │
│         │            └─────┘  └──────┘                 │
│         │                                                │
│         │ [+ Add Task]                                  │
│         │                                                │
├─────────┼──────────────────────────────────────────────┤
│Sidebar  │ Filters | Sort | Assignees                  │
└─────────┴──────────────────────────────────────────────┘
```

---

## 🔄 STATES AND TRANSITIONS

### Loading State

```
Skeleton placeholders:
┌──────────────────────┐
│ [█████░░░░]          │  ← Shimmer effect
└──────────────────────┘

Main components show skeletons
- Cards show 3 cards skeleton
- Table shows 5 rows skeleton
- Timeline shows 3 items skeleton
```

### Error State

```
┌───────────────────────────────────────┐
│ ⚠ Something went wrong                │
│ "Connection lost. Retrying..."        │
│ [Retry]  [Go Back]                    │
└───────────────────────────────────────┘
```

### Empty State

```
┌───────────────────────────────────────┐
│         📁 or relevant icon           │
│ No items to display                   │
│ "Create your first [item]"            │
│ [+ Create]                            │
└───────────────────────────────────────┘
```

### Success State

```
┌───────────────────────────────────────┐
│ ✓ Operation completed successfully    │
│ "Item created"                        │
│ Auto-dismiss after 4 seconds          │
└───────────────────────────────────────┘
```

---

## 🎬 ANIMATIONS & TRANSITIONS

### Standard Durations

```
Fast:       150ms  (hover states, quick feedback)
Normal:     200ms  (standard transitions)
Slow:       300ms  (modal opens, page transitions)
```

### Easing

```
UI Elements:    ease-in-out
Loading:        ease-out
Modals:         cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Examples

```
Hover State:
- opacity: 0.8 → 1
- transform: none → translateY(-2px)
- duration: 150ms

Modal Open:
- opacity: 0 → 1
- transform: scale(0.95) → scale(1)
- duration: 200ms

Loading Spinner:
- rotate: 0deg → 360deg
- duration: 1s
- loop infinite
```

---

## 📱 RESPONSIVE BREAKPOINTS

```
Mobile:       < 640px     (sm)
Tablet:       640px-1024px (md/lg)
Desktop:      > 1024px    (xl/2xl)

Grid Changes:
- sm: 1 col
- md: 2 cols
- lg: 3-4 cols
- xl: 4-6 cols

Sidebar:
- sm: Collapsible, overlay
- md+: Fixed, always visible

Contextual Sidebar:
- sm: Hidden
- md: Drawer/overlay
- lg+: Fixed, 320px width
```

---

## ♿ ACCESSIBILITY

### Keyboard Navigation

```
Tab:        Navigate between elements
Shift+Tab:  Navigate backwards
Enter:      Activate button/link
Space:      Toggle checkbox
Escape:     Close modal/dropdown
Arrow keys: Navigate in dropdowns/tabs
```

### ARIA Labels

```
[aria-label="Close modal"]
[aria-pressed="true"]
[aria-expanded="false"]
[role="navigation"]
[role="main"]
[role="status"]
```

### Color Contrast

```
Minimum WCAG AA: 4.5:1 (normal text)
Minimum WCAG AA: 3:1 (large text, UI elements)
Avoid: communicating with color only
Add: icons, text, patterns
```

---

## 🎨 WORKSPACE-SPECIFIC STYLING

### Artist Workspace
- Primary color: Purple (#8b5cf6)
- Icon: 🎤
- Theme: Career and performance

### Release Workspace
- Primary color: Blue (#3b82f6)
- Icon: 🎵
- Theme: Distribution and operations

### Campaign Workspace
- Primary color: Pink (#ec4899)
- Icon: 📢
- Theme: Marketing and analytics

### Project Workspace
- Primary color: Teal (#14b8a6)
- Icon: 📋
- Theme: Tasks and management

### Contract Workspace
- Primary color: Amber (#f59e0b)
- Icon: 📄
- Theme: Legal and obligations

---

## 📚 REUSABLE COMPONENTS

**All implemented in:**  
`apps/web/src/modules/shared-workspace-components/`

```
✓ WorkspaceCard
✓ WorkspaceMetrics
✓ WorkspaceActivityTimeline
✓ WorkspaceTeamCard
✓ WorkspaceContextualSidebar
✓ WorkspaceTaskList
✓ WorkspaceBudgetCard
✓ WorkspaceTimelineSection
✓ WorkspaceEmptyState
✓ WorkspaceErrorState
✓ WorkspaceLoadingSkeleton
✓ WorkspaceQuickActions
```

---

## 🔍 EXAMPLE: Artist Workspace - Overview

```
┌─────────────────────────────────────────────────────────┐
│ 🎤 MC Lander | [Online]  [+ Add Release] [⋯]            │
├─────────────────────────────────────────────────────────┤
│ Overview | Releases | Campaigns | Financial | ... │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  KPIs:                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ 🎵 Streams   │ │ 💰 Revenue   │ │ 📈 Growth      │ │
│  │ 2.3M         │ │ R$ 45.230    │ │ +23% this month│ │
│  └──────────────┘ └──────────────┘ └────────────────┘ │
│                                                          │
│  Recent Releases (3):                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🎵 Noite Fria           │ 📊 2.3M streams        │ │
│  │ by MC Lander            │ ✓ Publicado há 2 meses│ │
│  ├────────────────────────────────────────────────────┤ │
│  │ 🎵 Sonho Dourado        │ 📊 1.8M streams        │ │
│  │ by MC Lander            │ ✓ Publicado há 4 meses│ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Active Campaigns (1):                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 📢 Summer Campaign 2026                            │ │
│  │ Budget: R$ 5.000 | Status: ⏱ Running             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Activity (Last 24h)                                      │
│ ✓ Release distributed   2h ago                          │
│ 👤 Team member added    6h ago                          │
│ 💰 Payment processed    1d ago                          │
└─────────────────────────────────────────────────────────┘
```

(PT-BR UI copy in the mock-up: `Publicado há 2 meses` / `há 4 meses` = "Published 2 / 4 months ago".)

---

**This design system guarantees:**
- ✓ Visual consistency
- ✓ Accessibility
- ✓ Responsiveness
- ✓ Performance
- ✓ Premium experience
