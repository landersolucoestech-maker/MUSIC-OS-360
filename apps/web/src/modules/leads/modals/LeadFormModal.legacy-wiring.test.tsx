// @ts-nocheck
// Wiring test for LeadFormModal: the status options come from useOperationalSettings (real hook, stored list
// mocked at the settings service, so pre-OL1 slugs are read as canonical) and the phone input stores the masked value.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: { getOperationalLists: vi.fn(() => []), saveOperationalLists: vi.fn() },
}));
vi.mock("@/shared/hooks/useUploadToR2", () => ({
  useUploadToR2: () => ({ upload: vi.fn(), isUploading: false }),
  R2NotConfiguredError: class R2NotConfiguredError extends Error {},
}));
vi.mock("@/shared/ui/date-picker-field", () => ({ DatePickerField: () => null }));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, children }: any) => <div data-select-value={value ?? ""}>{children}</div>,
  SelectTrigger: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import { settingsService } from "@/modules/settings/services/settings.service";
import { LeadFormModal } from "./LeadFormModal";

const K = (...p: string[]) => p.join("");
const item = (kind: string, slug: string, name: string, order: number) => ({ id: `${kind}-${slug}`, kind, name, slug, description: "", active: true, order, group: "Pipeline" });

const statusSelect = () => screen.getByTestId("select-lead-status").closest("[data-select-value]") as HTMLElement;
const statusOptions = () =>
  within(statusSelect()).queryAllByRole("option").map((o) => [o.getAttribute("data-value"), o.textContent]);

function renderForm(initialValue?: any) {
  return render(<LeadFormModal open onOpenChange={() => {}} mode="create" initialValue={initialValue} />);
}

beforeEach(() => vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]));

describe("LeadFormModal legacy wiring", () => {
  it("renders the default status options and selects the lead's status", () => {
    const { unmount } = renderForm({ leadStatus: "qualified" });
    expect(statusOptions()).toContainEqual(["qualified", "Qualificado"]);
    expect(statusSelect()).toHaveAttribute("data-select-value", "qualified");
    unmount();
  });

  it("a stored pre-OL1 default status is offered under its canonical slug (not the legacy one, no duplicate)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      item("lead_status", K("novo", "_lead"), "Novo lead", 10),
      item("lead_status", K("fe", "chado"), "Fechado", 70),
    ] as never);
    const { unmount } = renderForm();
    const opts = statusOptions();
    const values = opts.map((o) => o[0]);
    expect(opts).toContainEqual(["new", "Novo lead"]);
    expect(opts).toContainEqual(["closed", "Fechado"]);
    expect(values).not.toContain(K("novo", "_lead"));
    expect(values).not.toContain(K("fe", "chado"));
    expect(values.filter((v) => v === "new")).toHaveLength(1);
    expect(values.filter((v) => v === "closed")).toHaveLength(1);
    // the form default status is the canonical "new", which is therefore one of the offered options
    expect(statusSelect()).toHaveAttribute("data-select-value", "new");
    unmount();
  });

  it("negative: a tenant-edited status keeps its own slug", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      item("lead_status", K("qualifi", "cado"), "Meu qualificado", 40),
    ] as never);
    const { unmount } = renderForm();
    expect(statusOptions()).toContainEqual([K("qualifi", "cado"), "Meu qualificado"]);
    unmount();
  });

  it("phone input stores the masked value; non-digits are stripped", () => {
    const { unmount } = renderForm();
    const phone = screen.getByTestId("input-phone");
    fireEvent.change(phone, { target: { value: "11987654321" } });
    expect(phone).toHaveValue("(11) 98765-4321");
    fireEvent.change(phone, { target: { value: "1133334444" } });
    expect(phone).toHaveValue("(11) 3333-4444");
    fireEvent.change(phone, { target: { value: "abc" } });
    expect(phone).toHaveValue("");
    unmount();
  });
});
