/**
 * phonogram.mapper.test.ts — CZ-040 phonogram wire contract of the web.
 *
 * The web sends and reads ONLY the canonical (English) phonogram contract of
 * apps/api/src/modules/phonograms/dto/create-phonogram.dto.ts. The API still
 * accepts the pre-CZ-040 Portuguese names as deprecated input
 * (phonogram-legacy-fields.ts); these tests prove the web never produces them
 * and never reads them back.
 */
import { describe, it, expect } from "vitest";
import {
  durationPartsToSeconds,
  durationSecondsToParts,
  formToPhonogramPayload,
  phonogramToFormFields,
  toDateInputValue,
  type PhonogramFormInput,
} from "@/modules/catalog/mappers";
import type { Phonogram } from "@/modules/catalog/types/catalog.types";

/** Every field name of CreatePhonogramDto that is NOT deprecated (dto/create-phonogram.dto.ts). */
const CANONICAL_DTO_FIELDS = new Set([
  "title", "isrc", "music_genre", "duration", "fileUrl", "status", "metadata",
  "ecad_code", "society_code", "aggregator", "isrc_country_code", "isrc_registrant_code",
  "isrc_year", "isrc_designation_code", "ai_used", "is_instrumental", "is_national",
  "is_simultaneous_publication", "issue_date", "recording_date", "release_date", "duration_text",
  "duration_seconds", "media_type", "recording_classification", "country_of_recording",
  "publication_country", "record_label_name", "notes", "work_id", "artist_id", "participation",
  "audio_file", "audio_file_id",
]);

/** PHONOGRAM_DEPRECATED_FIELDS keys + duracao_min/duracao_seg (phonogram-legacy-fields.ts). */
const LEGACY_FIELDS = [
  "gravadora", "cod_entidade", "cod_ecad", "agregadora", "isrc_pais", "isrc_registrante", "isrc_ano",
  "isrc_designacao", "criada_por_ia", "nacional", "pub_simultanea", "emissao", "midia", "classificacao",
  "pais_publicacao", "pais_origem", "participacao", "arquivo_audio", "gravacao_original",
  "data_lancamento", "duracao_min", "duracao_seg", "titulo", "workId", "artistId",
];

function baseInput(overrides: Partial<PhonogramFormInput> = {}): PhonogramFormInput {
  return {
    title: "  Noite Estrelada  ",
    status: "",
    workId: "11111111-1111-4111-8111-111111111111",
    ecadCode: "E-1",
    societyCode: "S-1",
    aggregator: "other",
    isrcCountryCode: "BR",
    isrcRegistrantCode: "ABC",
    isrcYear: "25",
    isrcDesignationCode: "12345",
    aiUsed: true,
    isInstrumental: false,
    isNational: true,
    isSimultaneousPublication: false,
    issueDate: "2026-01-31",
    recordingDate: "2025-12-01",
    releaseDate: "2026-02-10",
    durationMinutes: "4",
    durationSeconds: "20",
    musicGenre: "pop",
    mediaType: "physical",
    recordingClassification: "live",
    countryOfRecording: "BR",
    publicationCountry: "ZZ",
    recordLabelName: "Selo X",
    notes: "",
    participation: {
      phonographic_producers: [{ id: "p1", name: "Pedro", percentage: "41.7", artist_id: "22222222-2222-4222-8222-222222222222" }],
      performers: [{ id: "p2", name: "Ana", percentage: "" }],
      session_musicians: [],
    },
    audioFile: { name: "a.mp3", size: 10, url: "https://cdn/a.mp3", fileId: "33333333-3333-4333-8333-333333333333" },
    ...overrides,
  };
}

