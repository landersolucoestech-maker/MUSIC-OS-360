/**
 * Acceptance criterion for the artist export flow:
 * the exported file must have EXACTLY one column per Create form field,
 * with the same label and in the same visual order — both derived from
 * the single source of truth (ARTIST_FORM_SECTIONS).
 */
import { describe, it, expect } from "vitest";
import {
  ARTIST_FORM_SECTIONS,
  allArtistFormFields,
  artistToExportRowFromForm,
  parseArtistImportRow,
  formValuesToArtistPayload,
} from "@/modules/artist/forms/artist-form.definition";
import type { Artist } from "@/modules/artist/types/artist.types";

const ARTIST: Artist = {
  id: "a1",
  stageName: "MC Teste",
  fullName: "Fulano de Tal",
  musicGenre: "Funk",
  gender: "male",
  specialties: ["dj", "producer"],
  notes: "Bio do artista",
  internalNotes: "Nota interna",
  photoUrl: "https://cdn/x/foto.png",
  personalDocumentsUrl: "https://cdn/x/doc.pdf",
  pressKitUrl: "https://cdn/x/press.pdf",
  birthDate: "1990-01-01",
  taxId: "123.456.789-00",
  idDocument: "12.345.678-9",
  address: "Rua A, 1",
  phone: "(11) 90000-0000",
  email: "mc@teste.com",
  bankName: "Nubank",
  bankBranch: "0001",
  bankAccount: "12345-6",
  pixKey: "mc@teste.com",
  accountHolder: "Fulano de Tal",
  spotifyUrl: "https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ",
  youtubeUrl: "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
  deezerUrl: "https://deezer.com/artist/1",
  appleMusicUrl: "https://music.apple.com/artist/1",
  soundcloudUrl: "https://soundcloud.com/mc",
  instagramUrl: "https://instagram.com/mc",
  tiktokUrl: "https://tiktok.com/@mc",
  profileType: "managed",
  generalDistributors: [{ id: "onerpm", email: "share@onerpm.com" }],
  linkedContacts: [{ contactId: "c-1", distributors: [{ id: "distrokid", email: "d@k.com" }] }],
};

describe("single source of truth for the artist form definition", () => {
  it("exports exactly one column per form field, in visual order", () => {
    const row = artistToExportRowFromForm(ARTIST);
    const formLabels = allArtistFormFields().map((f) => f.label);
    expect(Object.keys(row)).toEqual(formLabels);
  });

  it("walks the sections in form order", () => {
    expect(ARTIST_FORM_SECTIONS.map((s) => s.title)).toEqual([
      "Informações Básicas",
      "Dados Pessoais",
      "Dados Bancários",
      "Perfis e Redes Sociais",
      "Tipo de Perfil",
      "Distribuidoras / Agregadoras",
      "Observações",
    ]);
  });

  it("round-trips export → import → payload without losing form data", () => {
    const row = artistToExportRowFromForm(ARTIST);
    const values = parseArtistImportRow(row);
    expect(values).not.toBeNull();
    const payload = formValuesToArtistPayload(values!);

    expect(payload.stageName).toBe("MC Teste");
    expect(payload.fullName).toBe("Fulano de Tal");
    expect(payload.musicGenre).toBe("Funk");
    expect(payload.gender).toBe("male");
    expect(payload.specialties).toEqual(["dj", "producer"]);
    expect(payload.notes).toBe("Bio do artista");
    expect(payload.internalNotes).toBe("Nota interna");
    expect(payload.photoUrl).toBe("https://cdn/x/foto.png");
    expect(payload.personalDocumentsUrl).toBe("https://cdn/x/doc.pdf");
    expect(payload.pressKitUrl).toBe("https://cdn/x/press.pdf");
    // The form URL is persisted directly — the backend contract uses
    // spotify_url/youtube_url, never an extracted ID.
    expect(payload.spotifyUrl).toBe("https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ");
    expect(payload.youtubeUrl).toBe("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv");
    expect(payload.deezerUrl).toBe("https://deezer.com/artist/1");
    expect(payload.instagramUrl).toBe("https://instagram.com/mc");
    expect(payload.tiktokUrl).toBe("https://tiktok.com/@mc");
    expect(payload.profileType).toBe("managed");
    expect(payload.generalDistributors).toEqual([{ id: "onerpm", email: "share@onerpm.com" }]);
    expect(payload.linkedContacts).toEqual([
      { contactId: "c-1", distributors: [{ id: "distrokid", email: "d@k.com" }] },
    ]);
    expect(payload.bankName).toBe("Nubank");
    expect(payload.pixKey).toBe("mc@teste.com");
  });

  it("rejects a row without 'Nome Artístico'", () => {
    expect(parseArtistImportRow({ "Gênero Musical": "Funk" })).toBeNull();
  });

  it("accepts headers from spreadsheets exported by older versions", () => {
    const values = parseArtistImportRow({
      "Nome Artístico": "Antigo",
      "Foto URL": "https://cdn/old.png",
      "Spotify URL": "https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ",
      "Observações": "nota antiga",
      "Tipo de Perfil": "Com_Empresario",
    });
    expect(values).not.toBeNull();
    expect(values!.photoUrl).toBe("https://cdn/old.png");
    expect(values!.spotify).toContain("open.spotify.com/artist/");
    expect(values!.internalNotes).toBe("nota antiga");
    // Pre-CZ-042 spreadsheet value → canonical enum value.
    expect(values!.profileType).toBe("managed");
  });

  it("exports PT-BR labels (never raw enum values) for enum-valued fields", () => {
    const row = artistToExportRowFromForm(ARTIST);
    expect(row["Perfil Comercial"]).toBe("Com empresário");
    expect(row["Gênero"]).toBe("Masculino");
    expect(row["Especialidade / Função"]).toBe("DJ, Produtor");
    for (const raw of ["managed", "male", "producer"]) {
      expect(Object.values(row)).not.toContain(raw);
    }
  });

  it("imports PT-BR labels and pre-CZ-042 values into canonical option values", () => {
    const values = parseArtistImportRow({
      "Nome Artístico": "X",
      "Perfil Comercial": "Com gravadora",
      "Gênero": "Feminino",
      "Especialidade / Função": "Intérprete, compositor_autor, dj_produtor",
    });
    expect(values!.profileType).toBe("record_label");
    expect(values!.gender).toBe("female");
    expect(values!.specialties).toEqual(["performer", "songwriter", "dj_producer"]);
  });

  it("profile-type and gender options use canonical values with PT-BR labels", () => {
    const fields = allArtistFormFields();
    const profile = fields.find((f) => f.id === "profileType")!;
    expect(profile.options).toEqual([
      { value: "independent", label: "Independente" },
      { value: "managed", label: "Com empresário" },
      { value: "record_label", label: "Com gravadora" },
      { value: "publisher", label: "Com editora" },
    ]);
    const gender = fields.find((f) => f.id === "gender")!;
    expect(gender.options).toEqual([
      { value: "male", label: "Masculino" },
      { value: "female", label: "Feminino" },
    ]);
    const specialties = fields.find((f) => f.id === "specialties")!;
    expect(specialties.checkOptions?.map((o) => o.value)).toEqual([
      "dj", "dj_producer", "songwriter", "performer", "producer",
    ]);
  });
});
