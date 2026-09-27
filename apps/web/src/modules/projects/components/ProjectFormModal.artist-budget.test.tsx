/**
 * GAP-0001 / DEC-001 — ProjectFormModal must send artist_id and budget
 * (real projects.artist_id / projects.budget columns, accepted by the
 * real CreateProjectDto/UpdateProjectDto). Previously the form had no inputs
 * for either: the only reachable UI never populated them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const addMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/modules/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    addProject: { mutateAsync: addMutate },
    updateProject: { mutateAsync: updateMutate },
  }),
}));
vi.mock("@/shared/hooks/useUploadToR2", () => ({
  useUploadToR2: () => ({ upload: vi.fn() }),
  R2NotConfiguredError: class extends Error {},
}));
vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityLookup: () => ({ items: [] }),
  useEntityById: () => ({ entity: undefined }),
}));
// Real combobox depends on the network — replaced by a button that selects a fixed id.
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({
  AsyncEntityCombobox: ({ onChange, "data-testid": id }: { onChange: (v: string) => void; "data-testid"?: string }) => (
    <button type="button" data-testid={id} onClick={() => onChange("11111111-1111-4111-8111-111111111111")}>pick</button>
  ),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import { ProjectFormModal } from "./ProjectFormModal";

function fillSingleName() {
  fireEvent.change(screen.getByPlaceholderText(/nome da música/i), { target: { value: "Minha Faixa" } });
}

describe("ProjectFormModal — main artist and budget (GAP-0001)", () => {
  beforeEach(() => {
    addMutate.mockReset().mockResolvedValue({ id: "p-new" });
    updateMutate.mockReset().mockResolvedValue({});
    toastError.mockReset();
  });

  it("create sends artist_id and numeric budget", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    fireEvent.click(screen.getByTestId("select-projeto-artista"));
    fireEvent.change(screen.getByTestId("input-project-budget"), { target: { value: "15000.50" } });
    fireEvent.click(screen.getByRole("button", { name: /criar projeto/i }));

    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(addMutate.mock.calls[0][0]).toMatchObject({
      artist_id: "11111111-1111-4111-8111-111111111111",
      budget: 15000.5,
    });
  });

  it("create without artist/budget sends null (not an empty string)", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    fireEvent.click(screen.getByRole("button", { name: /criar projeto/i }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(addMutate.mock.calls[0][0]).toMatchObject({ artist_id: null, budget: null });
  });

  it("rejects a negative budget without calling the API", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    const input = screen.getByTestId("input-project-budget") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-10" } });
    // Direct form submit: the native min="0" would already block the click in
    // the browser; here we prove the JS validation also rejects it.
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("edit loads and resends the persisted values", async () => {
    const project = {
      id: "p1", title: "Faixa", type: "single", status: "planning", updated_at: "2026-09-01T00:00:00Z",
      artist_id: "22222222-2222-4222-8222-222222222222", budget: "2500.00",
    };
    render(<ProjectFormModal open onOpenChange={() => {}} mode="edit" projeto={project} />);
    expect((screen.getByTestId("input-project-budget") as HTMLInputElement).value).toBe("2500.00");
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      id: "p1", artist_id: "22222222-2222-4222-8222-222222222222", budget: 2500,
    });
  });
});