describe("formToPhonogramPayload (form state → canonical request body)", () => {
  it("sends only canonical DTO fields — never a pre-CZ-040 name", () => {
    const payload = formToPhonogramPayload(baseInput());
    for (const key of Object.keys(payload)) expect(CANONICAL_DTO_FIELDS.has(key), key).toBe(true);
    for (const legacy of LEGACY_FIELDS) expect(payload).not.toHaveProperty(legacy);
    expect(payload).not.toHaveProperty("org_id");
  });

  it("maps every form field onto its canonical key and value", () => {
    expect(formToPhonogramPayload(baseInput())).toEqual({
      title: "Noite Estrelada",
      work_id: "11111111-1111-4111-8111-111111111111",
      isrc: "BR-ABC-25-12345",
      isrc_country_code: "BR",
      isrc_registrant_code: "ABC",
      isrc_year: "25",
      isrc_designation_code: "12345",
      ecad_code: "E-1",
      society_code: "S-1",
      aggregator: "other",
      ai_used: true,
      is_instrumental: false,
      is_national: true,
      is_simultaneous_publication: false,
      issue_date: "2026-01-31",
      recording_date: "2025-12-01",
      release_date: "2026-02-10",
      duration_seconds: 260,
      duration_text: "04:20",
      music_genre: "pop",
      media_type: "physical",
      recording_classification: "live",
      country_of_recording: "BR",
      publication_country: "ZZ",
      status: "pending",
      record_label_name: "Selo X",
      notes: null,
      participation: {
        phonographic_producers: [{ id: "p1", name: "Pedro", percentage: "41.7", artist_id: "22222222-2222-4222-8222-222222222222" }],
        performers: [{ id: "p2", name: "Ana", percentage: "" }],
        session_musicians: [],
      },
      audio_file: { name: "a.mp3", size: 10, url: "https://cdn/a.mp3", fileId: "33333333-3333-4333-8333-333333333333" },
      audio_file_id: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("sends participation with the canonical category keys and item keys {id, name, percentage[, artist_id]} only", () => {
    const { participation } = formToPhonogramPayload(baseInput());
    expect(Object.keys(participation).sort()).toEqual(["performers", "phonographic_producers", "session_musicians"]);
    for (const item of [...participation.phonographic_producers, ...participation.performers]) {
      for (const key of Object.keys(item)) expect(["id", "name", "percentage", "artist_id"]).toContain(key);
      expect(item).not.toHaveProperty("percentual");
    }
    // An empty artist_id is not sent (the DTO validates it as a UUID).
    expect(participation.performers[0]).not.toHaveProperty("artist_id");
  });

  it("keeps a chosen status and sends null for empty optional fields", () => {
    const payload = formToPhonogramPayload(
      baseInput({ status: "registered", durationMinutes: "", durationSeconds: "", audioFile: null, workId: null, isrcYear: "" }),
    );
    expect(payload.status).toBe("registered");
    expect(payload.duration_seconds).toBeNull();
    expect(payload.duration_text).toBeNull();
    expect(payload.audio_file).toBeNull();
    expect(payload.audio_file_id).toBeNull();
    expect(payload.work_id).toBeNull();
    expect(payload.isrc).toBeNull();
    expect(payload.isrc_year).toBeNull();
  });
});

describe("phonogramToFormFields (canonical record → form state)", () => {
  const record: Partial<Phonogram> = {
    title: "Canção",
    status: "under_review",
    ecad_code: "E-9",
    society_code: "S-9",
    aggregator: "distrokid",
    isrc: "BRABC2512345",
    ai_used: true,
    is_instrumental: true,
    is_national: false,
    is_simultaneous_publication: true,
    issue_date: "2026-01-31",
    recording_date: "2025-12-01T00:00:00.000Z",
    release_date: "2026-02-10T00:00:00.000Z",
    duration_seconds: 125,
    music_genre: "rock",
    media_type: "streaming",
    recording_classification: "studio",
    country_of_recording: "US",
    publication_country: "ZZ",
    record_label_name: "Selo Y",
    notes: "obs",
    participation: { performers: [{ id: "i1", name: "Ana", percentage: "41.7" }] },
    audio_file: { name: "b.wav", size: 20 },
  };

  it("reads every canonical field", () => {
    expect(phonogramToFormFields(record)).toEqual({
      title: "Canção",
      status: "under_review",
      ecadCode: "E-9",
      societyCode: "S-9",
      aggregator: "distrokid",
      isrcCountryCode: "BR",
      isrcRegistrantCode: "ABC",
      isrcYear: "25",
      isrcDesignationCode: "12345",
      aiUsed: true,
      isInstrumental: true,
      isNational: false,
      isSimultaneousPublication: true,
      issueDate: "2026-01-31",
      recordingDate: "2025-12-01",
      releaseDate: "2026-02-10",
      durationMinutes: "2",
      durationSeconds: "5",
      musicGenre: "rock",
      mediaType: "streaming",
      recordingClassification: "studio",
      countryOfRecording: "US",
      publicationCountry: "ZZ",
      recordLabelName: "Selo Y",
      notes: "obs",
      participation: {
        phonographic_producers: [],
        performers: [{ id: "i1", name: "Ana", percentage: "41.7" }],
        session_musicians: [],
      },
      audioFile: { name: "b.wav", size: 20, url: undefined, fileId: undefined },
    });
  });

  it("ignores every pre-CZ-040 Portuguese field (no fallback reads)", () => {
    const legacyOnly = {
      gravadora: "G", cod_entidade: "S", cod_ecad: "E", agregadora: "distrokid", isrc_pais: "PT",
      isrc_registrante: "XYZ", isrc_ano: "24", isrc_designacao: "00001", criada_por_ia: true, nacional: true,
      pub_simultanea: true, emissao: "2026-01-01", midia: "digital", classificacao: "live",
      pais_publicacao: "brazil", pais_origem: "brazil", gravacao_original: "2025-01-01",
      data_lancamento: "2025-02-01", duracao_min: 3, duracao_seg: 30,
      participacao: { produtorFonografico: [{ id: "1", name: "X", percentual: "10" }] },
      arquivo_audio: { name: "c.mp3", size: 1 }, produtores: ["P"], instrumental: true, data_registro: "2025-01-01",
    };
    const fields = phonogramToFormFields(legacyOnly as never);
    expect(fields).toEqual(phonogramToFormFields(null));
  });

  it("the ISRC part columns win over the full `isrc`", () => {
    const fields = phonogramToFormFields({
      isrc: "BRABC2512345",
      isrc_country_code: "PT",
      isrc_registrant_code: "XYZ",
      isrc_year: "24",
      isrc_designation_code: "00001",
    });
    expect([fields.isrcCountryCode, fields.isrcRegistrantCode, fields.isrcYear, fields.isrcDesignationCode]).toEqual([
      "PT", "XYZ", "24", "00001",
    ]);
  });

  it("reads `duration_text` only when the record has no `duration_seconds`", () => {
    expect(phonogramToFormFields({ duration_text: "03:45" })).toMatchObject({ durationMinutes: "3", durationSeconds: "45" });
    expect(phonogramToFormFields({ duration_text: "03:45", duration_seconds: 61 })).toMatchObject({
      durationMinutes: "1",
      durationSeconds: "1",
    });
  });

  it("round-trips: record → form → payload keeps the canonical values", () => {
    const payload = formToPhonogramPayload({ ...phonogramToFormFields(record), workId: null });
    expect(payload).toMatchObject({
      duration_seconds: 125,
      recording_date: "2025-12-01",
      release_date: "2026-02-10",
      media_type: "streaming",
      recording_classification: "studio",
      country_of_recording: "US",
      publication_country: "ZZ",
      aggregator: "distrokid",
      status: "under_review",
      isrc: "BR-ABC-25-12345",
    });
  });
});

describe("duration: minutes/seconds inputs ↔ duration_seconds", () => {
  it("splits the total into minutes and seconds", () => {
    expect(durationSecondsToParts(260)).toEqual({ minutes: "4", seconds: "20" });
    expect(durationSecondsToParts(59)).toEqual({ minutes: "0", seconds: "59" });
    expect(durationSecondsToParts(3600)).toEqual({ minutes: "60", seconds: "0" });
    expect(durationSecondsToParts(0)).toEqual({ minutes: "0", seconds: "0" });
  });
  it("yields empty inputs for an absent or invalid total", () => {
    for (const value of [null, undefined, -1, 1.5, "260"]) {
      expect(durationSecondsToParts(value)).toEqual({ minutes: "", seconds: "" });
    }
  });
  it("joins the inputs into the total", () => {
    expect(durationPartsToSeconds("4", "20")).toBe(260);
    expect(durationPartsToSeconds("", "45")).toBe(45);
    expect(durationPartsToSeconds("2", "")).toBe(120);
    expect(durationPartsToSeconds("", "")).toBeNull();
    expect(durationPartsToSeconds("-1", "0")).toBeNull();
    expect(durationPartsToSeconds("a", "1")).toBeNull();
  });
  it("round-trips every total", () => {
    for (const total of [0, 1, 59, 60, 61, 260, 3599, 7322]) {
      const { minutes, seconds } = durationSecondsToParts(total);
      expect(durationPartsToSeconds(minutes, seconds)).toBe(total);
    }
  });
});

describe("toDateInputValue", () => {
  it("keeps the date part of a date or timestamp", () => {
    expect(toDateInputValue("2026-01-31")).toBe("2026-01-31");
    expect(toDateInputValue("2025-12-01T00:00:00.000Z")).toBe("2025-12-01");
  });
  it("returns empty for absent or non-date values", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("31/01/2026")).toBe("");
  });
});
