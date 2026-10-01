import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { canonicalizeStoredMusicWork, canonicalizeStoredParticipants, canonicalizeStoredVariables } from "@/modules/contracts/lib/contract-variable-vocabulary";
import { toast } from "sonner";
import { contractsService } from "@/modules/contracts/services/contracts.service";
import type { StorageRow } from "@/shared/lib/storage";
import type {
  ContractVariable,
  Participant,
  MusicWork,
  SignatureSettings,
  BrandingSettings,
} from "@/modules/contracts/types/contracts.types";

import { UserFacingError, toUserMessage } from "@/shared/lib/errors";
import {
  normalizeClientTypes,
  normalizeFinancialModel,
  normalizePaymentFrequency,
  type ClientType,
  type FinancialModel,
} from "@/modules/contracts/lib/contract-service-type-vocabulary";

export type { ClientType, FinancialModel };

export interface ContractServiceType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  client_types: ClientType[];
  financial_model: FinancialModel;
  requires_external_rights_terms: boolean;
  requires_fixed_value: boolean;
  requires_advance: boolean;
  requires_financial_support: boolean;
  allow_installments: boolean;
  default_financial_category: string | null;
  active: boolean;
  sort_order: number;
  header_image_url: string | null;
  footer_image_url: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  variables: ContractVariable[];
  music_work: MusicWork | null;
  signature_settings: SignatureSettings | null;
  branding_settings: BrandingSettings | null;
  financial_currency: string;
  financial_payment_frequency: string;
  financial_penalty_percentage: number | null;
  financial_interest_percentage: number | null;
  financial_due_days: number | null;
}

export type ContractServiceTypeInsert = Omit<ContractServiceType, "id" | "created_at" | "updated_at">;
export type ContractServiceTypeUpdate = Partial<ContractServiceTypeInsert> & { id: string };

const QUERY_KEY = ["contract_service_types"] as const;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function rowToType(row: StorageRow): ContractServiceType {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description != null ? String(row.description) : null,
    category: row.category != null ? String(row.category) : null,
    client_types: normalizeClientTypes(row.client_types),
    financial_model: normalizeFinancialModel(row.financial_model),
    requires_external_rights_terms: Boolean(row.requires_external_rights_terms),
    requires_fixed_value: Boolean(row.requires_fixed_value),
    requires_advance: Boolean(row.requires_advance),
    requires_financial_support: Boolean(row.requires_financial_support),
    allow_installments: Boolean(row.allow_installments),
    default_financial_category:
      row.default_financial_category != null ? String(row.default_financial_category) : null,
    active: Boolean(row.active),
    sort_order: Number(row.sort_order ?? 0),
    header_image_url: row.header_image_url != null ? String(row.header_image_url) : null,
    footer_image_url: row.footer_image_url != null ? String(row.footer_image_url) : null,
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    participants: canonicalizeStoredParticipants(parseJson<Participant[]>(row.participants, [])),
    variables: canonicalizeStoredVariables(parseJson<ContractVariable[]>(row.variables, [])),
    music_work: canonicalizeStoredMusicWork(parseJson<MusicWork | null>(row.music_work, null)),
    signature_settings: parseJson<SignatureSettings | null>(row.signature_settings, null),
    branding_settings: parseJson<BrandingSettings | null>(row.branding_settings, null),
    financial_currency: String(row.financial_currency ?? "BRL"),
    financial_payment_frequency: normalizePaymentFrequency(row.financial_payment_frequency),
    financial_penalty_percentage: row.financial_penalty_percentage != null ? Number(row.financial_penalty_percentage) : null,
    financial_interest_percentage: row.financial_interest_percentage != null ? Number(row.financial_interest_percentage) : null,
    financial_due_days: row.financial_due_days != null ? Number(row.financial_due_days) : null,
  };
}

export function useContractServiceTypes(filterByClientType?: ClientType | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ContractServiceType[]> => {
      const rows = await contractsService.listContractServiceTypes();
      return rows.map(rowToType).sort((a, b) => a.sort_order - b.sort_order);
    },
  });

  const allTypes: ContractServiceType[] = query.data ?? [];

  const activeTypes = allTypes.filter((t) => t.active);

  const filteredTypes = filterByClientType
    ? activeTypes.filter((t) => t.client_types.includes(filterByClientType))
    : activeTypes;

  const createMutation = useMutation({
    mutationFn: async (data: ContractServiceTypeInsert) => {
      const slug = data.slug?.trim() ? data.slug.trim() : slugify(data.name);
      if (allTypes.some((t) => t.slug === slug)) {
        throw new UserFacingError(`Duplicate contract service type slug: ${slug}`, `Já existe um tipo com o identificador "${slug}".`);
      }
      return contractsService.createContractServiceType({
        ...data,
        slug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Tipo de contrato criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(toUserMessage(err, "Erro ao criar tipo de contrato"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: ContractServiceTypeUpdate) => {
      if (data.slug !== undefined) {
        const slug = data.slug.trim();
        if (!slug) throw new UserFacingError("Empty contract service type slug", "O identificador não pode ficar vazio.");
        if (allTypes.some((t) => t.slug === slug && t.id !== id)) {
          throw new UserFacingError(`Duplicate contract service type slug: ${slug}`, `Já existe um tipo com o identificador "${slug}".`);
        }
        data.slug = slug;
      }
      return contractsService.updateContractServiceType(id, {
        ...data,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Tipo de contrato atualizado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(toUserMessage(err, "Erro ao atualizar tipo de contrato"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const typeToArchive = allTypes.find((t) => t.id === id);
      if (typeToArchive) {
        const contracts = await contractsService.list();
        const inUse = contracts.some(
          (c: StorageRow) =>
            c["service_type"] === typeToArchive.slug ||
            c["type"] === typeToArchive.slug,
        );
        if (inUse) {
          throw new UserFacingError(`Contract service type in use; cannot archive: ${typeToArchive.id}`, `O tipo "${typeToArchive.name}" está em uso por contratos existentes e não pode ser arquivado.`);
        }
      }
      return contractsService.archiveContractServiceType(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Tipo de contrato arquivado.");
    },
    onError: (err: Error) => {
      toast.error(toUserMessage(err, "Erro ao arquivar tipo de contrato"));
    },
  });

  function getTypeBySlug(slug: string): ContractServiceType | undefined {
    return allTypes.find((t) => t.slug === slug);
  }

  function isSlugInUse(slug: string, contracts: Array<Record<string, unknown>>): boolean {
    return contracts.some((c) => c.service_type === slug || c.type === slug);
  }

  return {
    serviceTypes: filteredTypes,
    allServiceTypes: allTypes,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation,
    update: updateMutation,
    archive: archiveMutation,
    getTypeBySlug,
    isSlugInUse,
    slugify,
  };
}
