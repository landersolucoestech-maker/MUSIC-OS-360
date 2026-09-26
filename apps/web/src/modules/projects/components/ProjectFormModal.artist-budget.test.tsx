/**
 * GAP-0001 / DEC-001 — ProjectFormModal deve enviar artist_id e orcamento
 * (colunas reais projects.artist_id / projects.orcamento, aceitas pelo DTO
 * real CreateProjectDto/UpdateProjectDto). Antes o formulário não tinha
 * inputs para nenhum dos dois: a única UI alcançável nunca os preenchia.
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
// Combobox real depende de rede — substituído por um botão que seleciona um id fixo.
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

describe("ProjectFormModal — artista principal e orçamento (GAP-0001)", () => {
  beforeEach(() => {
    addMutate.mockReset().mockResolvedValue({ id: "p-new" });
    updateMutate.mockReset().mockResolvedValue({});
    toastError.mockReset();
  });

  it("create envia artist_id e orcamento numérico", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    fireEvent.click(screen.getByTestId("select-projeto-artista"));
    fireEvent.change(screen.getByTestId("input-projeto-orcamento"), { target: { value: "15000.50" } });
    fireEvent.click(screen.getByRole("button", { name: /criar projeto/i }));

    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(addMutate.mock.calls[0][0]).toMatchObject({
      artist_id: "11111111-1111-4111-8111-111111111111",
      orcamento: 15000.5,
    });
  });

  it("create sem artista/orçamento envia null (não string vazia)", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    fireEvent.click(screen.getByRole("button", { name: /criar projeto/i }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledTimes(1));
    expect(addMutate.mock.calls[0][0]).toMatchObject({ artist_id: null, orcamento: null });
  });

  it("rejeita orçamento negativo sem chamar a API", async () => {
    render(<ProjectFormModal open onOpenChange={() => {}} mode="create" />);
    fillSingleName();
    const input = screen.getByTestId("input-projeto-orcamento") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-10" } });
    // submit direto no form: o min="0" nativo já bloquearia o clique no
    // navegador; aqui provamos que a validação JS também recusa.
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("edit carrega e reenvia os valores persistidos", async () => {
    const projeto = {
      id: "p1", title: "Faixa", type: "single", status: "planning", updated_at: "2026-09-01T00:00:00Z",
      artist_id: "22222222-2222-4222-8222-222222222222", orcamento: "2500.00",
    };
    render(<ProjectFormModal open onOpenChange={() => {}} mode="edit" projeto={projeto} />);
    expect((screen.getByTestId("input-projeto-orcamento") as HTMLInputElement).value).toBe("2500.00");
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      id: "p1", artist_id: "22222222-2222-4222-8222-222222222222", orcamento: 2500,
    });
  });
});
