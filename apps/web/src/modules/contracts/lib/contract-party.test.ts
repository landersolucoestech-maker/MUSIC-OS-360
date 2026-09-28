import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  contractPartyLabel,
  ARTIST_NOT_FOUND_LABEL,
  CLIENT_NOT_FOUND_LABEL,
  NO_PARTY_LABEL,
} from "@/modules/contracts/lib/contract-party";

const ARTIST_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "44444444-4444-4444-8444-444444444444";

describe("contractPartyLabel (D1: English `artist` / `client` embeds)", () => {
  it("shows the artist stage name", () => {
    expect(contractPartyLabel({ artist_id: ARTIST_ID, artist: { id: ARTIST_ID, stage_name: "MC Teste" } })).toBe("MC Teste");
  });

  it("shows the client name (was always '—' when reading the removed `clientes.nome`)", () => {
    expect(contractPartyLabel({ client_id: CLIENT_ID, client: { id: CLIENT_ID, name: "Cliente Ltda" } })).toBe("Cliente Ltda");
  });

  it("prefers the artist, falls back to the client when the artist embed has no name", () => {
    expect(contractPartyLabel({
      artist_id: ARTIST_ID, artist: { id: ARTIST_ID, stage_name: "  " },
      client_id: CLIENT_ID, client: { id: CLIENT_ID, name: "Cliente Ltda" },
    })).toBe("Cliente Ltda");
  });

  it("a linked id whose embed is missing shows the PT-BR 'não encontrado' label, never '—' nor the id", () => {
    expect(contractPartyLabel({ artist_id: ARTIST_ID, artist: null })).toBe(ARTIST_NOT_FOUND_LABEL);
    expect(contractPartyLabel({ client_id: CLIENT_ID, client: null })).toBe(CLIENT_NOT_FOUND_LABEL);
    expect(contractPartyLabel({ client_id: CLIENT_ID, client: { id: CLIENT_ID, name: null } })).toBe(CLIENT_NOT_FOUND_LABEL);
    expect(ARTIST_NOT_FOUND_LABEL).toBe("Artista não encontrado");
    expect(CLIENT_NOT_FOUND_LABEL).toBe("Cliente não encontrado");
  });

  it("'—' only when the contract has no party at all", () => {
    expect(contractPartyLabel({})).toBe(NO_PARTY_LABEL);
  });
});

describe("contracts readers use the English embeds (guard)", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");
  it.each(["../pages/Contracts.tsx", "../components/ContractViewModal.tsx"])("%s reads contractPartyLabel, not artistas/clientes", (rel) => {
    const src = read(rel);
    expect(src).toContain("contractPartyLabel(contract)");
    expect(src).not.toMatch(/\.(artistas|clientes)\??\./);
  });
});
