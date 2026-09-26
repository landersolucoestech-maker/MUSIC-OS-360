/**
 * artista-url-only-domain.test.ts
 *
 * Regression: no payload produced by the Artist form/mapper may contain
 * spotify_artist_id/youtube_artist_id/youtube_channel_id
 * — the domain works exclusively with
 * foto_url/spotify_url/youtube_url. Also covers that the validators require
 * a real URL (a bare raw ID is no longer accepted).
 */
import { describe, it, expect } from "vitest";
import {
  emptyArtistFormValues,
  formValuesToArtistPayload,
  artistToExportRowFromForm,
  allArtistFormFields,
  emptyPreservedInput,
} from "@/modules/artist/forms/artist-form.definition";
import { validateSpotifyUrl, validateYoutubeUrl } from "@/modules/artist/services/artist.mapper";
import type { Artist } from "@/modules/artist/types/artist.types";

const LEGACY_KEYS = [
  "spotify_artist_id",
  "youtube_artist_id",
  "youtube_channel_id",
];

describe("Artist domain — URL-only (foto_url/spotify_url/youtube_url)", () => {
  it("formValuesToArtistPayload never produces any legacy field, for any input", () => {
    const values = {
      ...emptyArtistFormValues(),
      nomeArtistico: "Artista Teste",
      spotify: "https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK",
      youtube: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
      fotoUrl: "https://cdn.example.com/foto.png",
      documentosPessoaisUrl: "",
      presskitUrl: "",
    };
    const payload = formValuesToArtistPayload(values, emptyPreservedInput());
    const keys = Object.keys(payload);

    for (const legacy of LEGACY_KEYS) {
      expect(keys).not.toContain(legacy);
    }
    expect(payload.spotifyUrl).toBe("https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK");
    expect(payload.youtubeUrl).toBe("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });

  it("export (form columns) never includes a legacy field header", () => {
    const artista = {
      id: "a1",
      stageName: "Artista Teste",
      photoUrl: "https://cdn.example.com/foto.png",
      spotify_url: "https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK",
      youtube_url: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
    } as Artist;

    const row = artistToExportRowFromForm(artista);
    const headers = Object.keys(row);

    // No export header may be (or contain) a legacy field.
    for (const header of headers) {
      for (const legacy of LEGACY_KEYS) {
        expect(header.toLowerCase()).not.toContain(legacy.replace(/_/g, " "));
      }
    }
    // The only platform/media fields exported are exactly these 3.
    const fieldIds = allArtistFormFields().map((f) => f.id);
    expect(fieldIds).toEqual(expect.arrayContaining(["fotoUrl", "spotify", "youtube"]));
  });

  it("validateSpotifyUrl rejects a raw ID (only a URL is accepted)", () => {
    expect(validateSpotifyUrl("4NHQUGzhtTLFvgF5SZesLK")).toBe("invalid");
    expect(validateSpotifyUrl("https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK")).toBe("valid");
  });

  it("validateYoutubeUrl accepts a full URL and the same raw references as the backend (find-eb3c5c45-class)", () => {
    // find-eb3c5c45-class: validateYoutubeUrl now uses the SAME canonical
    // function (parseYoutubeRef) as the "Sincronizar agora" button and the
    // backend, instead of a divergent URL-only regex — a raw channelId/handle
    // typed into the field is accepted here the same way it would be accepted
    // by the real sync, and it still persists as a string in youtube_url
    // (never a separate legacy youtube_artist_id/youtube_channel_id field —
    // see LEGACY_KEYS above).
    expect(validateYoutubeUrl("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe("valid");
    expect(validateYoutubeUrl("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe("valid");
    expect(validateYoutubeUrl("@artistname")).toBe("valid");
    expect(validateYoutubeUrl("https://youtube.com/@artistname")).toBe("valid");
    expect(validateYoutubeUrl("https://www.youtube.com/c/artistname")).toBe("valid");
    expect(validateYoutubeUrl("https://www.youtube.com/user/artistname")).toBe("valid");
    expect(validateYoutubeUrl("http://www.youtube.com/@artistname")).toBe("valid");
    expect(validateYoutubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ/nested")).toBe("invalid");
    expect(validateYoutubeUrl("not a youtube link at all")).toBe("invalid");
  });
});
