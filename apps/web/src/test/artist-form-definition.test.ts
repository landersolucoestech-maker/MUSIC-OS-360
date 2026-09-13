/**
 * Critério de aceite do fluxo de exportação de artistas:
 * o arquivo exportado deve ter EXATAMENTE uma coluna por campo do
 * formulário Criar, com o mesmo label e na mesma ordem visual —
 * ambos derivados da definição única (ARTIST_FORM_SECTIONS).
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

const ARTISTA: Artist & { genero?: string } = {
  id: "a1",
  stageName: "MC Teste",
  legalName: "Fulano de Tal",
  musicGenre: "Funk",
  genero: "Masculino",
  specialties: ["dj", "produtor"],
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
  bank: "Nubank",
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
  profileType: "com_empresario",
  generalDistributors: [{ id: "onerpm", email: "share@onerpm.com" }],
  linkedContacts: [{ contactId: "c-1", distributors: [{ id: "distrokid", email: "d@k.com" }] }],
};

describe("definição única do formulário de artista", () => {
  it("exporta exatamente uma coluna por campo do formulário, na ordem visual", () => {
    const row = artistToExportRowFromForm(ARTISTA);
    const labelsDoFormulario = allArtistFormFields().map((f) => f.label);
    expect(Object.keys(row)).toEqual(labelsDoFormulario);
  });

  it("percorre as seções na sequência do formulário", () => {
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

  it("faz round-trip export → import → payload sem perder dados do formulário", () => {
    const row = artistToExportRowFromForm(ARTISTA);
    const values = parseArtistImportRow(row);
    expect(values).not.toBeNull();
    const payload = formValuesToArtistPayload(values!);

    expect(payload.stageName).toBe("MC Teste");
    expect(payload.legalName).toBe("Fulano de Tal");
    expect(payload.musicGenre).toBe("Funk");
    expect((payload as unknown as Record<string, unknown>).genero).toBe("Masculino");
    expect(payload.specialties).toEqual(["dj", "produtor"]);
    expect(payload.notes).toBe("Bio do artista");
    expect(payload.internalNotes).toBe("Nota interna");
    expect(payload.photoUrl).toBe("https://cdn/x/foto.png");
    expect(payload.personalDocumentsUrl).toBe("https://cdn/x/doc.pdf");
    expect(payload.pressKitUrl).toBe("https://cdn/x/press.pdf");
    // URL do formulário é persistida diretamente — contrato do backend usa
    // spotify_url/youtube_url, nunca um ID extraído.
    expect(payload.spotifyUrl).toBe("https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ");
    expect(payload.youtubeUrl).toBe("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv");
    expect(payload.deezerUrl).toBe("https://deezer.com/artist/1");
    expect(payload.instagramUrl).toBe("https://instagram.com/mc");
    expect(payload.tiktokUrl).toBe("https://tiktok.com/@mc");
    expect(payload.profileType).toBe("com_empresario");
    expect(payload.generalDistributors).toEqual([{ id: "onerpm", email: "share@onerpm.com" }]);
    expect(payload.linkedContacts).toEqual([
      { contactId: "c-1", distributors: [{ id: "distrokid", email: "d@k.com" }] },
    ]);
    expect(payload.bank).toBe("Nubank");
    expect(payload.pixKey).toBe("mc@teste.com");
  });

  it("rejeita linha sem Nome Artístico", () => {
    expect(parseArtistImportRow({ "Gênero Musical": "Funk" })).toBeNull();
  });

  it("aceita cabeçalhos de planilhas exportadas por versões antigas", () => {
    const values = parseArtistImportRow({
      "Nome Artístico": "Antigo",
      "Foto URL": "https://cdn/old.png",
      "Spotify URL": "https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ",
      "Observações": "nota antiga",
      "Tipo de Perfil": "Com_Empresario",
    });
    expect(values).not.toBeNull();
    expect(values!.fotoUrl).toBe("https://cdn/old.png");
    expect(values!.spotify).toContain("open.spotify.com/artist/");
    expect(values!.notasInternas).toBe("nota antiga");
    expect(values!.tipoPerfil).toBe("com_empresario");
  });
});
