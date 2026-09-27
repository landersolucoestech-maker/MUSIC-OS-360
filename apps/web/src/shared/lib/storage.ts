import { NotFoundError, IntegrationError } from "./errors";
import { api, TABLE_ENDPOINT, PENDING_TABLES } from "./api-client";

export type StorageRow = Record<string, unknown> & { id: string };

export interface ListOptions {
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  _bypassTenant?: boolean;
  /** Cancels the request when the query that originated it becomes obsolete
   * (component unmounted, queryKey changed) — see React Query QueryFunctionContext. */
  signal?: AbortSignal;
}

export interface AuditEntry {
  id: string;
  entity: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  before: unknown;
  after: unknown;
  org_id: string | null;
  user_id: string;
  timestamp: string;
  version_after?: number;
}

interface ListEnvelope<T> {
  data: T[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedListOptions extends Omit<ListOptions, "limit" | "offset"> {
  page: number;
  pageSize: number;
}

interface StoragePort {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>;
  list<T extends StorageRow>(table: string, options?: ListOptions): Promise<T[]>;
  listPaged<T extends StorageRow>(table: string, options: PagedListOptions): Promise<PagedResult<T>>;
  findById<T extends StorageRow>(table: string, id: string): Promise<T | undefined>;
  getById<T extends StorageRow>(table: string, id: string): Promise<T | undefined>;
  create<T extends StorageRow>(
    table: string,
    data: Omit<T, "id" | "user_id" | "created_at" | "updated_at">,
  ): Promise<T>;
  update<T extends StorageRow>(table: string, id: string, data: Partial<T>): Promise<T>;
  updateOptimistic<T extends StorageRow>(
    table: string,
    id: string,
    data: Partial<T>,
    expectedVersion: number,
  ): Promise<T>;
  delete(table: string, id: string): Promise<void>;
  getAuditLog(filters?: {
    entity?: string;
    entity_id?: string;
    action?: "create" | "update" | "delete";
    limit?: number;
  }): Promise<AuditEntry[]>;
  raw(): never;
  getRaw<T>(key: string): T | null;
  setRaw<T>(key: string, value: T): void;
}

const pendingTablesWarned = new Set<string>();

function resolveTable(table: string): { ep: string } | { pending: true; reason: string } {
  const ep = TABLE_ENDPOINT[table];
  if (ep) return { ep };
  const reason = PENDING_TABLES[table];
  if (reason) {
    if (!pendingTablesWarned.has(table)) {
      pendingTablesWarned.add(table);
      console.warn(`[storage:http] ${table}: ${reason}. Module unavailable until backend route ships.`);
    }
    return { pending: true, reason };
  }
  throw new IntegrationError("storage", `Unknown table "${table}". Add it to TABLE_ENDPOINT or PENDING_TABLES in api-client.ts.`);
}

function unavailableTable(table: string, reason: string): never {
  throw new IntegrationError(
    "module-unavailable",
    `Module "${table}" unavailable in this version: ${reason}`,
    { retryable: false, statusCode: 503, userMessage: "Este módulo ainda não está disponível nesta versão." },
  );
}

function unwrapList<T>(response: T[] | ListEnvelope<T>, table: string): T[] {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;
  throw new IntegrationError(
    "storage",
    `Invalid list response for "${table}": expected an array or a paginated envelope { data, meta }.`,
  );
}

const httpStorage: StoragePort = {
  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  },

  async list<T extends StorageRow>(table: string, options?: ListOptions): Promise<T[]> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    const params = new URLSearchParams();
    if (options?.filters) {
      for (const [k, v] of Object.entries(options.filters)) {
        if (v != null) params.set(k, String(v));
      }
    }
    if (options?.orderBy) {
      params.set("orderBy", options.orderBy.column);
      params.set("ascending", String(options.orderBy.ascending ?? false));
    }
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    const qs = params.toString();
    const response = await api.get<T[] | ListEnvelope<T>>(`${resolved.ep}${qs ? `?${qs}` : ""}`, { signal: options?.signal });
    return unwrapList(response, table);
  },

