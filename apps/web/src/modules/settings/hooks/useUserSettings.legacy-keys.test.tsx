import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { updateUser: vi.fn() } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useUserSettings } from "./useUserSettings";

const KEY = "musicos360_user_settings:u1";

const LEGACY_TO_CANONICAL: Array<[string, string, unknown]> = [
  ["cargo", "position", "Manager"],
  ["setor", "department", "Ops"],
  ["notify_lancamentos", "notify_releases", false],
  ["notify_contratos", "notify_contracts", false],
  ["notify_financeiro", "notify_finance", false],
  ["auto_notificar_vencimento", "auto_notify_expiry", false],
  ["auto_lembrete_renovacao", "auto_renewal_reminder", false],
  ["auto_alerta_financeiro", "auto_finance_alert", true],
  ["auto_relatorio_semanal", "auto_weekly_report", true],
];

describe("useUserSettings legacy Portuguese key migrate-on-read", () => {
  beforeEach(() => localStorage.clear());

  it.each(LEGACY_TO_CANONICAL)("%s is read into %s", async (legacy, canonical, value) => {
    localStorage.setItem(KEY, JSON.stringify({ [legacy]: value }));
    const { result } = renderHook(() => useUserSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect((result.current.userSettings as unknown as Record<string, unknown>)[canonical]).toBe(value);
    expect(result.current.userSettings).not.toHaveProperty(legacy);
  });

  it("a canonical key wins over its legacy twin", async () => {
    localStorage.setItem(KEY, JSON.stringify({ cargo: "Old", position: "New" }));
    const { result } = renderHook(() => useUserSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userSettings.position).toBe("New");
  });
});
