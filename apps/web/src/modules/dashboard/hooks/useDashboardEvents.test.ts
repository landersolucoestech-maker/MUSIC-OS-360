import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

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
  // Browser in UTC while the system timezone is America/Sao_Paulo (month bounds must follow the system one).
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  const now = new Date(2030, 9, 10, 15, 0, 0);

  beforeEach(() => {
    listPaged.mockReset();
  });

  it("counts the month from the API total of a starts_at query bounded in the system timezone", async () => {
    listPaged.mockImplementation((_t: string, o: Opts) =>
      Promise.resolve(o.orderBy ? page([], 0, o.pageSize) : page([{ id: "x" }], 312, o.pageSize)));
    // 2030-11-01T01:00Z is still 31/10/2030 22:00 in America/Sao_Paulo: October, whatever the browser timezone.
    const result = await fetchDashboardEvents(new Date("2030-11-01T01:00:00.000Z"));
    expect(result.monthCount).toBe(312);
    const bounded = listPaged.mock.calls.map(([, o]) => o as Opts).filter((o) => !o.orderBy);
    expect(bounded).toHaveLength(1);
    expect(bounded[0].filters).toEqual({ dateFrom: "2030-10-01T03:00:00.000Z", dateTo: "2030-11-01T02:59:59.999Z" });
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
    expect(result.upcomingIncomplete).toBe(false);
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

  it("flags an incomplete list when closed events fill every scanned page", async () => {
    listPaged.mockImplementation((_t: string, o: Opts) => {
      if (!o.orderBy) return Promise.resolve(page([], 0, o.pageSize));
      const items = Array.from({ length: o.pageSize }, (_, i) => ({ id: `p${o.page}-${i}`, status: "cancelled" }));
      return Promise.resolve({ ...page(items, o.pageSize * 10, o.pageSize), page: o.page });
    });
    const result = await fetchDashboardEvents(now);
    expect(result.upcoming).toEqual([]);
    expect(result.upcomingIncomplete).toBe(true);
  });
});
