# ⚡ QUICK START GUIDE — Start Implementing Today

**Practical guide for setup, first steps, and troubleshooting**

---

## 🚀 INITIAL SETUP (30 minutes)

### 1. Create the Folder Structure

```bash
# Terminal at the workspace root
cd apps/web/src/modules

# Workspace module
mkdir -p workspace/{components,hooks,layouts,types,providers,contexts}

# Activity log
mkdir -p activity-log/{components,hooks,services,queries,types}

# Shared components
mkdir -p shared-workspace-components/{cards,metrics,timelines,tables,sidebars}

# Contexts
mkdir -p contexts/{artist-workspace,release-workspace}
```

### 2. Copy the Basic Template

**File: `workspace/types/workspace.types.ts`**

```typescript
export type WorkspaceType = 'artist' | 'release' | 'campaign' | 'project' | 'contract';
export type WorkspaceTab = string;

export interface WorkspaceEntity {
  id: string;
  type: WorkspaceType;
  name: string;
  description?: string;
}

export interface Activity {
  id: string;
  entityType: WorkspaceType;
  entityId: string;
  action: string;
  description: string;
  user: { id: string; name: string; avatar?: string };
  createdAt: Date;
}

export interface WorkspaceContextValue {
  workspaceType: WorkspaceType;
  workspaceId: string;
  entity: WorkspaceEntity | null;
  isLoadingEntity: boolean;
  errorEntity: Error | null;
  currentTab: WorkspaceTab;
  setCurrentTab: (tab: WorkspaceTab) => void;
  selectedItems: string[];
  setSelectedItems: (ids: string[]) => void;
  activities: Activity[];
  isLoadingActivities: boolean;
  isConnected: boolean;
}
```

### 3. Create the Context Provider

**File: `workspace/providers/WorkspaceContext.tsx`**

