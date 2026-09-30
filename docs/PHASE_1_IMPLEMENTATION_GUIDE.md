# 🎵 MUSIC OS 360 — PHASE 1 PRACTICAL IMPLEMENTATION GUIDE

**Phase 1: Technical Foundation and Workspace Infrastructure**  
**Duration**: 2 weeks  
**Goal**: Prepare the technical foundation for all workspaces

---

## 📦 INITIAL STRUCTURE SETUP

### 1. Create the Base Folders

```bash
# Workspace Orchestration
mkdir -p apps/web/src/modules/workspace/{components,hooks,layouts,types,providers,contexts}

# Activity System
mkdir -p apps/web/src/modules/activity-log/{components,hooks,services,queries,types}

# Shared Components for Workspaces
mkdir -p apps/web/src/modules/shared-workspace-components/{cards,metrics,timelines,tables,sidebars}

# Workspace Contexts
mkdir -p apps/web/src/modules/contexts/{artist-workspace,release-workspace,campaign-workspace,project-workspace,contract-workspace}
```

### 2. Tipos Base (`workspace.types.ts`)

```typescript
// apps/web/src/modules/workspace/types/workspace.types.ts

export type WorkspaceType = 'artist' | 'release' | 'campaign' | 'project' | 'contract' | 'work' | 'event';

export type WorkspaceTab = 
  | 'overview' 
  | 'releases' 
  | 'campaigns' 
  | 'financial' 
  | 'contracts' 
  | 'tasks' 
  | 'assets' 
  | 'team' 
  | 'calendar' 
  | 'analytics' 
  | 'activity' 
  | 'conversations' 
  | 'approvals' 
  | 'settings'
  | 'distribution' 
  | 'content' 
  | 'recebimentos externos de direitos' 
  | 'goals' 
  | 'budget' 
  | 'creators' 
  | 'timeline' 
  | 'schedule' 
  | 'reports' 
  | 'document' 
  | 'parties' 
  | 'obligations' 
  | 'milestones';

export interface WorkspaceEntity {
  id: string;
  type: WorkspaceType;
  name: string;
  description?: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface WorkspaceContextValue {
  // Identification
  workspaceType: WorkspaceType;
  workspaceId: string;
  
  // Entity
  entity: WorkspaceEntity | null;
  isLoadingEntity: boolean;
  errorEntity: Error | null;
  
  // Tabs
  currentTab: WorkspaceTab;
  setCurrentTab: (tab: WorkspaceTab) => void;
  
  // UI State
  selectedItems: string[];
  setSelectedItems: (ids: string[]) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  
  // Activity
  activities: Activity[];
  isLoadingActivities: boolean;
  
  // Realtime
  isConnected: boolean;
  connectedUsers: number;
}

export interface Activity {
  id: string;
  entityType: WorkspaceType;
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'published' | 'archived';
  description: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface WorkspaceTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  href: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void | Promise<void>;
  variant?: 'default' | 'secondary' | 'destructive';
}
```

### 3. Context Provider (`WorkspaceContext.tsx`)

```typescript
// apps/web/src/modules/workspace/providers/WorkspaceContext.tsx

import { createContext, useContext, ReactNode } from 'react';
import type { WorkspaceContextValue, WorkspaceType } from '../types/workspace.types';

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

---

## 🎣 BASE HOOKS

### 1. Generic Workspace Hook

```typescript
// apps/web/src/modules/workspace/hooks/useWorkspace.ts

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceContextValue, WorkspaceTab, WorkspaceType, WorkspaceEntity, Activity } from '../types/workspace.types';

