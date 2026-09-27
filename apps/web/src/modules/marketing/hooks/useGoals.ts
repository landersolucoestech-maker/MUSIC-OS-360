import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArtistGoalStatus } from "@music-os-360/types";
import { api } from "@/shared/lib/api-client";
import { MARKETING_QUERY_ROOT } from "./useMarketingResource";
import type {
  CreateGoalInput,
  Goal,
  GoalType,
  UpdateGoalInput,
} from "../types/marketing.types";

const QUERY_KEY = [MARKETING_QUERY_ROOT, "goals"] as const;
type ApiList<T> = T[] | { data: T[] };
type GoalRow = Record<string, any>;

const GOAL_TYPES: readonly GoalType[] = ["streams", "followers", "shows", "revenue", "engagement", "releases", "other"];
const GOAL_STATUSES = Object.values(ArtistGoalStatus) as string[];

function listRows<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  throw new Error("[marketing] invalid goals API response");
}

function progress(current: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
}

function normalizeType(value?: string): GoalType {
  return GOAL_TYPES.includes(value as GoalType) ? value as GoalType : "other";
}

function normalizeStatus(value?: string): ArtistGoalStatus {
  return GOAL_STATUSES.includes(value ?? "") ? value as ArtistGoalStatus : ArtistGoalStatus.IN_PROGRESS;
}

function fromApi(row: GoalRow): Goal {
  const meta = row.metadata ?? {};
  const target = Number(row.target_value ?? 0);
  const current = Number(row.current_value ?? 0);
  return {
    id: row.id,
    title: row.title,
    description: meta.description ?? "",
    type: normalizeType(row.type),
    category: meta.category ?? "",
    targetValue: target,
    currentValue: current,
    unit: meta.unit ?? "",
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    artistId: row.artist_id ?? null,
    status: normalizeStatus(row.status),
    progress: progress(current, target),
    owner: meta.owner ?? "",
    color: meta.color ?? "#6366f1",
    icon: meta.icon ?? "target",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toApi(input: CreateGoalInput) {
  if (!input.artistId) {
    throw new Error("[marketing] artistId is required to persist a goal");
  }
  return {
    artist_id: String(input.artistId),
    title: input.title,
    type: input.type,
    target_value: String(Number(input.targetValue ?? 0)),
    current_value: String(Number(input.currentValue ?? 0)),
    status: input.status ?? ArtistGoalStatus.IN_PROGRESS,
    start_date: input.startDate ?? undefined,
    end_date: input.endDate ?? undefined,
    metadata: {
      description: input.description,
      category: input.category,
      unit: input.unit,
      owner: input.owner,
      color: input.color,
      icon: input.icon,
    },
  };
}

export function getProgressPercent(goal: Pick<Goal, "currentValue" | "targetValue">): number {
  return progress(Number(goal.currentValue ?? 0), Number(goal.targetValue ?? 0));
}

const EMPTY_GOALS: Goal[] = [];

export function useGoals(enabled = true, artistId?: string) {
  const createGoal = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const query = useQuery({
    queryKey: artistId ? [...QUERY_KEY, "by-artist", artistId] : QUERY_KEY,
    queryFn: async ({ signal }) => listRows(await api.get<ApiList<GoalRow>>(
      `/artist-goals?limit=100${artistId ? `&artist_id=${encodeURIComponent(artistId)}` : ""}`,
      { signal },
    )).map(fromApi),
    enabled,
  });
  return {
    goals: query.data ?? EMPTY_GOALS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addGoal: createGoal.mutateAsync,
    updateGoal: updateGoalMutation.mutateAsync,
    deleteGoal: deleteGoalMutation.mutateAsync,
    getProgressPercent,
  };
}

export function useCreateGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => fromApi(await api.post<GoalRow>("/artist-goals", toApi(input))),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Meta criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar meta"),
  });
}

export function useUpdateGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateGoalInput) => {
      const current = fromApi(await api.get<GoalRow>(`/artist-goals/${id}`));
      const merged: CreateGoalInput = {
        artistId: String(current.artistId ?? ""),
        title: current.title,
        description: current.description,
        type: current.type,
        category: current.category,
        targetValue: current.targetValue,
        currentValue: current.currentValue,
        unit: current.unit,
        startDate: current.startDate,
        endDate: current.endDate,
        status: current.status,
        owner: current.owner,
        color: current.color,
        icon: current.icon,
        ...input,
      };
      return fromApi(await api.patch<GoalRow>(`/artist-goals/${id}`, toApi(merged)));
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Meta atualizada");
    },
    onError: () => toast.error("Erro ao atualizar meta"),
  });
}

export function useDeleteGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/artist-goals/${id}`);
      return { id };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Meta removida");
    },
    onError: () => toast.error("Erro ao remover meta"),
  });
}
