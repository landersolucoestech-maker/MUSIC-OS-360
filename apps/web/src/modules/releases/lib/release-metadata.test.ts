import { describe, expect, it } from "vitest";
import { canonicalReleaseMetadata, canonicalReleaseTrack } from "./release-metadata";

describe("canonicalReleaseMetadata (dual-read of releases.metadata)", () => {
  it("renames legacy keys at every level and preserves everything else", () => {
    const legacy = {
      automation: { done: 1 },
      variosArtistas: true,
      generoSecundario: "Samba",
      copyrightDataLancamento: "2024",
      copyrightDataGravacao: "2023",
      artistasAdicionaisAlbum: [{ nome: "F", role: "Featuring" }],
      faixas: [{
        title: "Letra", artista: "X", isVersionAlternativa: true, tipoVersao: "live",
        artistasAdicionais: [{ nome: "A", role: "DJ" }], produtores: [{ nome: "P", role: "Producer" }],
        compositores: ["c"], musicos: [{ nome: "M", instrumento: "guitar" }], idioma: "pt-br", letra: "olá",
      }],
    };
    expect(canonicalReleaseMetadata(legacy)).toEqual({
      automation: { done: 1 },
      variousArtists: true,
      secondaryGenre: "Samba",
      copyrightReleaseYear: "2024",
      copyrightRecordingYear: "2023",
      additionalAlbumArtists: [{ name: "F", role: "Featuring" }],
      tracks: [{
        title: "Letra", artist: "X", isAlternateVersion: true, versionType: "live",
        additionalArtists: [{ name: "A", role: "DJ" }], producers: [{ name: "P", role: "Producer" }],
        composers: ["c"], musicians: [{ name: "M", instrument: "guitar" }], language: "pt-br", lyrics: "olá",
      }],
    });
  });

  it("is idempotent and canonical wins when both spellings exist", () => {
    const once = canonicalReleaseMetadata({ variosArtistas: true, variousArtists: false, faixas: [{ title: "a" }], tracks: [{ title: "b" }] });
    expect(once).toEqual({ variousArtists: false, tracks: [{ title: "b" }] });
    expect(canonicalReleaseMetadata(once)).toEqual(once);
  });

  it("reads the old snake_case genero_secundario and tolerates garbage", () => {
    expect(canonicalReleaseMetadata({ genero_secundario: "Rock" })).toMatchObject({ secondaryGenre: "Rock" });
    expect(canonicalReleaseMetadata(null)).toEqual({});
    expect(canonicalReleaseMetadata({ faixas: "x" })).toEqual({ tracks: "x" });
    expect(canonicalReleaseTrack(3)).toBe(3);
  });

  it("never renames user content (values) and does not mutate the input", () => {
    const input = { faixas: [{ title: "faixas", letra: "nome: compositores" }] };
    const copy = JSON.parse(JSON.stringify(input));
    expect(canonicalReleaseMetadata(input)).toEqual({ tracks: [{ title: "faixas", lyrics: "nome: compositores" }] });
    expect(input).toEqual(copy);
  });
});
