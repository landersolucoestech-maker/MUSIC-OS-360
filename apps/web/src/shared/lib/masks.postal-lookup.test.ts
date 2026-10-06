import { afterEach, describe, expect, it, vi } from "vitest";
import { addressFromPostalLookup, fetchAddressByCep, type AddressFields, type ViaCepResponse } from "./masks";

const prev: AddressFields = { street: "Old street", neighborhood: "Old hood", city: "Old city", state: "OS", addressComplement: "" };
const wire = (o: Partial<ViaCepResponse>): ViaCepResponse => ({ cep: "01001-000", logradouro: "", complemento: "", bairro: "", localidade: "", uf: "", ...o });

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
    const polluted = { ...wire({}), street: "ignored", city: "ignored" } as unknown as ViaCepResponse;
    expect(addressFromPostalLookup(polluted, prev)).toEqual({ ...prev, addressComplement: "" });
  });
});

describe("fetchAddressByCep: the ViaCEP provider call", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubFetch = (impl: () => Promise<unknown>) => { const fn = vi.fn((..._args: unknown[]) => impl()); vi.stubGlobal("fetch", fn); return fn; };

  it("strips the postal code to its digits, calls the provider and returns its payload unchanged", async () => {
    const payload = wire({ logradouro: "Praça da Sé", localidade: "São Paulo", uf: "SP" });
    const fn = stubFetch(async () => ({ json: async () => payload }));
    await expect(fetchAddressByCep("01001-000")).resolves.toEqual(payload);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBe("https://viacep.com.br/ws/01001000/json/");
  });

  it("does not call the provider for a code that is not eight digits", async () => {
    const fn = stubFetch(async () => ({ json: async () => wire({}) }));
    await expect(fetchAddressByCep("0100")).resolves.toBeNull();
    await expect(fetchAddressByCep("010010000")).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns null when the provider flags the code as unknown or the request fails", async () => {
    stubFetch(async () => ({ json: async () => JSON.parse(`{"erro": true}`) }));
    await expect(fetchAddressByCep("99999-999")).resolves.toBeNull();
    stubFetch(async () => { throw new Error("network down"); });
    await expect(fetchAddressByCep("01001-000")).resolves.toBeNull();
  });
});
