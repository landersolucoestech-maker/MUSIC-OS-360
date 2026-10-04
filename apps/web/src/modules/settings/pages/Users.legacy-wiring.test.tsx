// @ts-nocheck
// Users page renders the member status badge through userStatusLabel: legacy stored statuses show their
// PT-BR label, never the raw stored value.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const { members } = vi.hoisted(() => ({ members: { value: [] as unknown[] } }));

vi.mock("@/modules/settings/hooks/useUsers", () => ({
  useUsers: () => ({ users: members.value, isLoading: false }),
}));
vi.mock("@/modules/settings/hooks/useRoles", () => ({ useRoles: () => ({ roles: [] }) }));
vi.mock("@/shared/components/MainLayout", () => ({ MainLayout: ({ children }) => <div>{children}</div> }));
vi.mock("@/modules/settings/components/UserEditorModal", () => ({ UserEditorModal: () => null }));
vi.mock("@/modules/settings/components/UserViewModal", () => ({ UserViewModal: () => null }));

import UsersPage from "@/modules/settings/pages/Users";

function member(id: string, status: string) {
  return {
    id,
    email: `${id}@example.com`,
    full_name: `Member ${id}`,
    phone: null,
    avatar_url: null,
    role: "member",
    status,
    created_at: "2026-01-02T00:00:00.000Z",
  };
}

const statusCell = (id: string) =>
  screen.getByTestId(`row-user-${id}`).querySelectorAll("td")[4].textContent;

// [stored status, expected visible label]
const STATUS_TABLE: ReadonlyArray<readonly [string, string]> = [
  ["ativo", "Ativo"],
  ["inativo", "Inativo"],
  ["suspenso", "Suspenso"],
  ["pendente", "Pendente"],
  ["active", "Ativo"],
  ["suspended", "Suspenso"],
  ["invited", "Pendente"],
];

describe("Users page status badge", () => {
  it.each(STATUS_TABLE)("stored status %s renders %s", (stored, label) => {
    members.value = [member("m1", stored)];
    render(<UsersPage />);
    expect(statusCell("m1")).toBe(label);
  });

  it("negative: an unknown stored status falls back to the active label, never the raw value", () => {
    members.value = [member("m2", "mystery_value")];
    render(<UsersPage />);
    expect(statusCell("m2")).toBe("Ativo");
    expect(screen.queryByText("mystery_value")).toBeNull();
  });

  it("each row is labelled independently", () => {
    members.value = [member("a", "inativo"), member("b", "ativo")];
    render(<UsersPage />);
    expect(statusCell("a")).toBe("Inativo");
    expect(statusCell("b")).toBe("Ativo");
  });
});
