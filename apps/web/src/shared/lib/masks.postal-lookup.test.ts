import { describe, expect, it } from "vitest";
import { addressFromPostalLookup, type AddressFields, type ViaCEPResponse } from "./masks";

const prev: AddressFields = { street: "Old street", neighborhood: "Old hood", city: "Old city", state: "OS", addressComplement: "" };
const wire = (o: Partial<ViaCEPResponse>): ViaCEPResponse => ({ cep: "01001-000", logradouro: "", complemento: "", bairro: "", localidade: "", uf: "", ...o });

describe("addressFromPostalLookup: the ViaCEP wire fields map to the canonical address fields", () => {
  it("maps logradouro, bairro, localidade, uf and complemento to street, neighborhood, city, state and complement", () => {
    expect(addressFromPostalLookup(wire({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP", complemento: "lado ímpar" }), prev))
      .toEqual({ street: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP", addressComplement: "lado ímpar" });
  });
  it("keeps the previous value of every field the provider leaves empty", () => {
    expect(addressFromPostalLookup(wire({ localidade: "Rio de Janeiro" }), prev))
      .toEqual({ street: "Old street", neighborhood: "Old hood", city: "Rio de Janeiro", state: "OS", addressComplement: "" });
  });
  it("never overwrites a complement the user already typed", () => {
    expect(addressFromPostalLookup(wire({ complemento: "provider" }), { ...prev, addressComplement: "apt 4" }).addressComplement).toBe("apt 4");
  });
  it("does not read canonical-looking keys from the provider payload", () => {
    const polluted = { ...wire({}), street: "ignored", city: "ignored" } as unknown as ViaCEPResponse;
    expect(addressFromPostalLookup(polluted, prev)).toEqual({ ...prev, addressComplement: "" });
  });
});