export function useWorkspace(
  workspaceType: WorkspaceType,
  workspaceId: string
): Omit<WorkspaceContextValue, 'setCurrentTab' | 'setSelectedItems' | 'setIsSidebarOpen'> & {
  setCurrentTab: (tab: WorkspaceTab) => void;
  setSelectedItems: (ids: string[]) => void;
  setIsSidebarOpen: (open: boolean) => void;
} {
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<WorkspaceTab>('overview');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load the entity
  const {
    data: entity,
    isPending: isLoadingEntity,
    error: errorEntity,
  } = useQuery({
    queryKey: [workspaceType, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/${workspaceType}s/${workspaceId}`
      );
      if (!response.ok) throw new Error('Falha ao carregar');
      return response.json();
    },
  });

  // Load activities
  const {
    data: activities = [],
    isPending: isLoadingActivities,
  } = useQuery({
    queryKey: ['activities', workspaceType, workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/activities?entityType=${workspaceType}&entityId=${workspaceId}&limit=50`
      );
      if (!response.ok) throw new Error('Falha ao carregar activities');
      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Setup realtime subscription (Supabase)
  useEffect(() => {
    // Here it would connect to the realtime channel
    // Example: supabase.channel(`${workspaceType}:${workspaceId}`).on('*', ...).subscribe()
  }, [workspaceType, workspaceId]);

  return {
    workspaceType,
    workspaceId,
    entity: entity || null,
    isLoadingEntity,
    errorEntity: errorEntity as Error | null,
    currentTab: currentTab as WorkspaceTab,
    setCurrentTab: (tab: WorkspaceTab) => setCurrentTab(tab),
    selectedItems,
    setSelectedItems,
    isSidebarOpen,
    setIsSidebarOpen,
    activities: activities as Activity[],
    isLoadingActivities,
    isConnected: true,
    connectedUsers: 1,
  };
}
```

### 2. Activity Log Hook

```typescript
// apps/web/src/modules/activity-log/hooks/useActivityLog.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Activity, WorkspaceType } from '@/modules/workspace/types/workspace.types';

export function useActivityLog(
  entityType: WorkspaceType,
  entityId: string,
  limit = 50
) {
  const queryClient = useQueryClient();

  // Load activities
  const {
    data: activities = [],
    isPending: isLoading,
    error,
  } = useQuery({
    queryKey: ['activities', entityType, entityId],
    queryFn: async () => {
      const response = await fetch(
        `/api/activities?entityType=${entityType}&entityId=${entityId}&limit=${limit}`
      );
      if (!response.ok) throw new Error('Falha ao carregar');
      return response.json() as Promise<Activity[]>;
    },
  });

  // Mutation to record an activity
  const logActivity = useMutation({
    mutationFn: async (data: {
      action: Activity['action'];
      description: string;
      metadata?: Record<string, any>;
    }) => {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          ...data,
        }),
      });
      if (!response.ok) throw new Error('Falha ao registrar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activities', entityType, entityId],
      });
    },
  });

  return { activities, isLoading, error, logActivity };
}
```

---

## 📊 SERVICES

### 1. Activity Service (Backend)

```typescript
// apps/api/src/modules/activity-log/activity-log.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityRepository: Repository<ActivityLog>
  ) {}

  async create(dto: CreateActivityLogDto, userId: string) {
    const activity = this.activityRepository.create({
      ...dto,
      user_id: userId,
    });

    await this.activityRepository.save(activity);

    // Broadcast to realtime subscribers
    this.broadcastActivity(activity);

    return activity;
  }

  async getByEntity(
    entityType: string,
    entityId: string,
    limit = 50,
    offset = 0
  ) {
    return this.activityRepository.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  private broadcastActivity(activity: ActivityLog) {
    // Implement with Supabase Realtime or similar
    // supabase.channel(`workspace:${activity.entity_type}:${activity.entity_id}`)
    //   .send('broadcast', { event: 'activity_created', payload: activity });
  }
}
```

### 2. Entity do Activity Log (TypeORM)

```typescript
// apps/api/src/modules/activity-log/entities/activity-log.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_logs')
@Index(['entity_type', 'entity_id', 'created_at'])
@Index(['user_id'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entity_type: string; // 'artist', 'release', 'campaign', etc

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string; // 'created', 'updated', 'deleted', 'approved', etc

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

  @UpdateDateColumn()
  updated_at: Date;
}
```

---

## 🎨 COMPONENTES COMPARTILHADOS

### 1. Standard Workspace Card

```typescript
// apps/web/src/modules/shared-workspace-components/cards/WorkspaceCard.tsx

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';

interface WorkspaceCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function WorkspaceCard({
  icon: Icon,
  title,
  description,
  status,
  statusVariant = 'secondary',
  children,
  action,
  footer,
  className,
}: WorkspaceCardProps) {
  return (
    <Card className={cn('workspace-card', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {Icon && (
              <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold truncate">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="mt-0.5">{description}</CardDescription>
              )}
            </div>
          </div>
          {status && (
            <Badge variant={statusVariant} className="flex-shrink-0">
              {status}
            </Badge>
          )}
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
```

### 2. Metrics Grid

```typescript
// apps/web/src/modules/shared-workspace-components/metrics/WorkspaceMetrics.tsx

import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Metric {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'primary' | 'success' | 'warning' | 'destructive' | 'muted';
}

const colorClasses: Record<string, string> = {
  primary: 'text-primary bg-primary/10',
  success: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950',
  warning: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  destructive: 'text-destructive bg-destructive/10',
  muted: 'text-muted-foreground bg-muted',
};

export function WorkspaceMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const TrendIcon =
          metric.trend === 'up'
            ? TrendingUp
            : metric.trend === 'down'
              ? TrendingDown
              : Minus;

        return (
          <Card key={metric.label} className="border-t-2 border-t-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                  {metric.trendValue && (
                    <div className="mt-1 flex items-center gap-1">
                      <TrendIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {metric.trendValue}
                      </span>
                    </div>
                  )}
                </div>
                <metric.icon className={cn('h-8 w-8', colorClasses[metric.color])} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

### 3. Activity Timeline

```typescript
// apps/web/src/modules/activity-log/components/ActivityTimeline.tsx

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/shared/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import type { Activity } from '@/modules/workspace/types/workspace.types';

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: () => <span className="h-2 w-2 rounded-full bg-green-500" />,
  updated: () => <span className="h-2 w-2 rounded-full bg-blue-500" />,
  deleted: () => <span className="h-2 w-2 rounded-full bg-red-500" />,
  approved: () => <span className="h-2 w-2 rounded-full bg-emerald-500" />,
  rejected: () => <span className="h-2 w-2 rounded-full bg-amber-500" />,
  published: () => <span className="h-2 w-2 rounded-full bg-purple-500" />,
  archived: () => <span className="h-2 w-2 rounded-full bg-gray-500" />,
};

interface ActivityTimelineProps {
  activities: Activity[];
  isLoading?: boolean;
  maxItems?: number;
}

export function ActivityTimeline({
  activities,
  isLoading,
  maxItems = 10,
}: ActivityTimelineProps) {
  const displayedActivities = activities.slice(0, maxItems);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (!displayedActivities.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma atividade ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedActivities.map((activity, index) => {
        const ActionIcon = actionIcons[activity.action] || actionIcons.updated;

        return (
          <div key={activity.id} className="flex gap-3">
            <div className="relative flex flex-col items-center pt-1">
              <ActionIcon />
              {index < displayedActivities.length - 1 && (
                <div className="absolute top-6 h-6 w-0.5 bg-border" />
              )}
            </div>
            <div className="flex-1 py-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {activity.user.avatar && (
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarImage src={activity.user.avatar} />
                    <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## 📑 BASE LAYOUT

### WorkspaceLayout Principal

```typescript
// apps/web/src/modules/workspace/layouts/WorkspaceLayout.tsx

import { ReactNode } from 'react';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { WorkspaceContextualSidebar } from '../components/WorkspaceContextualSidebar';
import { WorkspaceProvider } from '../providers/WorkspaceContext';
import { useWorkspace } from '../hooks/useWorkspace';
import type { WorkspaceContextValue, WorkspaceType } from '../types/workspace.types';
import { Skeleton } from '@/shared/ui/skeleton';

interface WorkspaceLayoutProps {
  workspaceType: WorkspaceType;
  workspaceId: string;
  tabs: Array<{ id: string; label: string; icon?: React.ComponentType<{ className?: string }> }>;
  children: ReactNode;
  rightSidebar?: ReactNode;
  showActivityTimeline?: boolean;
}

export function WorkspaceLayout({
  workspaceType,
  workspaceId,
  tabs,
  children,
  rightSidebar,
  showActivityTimeline = true,
}: WorkspaceLayoutProps) {
  const workspaceContext = useWorkspace(workspaceType, workspaceId);
  const [currentTab, setCurrentTab] = [
    workspaceContext.currentTab,
    workspaceContext.setCurrentTab,
  ];

  if (workspaceContext.isLoadingEntity) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
        <Skeleton className="md:col-span-1 h-96" />
        <Skeleton className="md:col-span-3 h-96" />
      </div>
    );
  }

  if (workspaceContext.errorEntity) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Erro ao carregar workspace</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider value={workspaceContext as WorkspaceContextValue}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Left Sidebar */}
        <WorkspaceSidebar workspace={workspaceContext.entity!} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <WorkspaceHeader
            workspace={workspaceContext.entity!}
            workspaceType={workspaceType}
          />

          {/* Tabs */}
          <div className="border-b border-border bg-card/50 px-6">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id as any)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    currentTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-4 w-4 mr-2 inline" />}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </div>
        </div>

        {/* Right Sidebar (Activity & Context) */}
        {(rightSidebar || showActivityTimeline) && (
          <WorkspaceContextualSidebar
            activities={workspaceContext.activities}
            workspace={workspaceContext.entity!}
          >
            {rightSidebar}
          </WorkspaceContextualSidebar>
        )}
      </div>
    </WorkspaceProvider>
  );
}
```

---

## ✅ PHASE 1 IMPLEMENTATION CHECKLIST

```
STRUCTURAL SETUP
[ ] Create the workspace/, activity-log/, shared-workspace-components/ folders
[ ] Create the workspace.types.ts file with all interfaces
[ ] Create WorkspaceContext and WorkspaceProvider
[ ] Create the base hooks (useWorkspace, useActivityLog)

BACKEND
[ ] Create the ActivityLog entity in TypeORM
[ ] Create ActivityLogService with create() and getByEntity()
[ ] Create the POST /api/activities and GET /api/activities endpoints
[ ] Create migrations for the activity_logs table
[ ] Add indexes for performance

COMPONENTS
[ ] Implement WorkspaceCard
[ ] Implement WorkspaceMetrics
[ ] Implement ActivityTimeline
[ ] Implement WorkspaceLayout

INTEGRATION
[ ] Connect the hooks to the API endpoints
[ ] Test queries and mutations
[ ] Implement error handling
[ ] Add loading states

DOCUMENTATION
[ ] Document interfaces and types
[ ] Create a usage example
[ ] Document patterns
```

---

**Next step: PHASE 2 — Artist Workspace Implementation**
