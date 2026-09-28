/**
 * inventory-legacy-fields.ts — CZ-032 deploy-skew compatibility for the
 * inventory contract.
 *
 * The canonical inventory request fields and status values are English. A web
 * build released before CZ-032 sends the Portuguese column names and status
 * slugs; they are accepted as deprecated input, moved/mapped here — the only
 * place that knows this vocabulary — and never reach persistence. Responses
 * are canonical.
 */
import { InventoryStatus } from '@music-os-360/types';
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const INVENTORY_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  quantidade: 'quantity',
  localizacao: 'storage_location',
  responsavel: 'responsible_person',
  setor: 'sector',
  data_entrada: 'entry_date',
  local_compra: 'purchase_location',
};

export const INVENTORY_QUERY_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  localizacao: 'storage_location',
};

export const INVENTORY_STATUSES = Object.values(InventoryStatus) as string[];

export const LEGACY_INVENTORY_STATUSES: Readonly<Record<string, InventoryStatus>> = {
  disponivel: InventoryStatus.AVAILABLE,
  em_uso: InventoryStatus.IN_USE,
  emprestado: InventoryStatus.ON_LOAN,
  manutencao: InventoryStatus.MAINTENANCE,
  danificado: InventoryStatus.DAMAGED,
  descartado: InventoryStatus.DISCARDED,
  reservado: InventoryStatus.RESERVED,
};

/** Every status value the API accepts on input (canonical first, then deprecated). */
export const ACCEPTED_INVENTORY_STATUSES = [...INVENTORY_STATUSES, ...Object.keys(LEGACY_INVENTORY_STATUSES)];

export function canonicalInventoryStatus<T extends string | null | undefined>(value: T): T | InventoryStatus {
  if (typeof value !== 'string') return value;
  return LEGACY_INVENTORY_STATUSES[value] ?? value;
}