```typescript
import { createContext, useContext, ReactNode } from 'react';
import type { WorkspaceContextValue } from '../types/workspace.types';

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return context;
}

export function WorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WorkspaceContextValue;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

### 4. Create the Base Hook

**File: `workspace/hooks/useWorkspace.ts`**

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WorkspaceType, WorkspaceContextValue } from '../types/workspace.types';

export function useWorkspace(
  workspaceType: WorkspaceType,
  workspaceId: string
): Omit<WorkspaceContextValue, 'setCurrentTab' | 'setSelectedItems'> & {
  setCurrentTab: (tab: string) => void;
  setSelectedItems: (ids: string[]) => void;
} {
  const [currentTab, setCurrentTab] = useState('overview');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: entity, isPending: isLoadingEntity, error: errorEntity } = useQuery({
    queryKey: [workspaceType, workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/${workspaceType}s/${workspaceId}`);
      if (!response.ok) throw new Error('Failed to load');
      return response.json();
    },
  });

  const { data: activities = [], isPending: isLoadingActivities } = useQuery({
    queryKey: ['activities', workspaceType, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/activities?entityType=${workspaceType}&entityId=${workspaceId}`
      );
      if (!response.ok) throw new Error('Failed to load activities');
      return response.json();
    },
    refetchInterval: 30000,
  });

  return {
    workspaceType,
    workspaceId,
    entity: entity || null,
    isLoadingEntity,
    errorEntity: errorEntity as Error | null,
    currentTab,
    setCurrentTab: (tab: string) => setCurrentTab(tab),
    selectedItems,
    setSelectedItems,
    activities,
    isLoadingActivities,
    isConnected: true,
  };
}
```

---

## 🎨 CREATE THE FIRST COMPONENT

**File: `shared-workspace-components/cards/WorkspaceCard.tsx`**

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { ReactNode } from 'react';

interface WorkspaceCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  status?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function WorkspaceCard({
  icon: Icon,
  title,
  description,
  status,
  children,
  action,
}: WorkspaceCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {status && <Badge variant="secondary">{status}</Badge>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {action && <div className="px-6 pb-4">{action}</div>}
    </Card>
  );
}
```

---

## 📊 LOCAL TEST (Without Backend)

Test without the backend endpoints being available yet:

```typescript
// workspace/hooks/useWorkspace.ts (mock version)

export function useWorkspace(workspaceType: WorkspaceType, workspaceId: string) {
  // ... existing code ...

  // Mock data for testing
  const mockEntity = {
    id: workspaceId,
    type: workspaceType,
    name: `${workspaceType} ${workspaceId}`,
    description: 'Test entity',
  };

  const mockActivities = [
    {
      id: '1',
      entityType: workspaceType,
      entityId: workspaceId,
      action: 'created',
      description: 'Entity was created',
      user: { id: 'user1', name: 'João' },
      createdAt: new Date(),
    },
  ];

  return {
    workspaceType,
    workspaceId,
    entity: mockEntity,
    isLoadingEntity: false,
    errorEntity: null,
    currentTab: 'overview',
    setCurrentTab: () => {},
    selectedItems: [],
    setSelectedItems: () => {},
    activities: mockActivities,
    isLoadingActivities: false,
    isConnected: true,
  };
}
```

---

## 🔧 BACKEND SETUP (30 minutes)

### 1. Create the TypeORM Entity

**File: `apps/api/src/modules/activity-log/entities/activity-log.entity.ts`**

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('activity_logs')
@Index(['entity_type', 'entity_id', 'created_at'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entity_type: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_avatar_url: string;

  @CreateDateColumn()
  created_at: Date;
}
```

### 2. Create the Migration

```bash
pnpm --filter @music-os-360/api db:generate -- CreateActivityLogs
```

`db:generate` does not write the file itself: it prints the TypeORM command to run manually for the given migration name.

Check the file generated in `apps/api/src/database/migrations/` (see `docs/engineering/database.md`)

### 3. Create the Service

**File: `apps/api/src/modules/activity-log/activity-log.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityRepository: Repository<ActivityLog>
  ) {}

  async create(data: {
    entity_type: string;
    entity_id: string;
    action: string;
    description: string;
    user_id: string;
    user_name?: string;
    user_avatar_url?: string;
    metadata?: Record<string, any>;
  }) {
    const activity = this.activityRepository.create(data);
    return this.activityRepository.save(activity);
  }

  async getByEntity(entityType: string, entityId: string, limit = 50) {
    return this.activityRepository.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
```

### 4. Create the Controller

**File: `apps/api/src/modules/activity-log/activity-log.controller.ts`**

```typescript
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

@Controller('api/activities')
export class ActivityLogController {
  constructor(private activityService: ActivityLogService) {}

  @Post()
  async create(@Body() data: any) {
    return this.activityService.create(data);
  }

  @Get()
  async getByEntity(@Query('entityType') type: string, @Query('entityId') id: string) {
    return this.activityService.getByEntity(type, id);
  }
}
```

### 5. Register in the Module

```typescript
// app.module.ts or activity-log.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService],
  controllers: [ActivityLogController],
})
export class ActivityLogModule {}
```

### 6. Run Migration

```bash
pnpm --filter @music-os-360/api db:migrate
```

---

## 🧪 TEST ENDPOINTS

```bash
# POST /api/activities (create)
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "artist",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
    "action": "created",
    "description": "Artist was created",
    "user_id": "user-id",
    "user_name": "João"
  }'

# GET /api/activities (list)
curl http://localhost:3000/api/activities?entityType=artist&entityId=123e4567-e89b-12d3-a456-426614174000
```

---

## 🎯 FIRST PAGE: Artist Overview

**File: `apps/web/src/modules/workspace/contexts/artist-workspace/pages/ArtistOverview.tsx`**

```typescript
import { useWorkspaceContext } from '@/modules/workspace/providers/WorkspaceContext';
import { WorkspaceCard } from '@/modules/shared-workspace-components/cards/WorkspaceCard';
import { ActivityTimeline } from '@/modules/activity-log/components/ActivityTimeline';
import { Music, TrendingUp, BarChart3 } from 'lucide-react';

export function ArtistOverview() {
  const { entity, activities, isLoadingActivities } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WorkspaceCard icon={Music} title="Releases" status="3" />
        <WorkspaceCard icon={TrendingUp} title="Streams" status="2.3M" />
        <WorkspaceCard icon={BarChart3} title="Revenue" status="R$ 45k" />
      </div>

      {/* Recent Releases */}
      <WorkspaceCard title="Recent Releases">
        <div className="space-y-2">
          <div className="p-3 bg-muted rounded">Release 1</div>
          <div className="p-3 bg-muted rounded">Release 2</div>
        </div>
      </WorkspaceCard>

      {/* Activity Timeline */}
      <WorkspaceCard title="Recent Activity">
        <ActivityTimeline activities={activities} isLoading={isLoadingActivities} />
      </WorkspaceCard>
    </div>
  );
}
```

---

## 🔗 REGISTER THE ROUTE

**File: `apps/web/src/app/routes/workspace.routes.tsx`** (new)

```typescript
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

const ArtistWorkspaceLayout = lazy(() =>
  import('@/modules/contexts/artist-workspace/layouts/ArtistWorkspaceLayout')
);
const ArtistOverview = lazy(() =>
  import('@/modules/contexts/artist-workspace/pages/ArtistOverview')
);

export const workspaceRoutes = [
  {
    path: '/workspace/artist/:artistId',
    element: <ArtistWorkspaceLayout />,
    children: [
      { path: 'overview', element: <ArtistOverview /> },
      { path: '', element: <Navigate to="overview" /> },
    ],
  },
];
```

**Register in `app/routes/index.tsx`:**

```typescript
import { workspaceRoutes } from './workspace.routes';

export const routes = [
  ...publicRoutes,
  ...workspaceRoutes,
  ...accountingRoutes,
  // ... others
];
```

---

## 🧪 TEST LOCALLY

```bash
# Terminal 1: Frontend
pnpm dev:web

# Terminal 2: Backend (if needed)
pnpm dev:api

# Open in the browser
http://localhost:5173/workspace/artist/test-artist-id
```

---

## 🐛 TROUBLESHOOTING

### Error: "useWorkspaceContext must be used within WorkspaceProvider"
```
Solution: Check that ArtistWorkspaceLayout wraps the component in WorkspaceProvider
```

### Activities do not load
```
Solution:
1. Check that the API endpoint exists
2. Test the endpoint with curl
3. Check the browser console (network tab)
```

### Types are not found
```
Solution:
1. Check that workspace/types/workspace.types.ts exists
2. Check imports: import type { WorkspaceType } from '...'
3. Run `pnpm build` to see the full errors
```

### Style issues (Tailwind does not work)
```
Solution:
1. Check that classes use the standard naming (w-4, h-4, etc)
2. Check that tailwind.config.ts includes src/modules/**
3. Clear the cache: restart the Vite dev server (`pnpm dev:web`); there is no `clean` script
```

---

## 📚 QUICK REFERENCES

### Query Component Data
```typescript
const { data: releases } = useQuery({
  queryKey: ['releases', artistId],
  queryFn: () => fetch(`/api/artists/${artistId}/releases`),
});
```

### Log Activity
```typescript
await fetch('/api/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity_type: 'artist',
    entity_id: artistId,
    action: 'updated',
    description: `Artist ${name} was updated`,
    user_id: userId,
  }),
});
```

### Display Activity
```typescript
<ActivityTimeline activities={activities} isLoading={isLoading} />
```

---

## ✅ FIRST-DAY CHECKLIST

- [ ] Folder structure created
- [ ] Types defined
- [ ] Context created
- [ ] Basic hook works
- [ ] First component renders
- [ ] Backend setup (ActivityLog)
- [ ] Endpoints tested
- [ ] First page works
- [ ] Route registered
- [ ] Can navigate in the browser

---

## 🎉 CONGRATULATIONS!

If you got here, you have:
- ✅ Workspace infrastructure working
- ✅ Activity logging setup
- ✅ First page rendering
- ✅ Data flowing from the backend to the frontend

**Next step**: Implement more tabs of the Artist Workspace (releases, campaigns, etc)

---

**Questions?** See:
1. [RESTRUCTURING_OPERATIONAL_ARCHITECTURE.md](./RESTRUCTURING_OPERATIONAL_ARCHITECTURE.md) (historical record)
2. [PHASE_1_IMPLEMENTATION_GUIDE.md](./PHASE_1_IMPLEMENTATION_GUIDE.md) (historical record)
3. [ARCHITECTURE_DECISION_RECORDS.md](./ARCHITECTURE_DECISION_RECORDS.md)
