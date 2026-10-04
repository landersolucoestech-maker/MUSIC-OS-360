// @ts-nocheck
// Profile reads the user's settings through the real useUserSettings hook: settings stored before the
// rename (legacy localStorage keys) still prefill position/department/phone, and saving re-persists
// them under the canonical names.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const { user, updateUser } = vi.hoisted(() => ({
  user: { id: "u1", email: "ana@example.com", role: "manager", user_metadata: {} },
  updateUser: vi.fn(async () => ({})),
}));

vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { updateUser: (...a: unknown[]) => updateUser(...a) } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/components/MainLayout", () => ({ MainLayout: ({ children }) => <div>{children}</div> }));

import Profile from "@/modules/settings/pages/Profile";

const KEY = "musicos360_user_settings:u1";
// legacy storage keys by canonical name (string-literal table)
const LEGACY_KEY: Record<string, string> = { position: "cargo", department: "setor" };
const stored = () => JSON.parse(localStorage.getItem(KEY) as string);

describe("Profile with settings saved under legacy localStorage keys", () => {
  beforeEach(() => { localStorage.clear(); updateUser.mockClear(); });

  it("shows the legacy position and department, and saving writes the canonical keys", async () => {
    localStorage.setItem(KEY, JSON.stringify({ full_name: "Ana Legada", phone: "11999990000", [LEGACY_KEY.position]: "Gerente", [LEGACY_KEY.department]: "Financeiro" }));
    render(<Profile />);
    await waitFor(() => expect(screen.getByText("Cargo:")).toBeInTheDocument());
    expect(screen.getByText("Cargo:").nextElementSibling).toHaveTextContent("Gerente");
    expect(screen.getByText("Setor:").nextElementSibling).toHaveTextContent("Financeiro");
    expect(screen.getByTestId("select-position")).toHaveTextContent("Gerente");
    expect(screen.getByTestId("select-department")).toHaveTextContent("Financeiro");
    expect(screen.getByTestId("input-full-name")).toHaveValue("Ana Legada");

    fireEvent.click(screen.getByTestId("button-edit-profile"));
    fireEvent.click(screen.getByTestId("button-save-profile"));
    await waitFor(() => expect(stored().position).toBe("Gerente"));
    expect(stored().department).toBe("Financeiro");
    expect(stored().phone).toBe("11999990000");
  });

  it("negative: without stored settings no position/department badge is shown", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByTestId("input-email")).toHaveValue("ana@example.com"));
    expect(screen.queryByText("Cargo:")).toBeNull();
    expect(screen.queryByText("Setor:")).toBeNull();
    expect(screen.getByTestId("input-full-name")).toHaveValue("ana");
  });

  it("negative: a canonical key wins over its legacy twin", async () => {
    localStorage.setItem(KEY, JSON.stringify({ [LEGACY_KEY.position]: "Analista", position: "Diretor(a)" }));
    render(<Profile />);
    await waitFor(() => expect(screen.getByText("Cargo:")).toBeInTheDocument());
    expect(screen.getByText("Cargo:").nextElementSibling).toHaveTextContent("Diretor(a)");
  });
});
