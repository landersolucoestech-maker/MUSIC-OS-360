import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/shared/lib/api-client", () => ({ api: {} }));
import { TICKET_CATEGORY_LABELS } from "./useSupport";

/** Mirrors CreateSupportTicketDto CATEGORIES (apps/api/src/modules/support-tickets/dto/support-tickets.dto.ts). */
const API_CATEGORIES = ["billing", "technical", "feature-request", "access", "other"];

describe("support ticket categories", () => {
  it("offer exactly the values the API accepts (the old Portuguese slugs were rejected with 400)", () => {
    expect(Object.keys(TICKET_CATEGORY_LABELS).sort()).toEqual([...API_CATEGORIES].sort());
  });

  it("every category has a PT-BR label without underscores", () => {
    for (const label of Object.values(TICKET_CATEGORY_LABELS)) expect(label).not.toMatch(/_/);
  });
});
