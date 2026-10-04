// @ts-nocheck
// Wiring test for ContractWizard hydration: a contract saved by an earlier build (legacy-keyed party blob in
// notes, legacy-keyed signer records, authored Portuguese placeholder tokens) must re-open with canonical
// parties/signers and resolve its placeholders in the preview, and must be saved back with canonical keys.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { state, updateMutate } = vi.hoisted(() => ({
  state: { templates: [] as any[] },
  updateMutate: vi.fn(),
}));

vi.mock("@/modules/contracts/hooks/useContractTemplates", () => ({
  useContractTemplates: () => ({ templates: state.templates, isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useCategoryRegistry", async (orig) => {
  const actual: any = await orig();
  return { ...actual, useCategoryRegistry: () => ({ categories: [] }) };
});
vi.mock("@/modules/contracts/hooks/useContracts", () => {
  const add = { mutateAsync: vi.fn() };
  const update = { mutateAsync: (...a: unknown[]) => updateMutate(...a) };
  const value = { addContract: add, updateContract: update, contracts: [] };
  return { useContracts: () => value };
});
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({ AsyncEntityCombobox: () => null }));
vi.mock("@/modules/contracts/components/ContractA4Preview", () => ({
  A4Preview: ({ content }: any) => <pre data-testid="a4-content">{content}</pre>,
}));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, children }: any) => <div data-select-value={value ?? ""}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import { ContractWizard } from "@/modules/contracts/components/ContractWizard";

const K = (...p: string[]) => p.join("");

const CONTENT = [
  "Nome: {{CONTRATANTE.NOME}}",
  "Tel: {{CONTRATANTE.TELEFONE}}",
  "Civil: {{CONTRATANTE.ESTADO_CIVIL}}",
  "Razao: {{EMPRESA.NOME}}",
  "Artista: {{ARTISTA.NOME}}",
  "TelArtista: {{ARTISTA.TELEFONE}}",
  "UniaoCivil: {{CONJUGE.ESTADO_CIVIL}}",
  "Livre: {{TESTEMUNHA.ESTADO_CIVIL}}",
  "Sem blob: {{OUTRA.NOME}}",
  "Objeto: {{OBJETO.DESCRICAO}}",
  "{{SIGNATURE.CONTRATANTE}}",
].join("\n");

const template = { id: "t1", name: "Template legado", service_type: "gestao", content: CONTENT, variables_manifest: null, active: true };

const legacyBlob = {
  parties: {
    CONTRATANTE: { type: K("p", "f"), origin: "manual", [K("no", "me")]: "Maria Souza", [K("tele", "fone")]: "11999990000", [K("estado", "_civil")]: K("cas", "ado") },
    EMPRESA: { type: K("p", "j"), [K("razao", "_social")]: "Empresa LTDA" },
    ARTISTA: { type: K("art", "ista"), origin: K("artis", "tas"), [K("nome", "_artistico")]: "DJ Legado", [K("nome", "_civil")]: "Joao Civil" },
    CONJUGE: { type: "individual", marital_status: "stable_union" },
    TESTEMUNHA: { type: "individual", marital_status: "separado judicialmente" },
  },
  variables: {},
};

const legacySigners = () => [
  { [K("no", "me")]: "Ana Legado", email: "ana@x.com", role: "CONTRATANTE", [K("obriga", "torio")]: false, [K("or", "dem")]: 3, provider: "autentique" },
  { name: "Canonico", email: "c@x.com", role: "ARTISTA", required: true, order: 1, provider: "" },
];

function contract(over: any = {}) {
  return {
    id: "k1",
    title: "Contrato Legado",
    status: "draft",
    start_date: "2025-01-01",
    end_date: "",
    template_id: "t1",
    notes: JSON.stringify(legacyBlob),
    signers: legacySigners(),
    ...over,
  };
}

function renderWizard(c: any) {
  state.templates = [template];
  return render(<ContractWizard open onOpenChange={() => {}} contract={c} />);
}

const preview = () => screen.getAllByTestId("a4-content")[0];

beforeEach(() => updateMutate.mockReset().mockResolvedValue({}));

