import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ allow: false, loading: false }));

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: [],
    isLoadingPermissions: state.loading,
    hasPermission: () => state.allow,
    hasAllPermissions: () => state.allow,
    hasAnyPermission: () => state.allow,
    can: () => state.allow,
    canModule: () => state.allow,
  }),
}));

import { RequirePermission, PermissionGate, useHasPermission } from "../RequirePermission";
import { renderHook } from "@testing-library/react";

beforeEach(() => { state.allow = false; state.loading = false; });

describe("RequirePermission / PermissionGate", () => {
  it("renders children when authorized", () => {
    state.allow = true;
    render(
      <RequirePermission module="artists" action="write">
        <button>Nova</button>
      </RequirePermission>,
    );
    expect(screen.getByText("Nova")).toBeInTheDocument();
  });

  it("does not render children when NOT authorized (shows the fallback)", () => {
    state.allow = false;
    render(
      <RequirePermission module="artists" action="delete" fallback={<span>sem-acesso</span>}>
        <button>Excluir</button>
      </RequirePermission>,
    );
    expect(screen.queryByText("Excluir")).not.toBeInTheDocument();
    expect(screen.getByText("sem-acesso")).toBeInTheDocument();
  });

  it("while loading renders loadingFallback and NEVER opens children", () => {
    state.loading = true;
    state.allow = true; // even with allow, loading takes precedence (fail-closed)
    render(
      <RequirePermission module="accounting" action="export" loadingFallback={<span>carregando</span>}>
        <button>Exportar</button>
      </RequirePermission>,
    );
    expect(screen.queryByText("Exportar")).not.toBeInTheDocument();
    expect(screen.getByText("carregando")).toBeInTheDocument();
  });

  it("PermissionGate is an alias and respects the fallback", () => {
    state.allow = false;
    render(
      <PermissionGate module="contracts" action="delete" fallback={<span>bloqueado</span>}>
        <button>Apagar</button>
      </PermissionGate>,
    );
    expect(screen.getByText("bloqueado")).toBeInTheDocument();
  });

  it("useHasPermission mirrors canModule", () => {
    state.allow = true;
    expect(renderHook(() => useHasPermission("rh", "read")).result.current).toBe(true);
    state.allow = false;
    expect(renderHook(() => useHasPermission("rh", "read")).result.current).toBe(false);
  });
});
