import { describe, it, expect, vi, beforeEach } from "vitest";

const listPaged = vi.fn();
vi.mock("@/shared/lib/storage", () => ({ storage: { listPaged: (...args: unknown[]) => listPaged(...args) } }));

import { fetchDashboardEvents, UPCOMING_APPOINTMENTS_LIMIT } from "@/modules/dashboard/hooks/useDashboardEvents";

type Opts = { page: number; pageSize: number; filters: Record<string, string>; orderBy?: { column: string; ascending: boolean } };
const page = (items: unknown[], total: number, pageSize: number) => ({ items, total, page: 1, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

/**
 * N4 — the unfiltered events list returned only the API default page (the 50
 * oldest events), so a tenant with more history had no upcoming appointments
 * and zeroed counters. These tests prove every figure comes from a
 * starts_at-scoped server query.
 */
describe("fetchDashboardEvents", () => {
  const now = new Date(2030, 9, 10, 15, 0, 0);

  beforeEach(() => {
    listPaged.mockReset();
  });

  it("counts today and the month from the API total of starts_at-bounded queries", async () => {
    listPaged.mockImplementation((_t: string, o: Opts) => {
      if (o.orderBy) return Promise.resolve(page([], 0, o.pageSize));
      const from = new Date(o.filters.dateFrom);
      return Promise.resolve(page([{ id: "x" }], from.getDate() === 1 ? 312 : 7, o.pageSize));
    });
    const result = await fetchDashboardEvents(now);
    expect(result.todayCount).toBe(7);
    expect(result.monthCount).toBe(312);
    const bounded = listPaged.mock.calls.map(([, o]) => o as Opts).filter((o) => !o.orderBy);
    const today = bounded.find((o) => new Date(o.filters.dateFrom).getDate() === 10)!;
    expect(new Date(today.filters.dateFrom)).toEqual(new Date(2030, 9, 10, 0, 0, 0, 0));
    expect(new Date(today.filters.dateTo)).toEqual(new Date(2030, 9, 10, 23, 59, 59, 999));
    const month = bounded.find((o) => new Date(o.filters.dateFrom).getDate() === 1)!;
    expect(new Date(month.filters.dateTo)).toEqual(new Date(2030, 9, 31, 23, 59, 59, 999));
  });

  it("asks for upcoming events from now, ascending, and drops closed statuses", async () => {
    listPaged.mockImplementation((_t: string, o: Opts) => {
      if (!o.orderBy) return Promise.resolve(page([], 0, o.pageSize));
      return Promise.resolve(page([
        { id: "a", status: "cancelled" },
        { id: "b", status: "confirmed" },
        { id: "c", status: "completed" },
        { id: "d", status: "postponed" },
      ], 4, o.pageSize));
    });
    const result = await fetchDashboardEvents(now);
    expect(result.upcoming.map((e) => e.id)).toEqual(["b", "d"]);
    const upcomingCall = listPaged.mock.calls.map(([, o]) => o as Opts).find((o) => o.orderBy)!;
    expect(upcomingCall.filters.dateFrom).toBe(now.toISOString());
    expect(upcomingCall.orderBy).toEqual({ column: "starts_at", ascending: true });
  });

  it("pages past closed events until it has enough upcoming appointments", async () => {
    listPaged.mockImplementation((_t: string, o: Opts) => {
      if (!o.orderBy) return Promise.resolve(page([], 0, o.pageSize));
      const items = o.page === 1
        ? Array.from({ length: o.pageSize }, (_, i) => ({ id: `x${i}`, status: "cancelled" }))
        : Array.from({ length: 8 }, (_, i) => ({ id: `ok${i}`, status: "scheduled" }));
      return Promise.resolve({ ...page(items, o.pageSize + 8, o.pageSize), page: o.page });
    });
    const result = await fetchDashboardEvents(now);
    expect(result.upcoming).toHaveLength(UPCOMING_APPOINTMENTS_LIMIT);
    expect(result.upcoming[0].id).toBe("ok0");
  });
});