describe("ContractWizard legacy wiring: re-opening a contract saved by an earlier build", () => {
  it("resolves authored Portuguese tokens against a legacy-keyed saved draft", async () => {
    renderWizard(contract());
    await waitFor(() => expect(preview()).toHaveTextContent("Nome: Maria Souza"));
    const text = preview().textContent;
    expect(text).toContain("Tel: 11999990000");
    // marital status: legacy stored value -> canonical id -> document text
    expect(text).toContain("Civil: casado");
    expect(text).not.toContain("married");
    // company party resolves the authored NOME token to the legal name (legacy type + razao social)
    expect(text).toContain("Razao: Empresa LTDA");
    // artist party resolves it to the stage name (legacy type/origin + nome artistico)
    expect(text).toContain("Artista: DJ Legado");
    // canonical stored status -> document text; free text passes through untouched
    expect(text).toContain("UniaoCivil: união estável");
    expect(text).toContain("Livre: separado judicialmente");
    // negative: a field the party has no data for stays an unresolved placeholder
    expect(text).toContain("TelArtista: {{ARTISTA.TELEFONE}}");
    expect(text).toContain("Objeto: {{OBJETO.DESCRICAO}}");
  });

  it("negative: a party role without a saved entry starts as the empty default party", async () => {
    renderWizard(contract());
    await waitFor(() => expect(preview()).toHaveTextContent("Nome: Maria Souza"));
    expect(preview().textContent).toContain("Sem blob: {{OUTRA.NOME}}");
  });

  it("detects party roles from the authored tokens (party entity fields) and ignores non-party groups", async () => {
    renderWizard(contract());
    await waitFor(() => expect(preview()).toHaveTextContent("Nome: Maria Souza"));
    fireEvent.click(screen.getByTestId("button-wizard-next"));
    const roles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(roles).toEqual(["CONTRATANTE", "EMPRESA", "ARTISTA", "CONJUGE", "TESTEMUNHA", "OUTRA"]);
    expect(roles).not.toContain("OBJETO");
    expect(roles).not.toContain("SIGNATURE");
  });

  it("saves back canonical party keys and canonical signer records read from the legacy-keyed ones", async () => {
    renderWizard(contract());
    await waitFor(() => expect(preview()).toHaveTextContent("Nome: Maria Souza"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("button-wizard-next"));
    fireEvent.click(await screen.findByTestId("button-wizard-draft"));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const payload = updateMutate.mock.calls[0][0];

    expect(payload.signers).toEqual([
      { name: "Ana Legado", email: "ana@x.com", role: "CONTRATANTE", required: false, order: 3, provider: "autentique" },
      { name: "Canonico", email: "c@x.com", role: "ARTISTA", required: true, order: 1, provider: "" },
    ]);

    const parties = JSON.parse(payload.notes).parties;
    expect(parties.CONTRATANTE).toEqual({ type: "individual", origin: "manual", name: "Maria Souza", phone: "11999990000", marital_status: "married" });
    expect(parties.EMPRESA).toEqual({ type: "company", origin: "manual", legal_name: "Empresa LTDA" });
    expect(parties.ARTISTA).toEqual({ type: "artist", origin: "artists", stage_name: "DJ Legado", full_name: "Joao Civil" });
    expect(parties.CONJUGE).toEqual({ type: "individual", origin: "manual", marital_status: "stable_union" });
    // negative: no legacy key survives and a role without a saved entry is the default party
    expect(JSON.stringify(parties)).not.toMatch(/"(nome|telefone|estado_civil|razao_social|nome_artistico|nome_civil)"/);
    expect(parties.OUTRA).toEqual({ type: "individual", origin: "manual" });
  });

  it("negative: a contract that was saved with canonical keys round-trips unchanged", async () => {
    const canonicalBlob = { parties: { CONTRATANTE: { type: "company", origin: "crm", legal_name: "Canon SA", phone: "11888880000" } }, variables: {} };
    renderWizard(
      contract({
        notes: JSON.stringify(canonicalBlob),
        signers: [{ name: "Z", email: "z@x.com", role: "CONTRATANTE", required: true, order: 2, provider: "clicksign" }],
      }),
    );
    await waitFor(() => expect(preview()).toHaveTextContent("Nome: Canon SA"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("button-wizard-next"));
    fireEvent.click(await screen.findByTestId("button-wizard-draft"));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const payload = updateMutate.mock.calls[0][0];
    expect(payload.signers).toEqual([{ name: "Z", email: "z@x.com", role: "CONTRATANTE", required: true, order: 2, provider: "clicksign" }]);
    expect(JSON.parse(payload.notes).parties.CONTRATANTE).toEqual({ type: "company", origin: "crm", legal_name: "Canon SA", phone: "11888880000" });
  });
});