  /**
   * Real server-side pagination (Task G): the API already implements
   * skip/take + getManyAndCount for artists/contracts/works/phonograms/
   * releases/shares/inventory/events/projects/employees/licenses/
   * takedowns/transactions (see PaginationDto/QueryXDto in the backend) and returns
   * `{ data, meta: { total, offset, limit } }`. This only unwraps that
   * envelope correctly — `storage.list()` above discards `meta.total`,
   * which is right for the "give me everything" uses (selects/lookups), but wrong
   * for a paginated table, which needs to know the tenant's real total.
   */
  async listPaged<T extends StorageRow>(table: string, options: PagedListOptions): Promise<PagedResult<T>> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    const { page, pageSize, filters, orderBy, signal } = options;
    const params = new URLSearchParams();
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v != null && v !== "") params.set(k, String(v));
      }
    }
    if (orderBy) {
      params.set("orderBy", orderBy.column);
      params.set("ascending", String(orderBy.ascending ?? false));
    }
    params.set("limit", String(pageSize));
    params.set("offset", String(Math.max(0, page - 1) * pageSize));
    const response = await api.get<T[] | ListEnvelope<T>>(`${resolved.ep}?${params.toString()}`, { signal });
    const items = unwrapList(response, table);
    const total = Array.isArray(response) ? items.length : (response.meta?.total ?? items.length);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async findById<T extends StorageRow>(table: string, id: string): Promise<T | undefined> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    try {
      return await api.get<T>(`${resolved.ep}/${id}`);
    } catch (err) {
      if (err instanceof NotFoundError) return undefined;
      throw err;
    }
  },

  async getById<T extends StorageRow>(table: string, id: string): Promise<T | undefined> {
    return httpStorage.findById<T>(table, id);
  },

  async create<T extends StorageRow>(
    table: string,
    data: Omit<T, "id" | "user_id" | "created_at" | "updated_at">,
  ): Promise<T> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    return api.post<T>(resolved.ep, data);
  },

  async update<T extends StorageRow>(table: string, id: string, data: Partial<T>): Promise<T> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    return api.patch<T>(`${resolved.ep}/${id}`, data);
  },

  async updateOptimistic<T extends StorageRow>(
    table: string,
    id: string,
    data: Partial<T>,
    _expectedVersion: number,
  ): Promise<T> {
    return httpStorage.update<T>(table, id, data);
  },

  async delete(table: string, id: string): Promise<void> {
    const resolved = resolveTable(table);
    if ("pending" in resolved) unavailableTable(table, resolved.reason);
    return api.delete(`${resolved.ep}/${id}`);
  },

  async getAuditLog(filters?: {
    entity?: string;
    entity_id?: string;
    action?: "create" | "update" | "delete";
    limit?: number;
  }): Promise<AuditEntry[]> {
    const params = new URLSearchParams();
    if (filters?.entity) params.set("entity", filters.entity);
    if (filters?.entity_id) params.set("entity_id", filters.entity_id);
    if (filters?.action) params.set("action", filters.action);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const response = await api.get<AuditEntry[] | ListEnvelope<AuditEntry>>(`/audit-log${qs ? `?${qs}` : ""}`);
    return unwrapList(response, "audit-log");
  },

  raw(): never {
    throw new IntegrationError("storage", "storage.raw() is unavailable; use a backend endpoint.");
  },

  getRaw<T>(_key: string): T | null {
    throw new IntegrationError("storage", "storage.getRaw() is unavailable; use a backend endpoint.");
  },

  setRaw<T>(_key: string, _value: T): void {
    throw new IntegrationError("storage", "storage.setRaw() is unavailable; use a backend endpoint.");
  },
};

export const storage: StoragePort = httpStorage;
