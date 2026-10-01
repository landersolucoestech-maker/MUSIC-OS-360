import { describe, expect, it } from "vitest";
import { buildArtistRegistrationAdditionalData } from "./artist-registration-payload";

const base = {
  legalName: " Maria da Silva ",
  gender: "",
  specialties: [],
  photoUrl: "",
  personalDocumentsUrl: "",
  presskitUrl: "",
  birthDate: "",
  taxId: "",
  rg: "",
  address: "",
  bank: "Nubank",
  agency: "0001",
  account: "123",
  pixKey: "maria@example.com",
  accountHolder: "Maria",
  profileType: "independent",
  teamContacts: [],
  generalDistributors: [],
  internalNotes: "",
};

describe("buildArtistRegistrationAdditionalData", () => {
  it("emits canonical English keys only", () => {
    const data = buildArtistRegistrationAdditionalData(base);
    expect(Object.keys(data).sort()).toEqual(
      [
        "account", "accountHolder", "address", "agency", "bank", "birthDate", "gender", "generalDistributors",
        "internalNotes", "legalName", "personalDocumentsUrl", "photoUrl", "pixKey", "presskitUrl", "profileType",
        "rg", "specialties", "taxId", "teamContacts",
      ].sort(),
    );
    for (const legacy of ["nomeCivil", "chavePix", "titularConta", "tipoPerfil", "contatosEquipe", "notasInternas"]) {
      expect(data).not.toHaveProperty(legacy);
    }
  });

  it("trims the legal name, nulls empty values and keeps provided ones", () => {
    const data = buildArtistRegistrationAdditionalData(base);
    expect(data.legalName).toBe("Maria da Silva");
    expect(data.gender).toBeNull();
    expect(data.specialties).toBeNull();
    expect(data.teamContacts).toBeNull();
    expect(data.pixKey).toBe("maria@example.com");
    expect(data.profileType).toBe("independent");
  });

  it("keeps team contacts and distributors with English entry keys", () => {
    const data = buildArtistRegistrationAdditionalData({
      ...base,
      teamContacts: [
        { name: "Ana", category: "press_office", phone: "1", email: "a@b.c", distributors: [{ id: "other", email: "", customName: "X" }] },
      ],
      generalDistributors: [{ id: "onerpm", email: "d@e.f" }],
    });
    expect(data.teamContacts).toEqual([
      { name: "Ana", category: "press_office", phone: "1", email: "a@b.c", distributors: [{ id: "other", email: "", customName: "X" }] },
    ]);
    expect(data.generalDistributors).toEqual([{ id: "onerpm", email: "d@e.f" }]);
  });
});
