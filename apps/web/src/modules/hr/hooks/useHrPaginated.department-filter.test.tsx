import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const paginated = vi.hoisted(() => vi.fn(() => ({ items: [], total: 0, totalPages: 0, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })));
vi.mock("@/shared/hooks/usePaginatedDataQuery", () => ({ usePaginatedDataQuery: paginated }));
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn() } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn(() => ({ data: undefined })) }));

import { useEmployeesPaginated } from "./useHrPaginated";

// The employees endpoint filters by `department`; `setor` is only a deprecated alias kept for old clients.
describe("useEmployeesPaginated: department filter", () => {
  it("sends the canonical `department` query parameter, never the deprecated `setor` alias", () => {
    renderHook(() => useEmployeesPaginated({ page: 0, pageSize: 10, department: "Finance", status: "active" }));
    const options = (paginated.mock.calls as unknown as Array<[{ filters: Record<string, unknown> }]>)[0][0];
    expect(options.filters).toEqual({ status: "active", department: "Finance" });
    expect(options.filters).not.toHaveProperty("setor");
  });

  it("sends no department filter when none is selected", () => {
    paginated.mockClear();
    renderHook(() => useEmployeesPaginated({ page: 0, pageSize: 10 }));
    const options = (paginated.mock.calls as unknown as Array<[{ filters: Record<string, unknown> }]>)[0][0];
    expect(options.filters).toEqual({});
  });
});
