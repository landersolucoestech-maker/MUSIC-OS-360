import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";
import { MARKETING_QUERY_ROOT } from "./useMarketingResource";
import type {
  CreateMetaInput,
  Meta,
  GoalType,
  UpdateMetaInput,
} from "../types/marketing.types";

const QUERY_KEY = [MARKETING_QUERY_ROOT, "metas"] as const;
type ApiList<T> = T[] | { data: T[] };
type GoalRow = Record<string, any>;

function listRows<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  throw new Error("[marketing] invalid goals API response");
}

function progress(current: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
}

function normalizeType(value?: string): GoalType {
  const allowed: GoalType[] = [
    "seguidores", "streams", "shows", "receita",
    "engajamento", "lancamentos", "personalizada",
  ];
  return allowed.includes(value as GoalType) ? value as GoalType : "personalizada";
}

function fromApi(row: GoalRow): Meta {
  const meta = row.metadata ?? {};
  const target = Number(row.target_value ?? 0);
  const current = Number(row.current_value ?? 0);
  return {
    id: row.id,
    nome: row.title,
    title: row.title,
    descricao: meta.descricao ?? "",
    type: normalizeType(row.type),
    tipo_meta: row.type,
    categoria: meta.categoria ?? "",
    valorAlvo: target,
    valor_meta: target,
    valorAtual: current,
    valor_atual: current,
    unidade: meta.unidade ?? "",
    prazo: row.end_date ? String(row.end_date).slice(0, 10) : "",
    start_date: row.start_date,
    end_date: row.end_date,
    artist_id: row.artist_id,
    status: row.status,
    progresso: progress(current, target),
    responsavel: meta.responsavel ?? "",
    cor: meta.cor ?? "#6366f1",
    icone: meta.icone ?? "target",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toApi(input: CreateMetaInput) {
  if (!input.artist_id) {
    throw new Error("[marketing] artist_id is required to persist a goal");
  }
  const target = Number(input.valorAlvo ?? input.valor_meta ?? 0);
  const current = Number(input.valorAtual ?? input.valor_atual ?? 0);
  return {
    artist_id: String(input.artist_id),
    title: input.title ?? input.nome ?? "Meta",
    type: input.tipo_meta ?? input.type ?? "personalizada",
    target_value: String(target),
    current_value: String(current),
    status: input.status ?? "em_andamento",
    start_date: input.start_date ?? undefined,
    end_date: input.end_date ?? input.prazo ?? undefined,
    metadata: {
      descricao: input.descricao,
      categoria: input.categoria,
      unidade: input.unidade,
      responsavel: input.responsavel,
      cor: input.cor,
      icone: input.icone,
    },
  };
}

export function getProgressPercent(meta: Pick<Meta, "valorAtual" | "valorAlvo"> & {
  valor_atual?: number;
  valor_meta?: number;
}): number {
  return progress(
    Number(meta.valorAtual ?? meta.valor_atual ?? 0),
    Number(meta.valorAlvo ?? meta.valor_meta ?? 0),
  );
}

const EMPTY_METAS: Meta[] = [];

export function useGoals(enabled = true, artistId?: string) {
  const createMeta = useCreateGoal();
  const updateMetaMutation = useUpdateGoal();
  const deleteMetaMutation = useDeleteGoal();
  const query = useQuery({
    queryKey: artistId ? [...QUERY_KEY, "by-artist", artistId] : QUERY_KEY,
    queryFn: async ({ signal }) => listRows(await api.get<ApiList<GoalRow>>(
      `/artist-goals?limit=100${artistId ? `&artist_id=${encodeURIComponent(artistId)}` : ""}`,
      { signal },
    )).map(fromApi),
    enabled,
  });
  return {
    metas: query.data ?? EMPTY_METAS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    addMeta: createMeta.mutateAsync,
    updateMeta: updateMetaMutation.mutateAsync,
    deleteMeta: deleteMetaMutation.mutateAsync,
    getProgressPercent,
  };
}

export function useCreateGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMetaInput) => fromApi(await api.post<GoalRow>("/artist-goals", toApi(input))),
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
    mutationFn: async ({ id, ...input }: UpdateMetaInput) => {
      const current = await api.get<GoalRow>(`/artist-goals/${id}`);
      const merged: CreateMetaInput = {
        nome: current.title,
        title: current.title,
        descricao: current.metadata?.descricao ?? "",
        type: current.type,
        categoria: current.metadata?.categoria ?? "",
        valorAlvo: Number(current.target_value ?? 0),
        valorAtual: Number(current.current_value ?? 0),
        unidade: current.metadata?.unidade ?? "",
        artist_id: current.artist_id,
        status: current.status,
        start_date: current.start_date,
        end_date: current.end_date,
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
