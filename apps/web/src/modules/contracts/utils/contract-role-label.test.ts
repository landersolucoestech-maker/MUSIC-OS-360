import { describe, expect, it } from "vitest";
import { contractRoleLabel } from "./contract-variables";

describe("contractRoleLabel", () => {
  it("maps known machine role keys to PT-BR labels", () => {
    expect(contractRoleLabel("REPRESENTANTE_LEGAL")).toBe("Representante Legal");
    expect(contractRoleLabel("CONTRATANTE")).toBe("Contratante");
    expect(contractRoleLabel("OUTRO")).toBe("Outro");
  });

  it("humanizes unknown keys instead of leaking the raw key", () => {
    expect(contractRoleLabel("PARTE_INTERESSADA")).toBe("Parte interessada");
    expect(contractRoleLabel("")).toBe("");
  });
});
