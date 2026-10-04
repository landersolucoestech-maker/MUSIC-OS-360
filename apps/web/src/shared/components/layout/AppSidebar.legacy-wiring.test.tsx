import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockUser: Record<string, unknown> | null = null;
vi.mock("@/app/providers/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, signOut: vi.fn() }),
}));
vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({
    tenant: { name: "LANDER", plan: "enterprise", config: { logoUrl: null } },
    isFeatureEnabled: () => true,
  }),
}));

import { AppSidebar } from "./AppSidebar";

function renderFor(role: string | null) {
  mockUser = role === null ? null : { email: "u@lander.example", role, user_metadata: { full_name: "Ana Souza" } };
  return render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
}

/**
 * The admin entries are gated by the role resolved through useCurrentRole()/useIsAdmin():
 * "Painel Admin" for super_admin/owner/tenant_owner, "Auditoria" for every admin-level role.
 */
describe("AppSidebar role-gated entries", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it.each(["super_admin", "owner", "tenant_owner"])("%s sees the admin panel and the audit entry", (role) => {
    renderFor(role);
    expect(screen.getByText("Painel Admin")).toBeTruthy();
    expect(screen.getByTestId("nav-link-auditoria")).toBeTruthy();
  });

  it("admin sees the audit entry but not the admin panel", () => {
    renderFor("admin");
    expect(screen.getByTestId("nav-link-auditoria")).toBeTruthy();
    expect(screen.queryByText("Painel Admin")).toBeNull();
  });

  it.each(["viewer", "manager", "artista", "colaborador", "rh_manager", "not_a_role"])("%s sees neither", (role) => {
    renderFor(role);
    expect(screen.queryByText("Painel Admin")).toBeNull();
    expect(screen.queryByTestId("nav-link-auditoria")).toBeNull();
  });

  it("an unauthenticated user sees neither", () => {
    renderFor(null);
    expect(screen.queryByText("Painel Admin")).toBeNull();
    expect(screen.queryByTestId("nav-link-auditoria")).toBeNull();
  });
});
