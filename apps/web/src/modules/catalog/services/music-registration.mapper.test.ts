/**
 * music-registration.mapper.test.ts
 *
 * Permanent guard of the works request contract (CZ-039 — canonical English):
 * formToWorkPayload sends ONLY the canonical fields/values of the works API
 * and never a Portuguese field name, nested key or enum value.
 *   - `ecad_code` and `society_code` are two distinct columns (ECAD is a
 *     central, mandatory entity, not fungible with the society code).
 *   - `composer_name` (singular) and `publisher_name` are bulk/imported
 *     fields — the interactive form NEVER sends them; the real authorship
 *     source is `participants`, from which `composer_names`/`translator_names`
 *     are derived.
 *   - `metadata` and the tenant (org_id) are never sent by the form.
 */
import { describe, it, expect } from "vitest";
import { toLanguageSlug } from "@/constants/languages";
import {
  formToWorkPayload,
  participantsToComposerAndTranslatorNames,
  projectToWorkSeed,
  workToFormFields,
  workToParticipants,
  type ParticipantForm,
  type WorkFormInput,
} from "./music-registration.mapper";

function baseInput(overrides: Partial<WorkFormInput> = {}): WorkFormInput {
  return {
    title: "Minha Obra",
    musicGenre: "mpb",
    language: "pt",
    iswc: "",
    ecadCode: "ECAD-456",
    societyCode: "ABR-123",
    durationMinutes: "3",
    durationSeconds: "30",
    isInstrumental: false,
    aiUsed: false,
    aiUsageLevel: "",
    aiHarmony: { tool: "", prompt: "" },
    aiMelody: { tool: "", prompt: "" },
    aiLyrics: { tool: "", prompt: "" },
    alternativeTitles: [],
    relatedReferences: [],
    lyrics: "",
    participants: [],
    status: "under_review",
    projectId: null,
    artistId: null,
    workOrigin: "original",
    ...overrides,
  };
}

/** Every request field of the CZ-039 works contract the form owns. */
const CANONICAL_PAYLOAD_KEYS = [
  "ai_harmony",
  "ai_lyrics",
  "ai_melody",
  "ai_usage_level",
  "ai_used",
  "alternative_titles",
  "artist_id",
  "composer_names",
  "duration_text",
  "ecad_code",
  "is_instrumental",
  "iswc",
  "language",
  "lyrics",
  "music_genre",
  "participants",
  "project_id",
  "related_references",
  "society_code",
  "status",
  "title",
  "translator_names",
  "work_origin",
];

/** Pre-CZ-039 Portuguese names (fields and nested keys) that must never be sent again. */
const LEGACY_PORTUGUESE_KEYS = [
  "compositor",
  "compositores",
  "letristas",
  "editora",
  "cod_ecad",
  "cod_entidade",
  "cod_abramus",
  "idioma",
  "instrumental",
  "criada_por_ia",
  "tipo_ia",
  "ia_harmonia",
  "ia_melodia",
  "ia_letra",
  "outros_titulos",
  "referencias_conexas",
  "letra_completa",
  "participantes",
  "tipo_obra",
  "ferramenta",
  "classeFuncao",
  "percentual",
];

/** Collects every object key of a JSON-like value, at any depth. */
function allKeysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => allKeysDeep(item, out));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      out.add(key);
      allKeysDeep(nested, out);
    }
  }
  return out;
}

const fullParticipants: ParticipantForm[] = [
  { id: "1", name: "Fulano", role: "composer_author", link: "", percentage: "50" },
  { id: "2", name: "Beltrano", role: "translator", link: "https://x.test", percentage: "30" },
  { id: "3", name: "Editora X", role: "publisher", link: "", percentage: "10" },
  { id: "4", name: "Adm Y", role: "administrator", link: "", percentage: "10" },
  { id: "5", name: "Sem Papel", role: "unspecified", link: "", percentage: "" },
];

function fullyFilledInput(): WorkFormInput {
  return baseInput({
    isInstrumental: true,
    aiUsed: true,
    aiUsageLevel: "partial",
    aiHarmony: { tool: "Suno", prompt: "chords" },
    aiMelody: { tool: "Udio", prompt: "" },
    aiLyrics: { tool: "", prompt: "rhyme" },
    alternativeTitles: ["Outro Nome"],
    relatedReferences: ["https://ref.test"],
    lyrics: "La la la",
    participants: fullParticipants,
    projectId: "123e4567-e89b-12d3-a456-426614174000",
    workOrigin: "reference",
  });
}

describe("formToWorkPayload — canonical works contract (CZ-039)", () => {
  it("sends exactly the canonical keys — no Portuguese field or nested key, no org_id/metadata", () => {
    const payload = formToWorkPayload(fullyFilledInput());
    expect(Object.keys(payload).sort()).toEqual([...CANONICAL_PAYLOAD_KEYS].sort());

    const keys = allKeysDeep(payload);
    for (const legacy of LEGACY_PORTUGUESE_KEYS) {
      expect(keys.has(legacy), `payload must not contain "${legacy}"`).toBe(false);
    }
    for (const forbidden of ["org_id", "orgId", "metadata", "composer_name", "publisher_name"]) {
      expect(keys.has(forbidden), `payload must not contain "${forbidden}"`).toBe(false);
    }
  });

  it("sends canonical values: ISO language code, booleans, ai level full/partial, {tool,prompt} AI elements", () => {
    const payload = formToWorkPayload(fullyFilledInput());
    expect(payload.language).toBe("pt");
    expect(payload.is_instrumental).toBe(true);
    expect(payload.ai_used).toBe(true);
    expect(payload.ai_usage_level).toBe("partial");
    expect(payload.ai_harmony).toEqual({ tool: "Suno", prompt: "chords" });
    expect(payload.ai_melody).toEqual({ tool: "Udio", prompt: "" });
    expect(payload.ai_lyrics).toEqual({ tool: "", prompt: "rhyme" });
    expect(payload.alternative_titles).toEqual(["Outro Nome"]);
    expect(payload.related_references).toEqual(["https://ref.test"]);
    expect(payload.lyrics).toBe("La la la");
    expect(payload.duration_text).toBe("03:30");
    expect(payload.status).toBe("under_review");
    expect(payload.work_origin).toBe("reference");

    const serialized = JSON.stringify(payload);
    for (const legacyValue of ["sim", "nao", "totalmente", "parcialmente", "autoral", "referencia", "compositor/autor", "tradutor", "administrador", "Português"]) {
      expect(serialized).not.toContain(`"${legacyValue}"`);
    }
  });

  it("sends booleans false (never 'nao') and nulls for empty optional fields", () => {
    const payload = formToWorkPayload(baseInput({ language: "", ecadCode: "", societyCode: "" }));
    expect(payload.is_instrumental).toBe(false);
    expect(payload.ai_used).toBe(false);
    expect(payload.ai_usage_level).toBeNull();
    expect(payload.ai_harmony).toBeNull();
    expect(payload.ai_melody).toBeNull();
    expect(payload.ai_lyrics).toBeNull();
    expect(payload.language).toBeNull();
    expect(payload.ecad_code).toBeNull();
    expect(payload.society_code).toBeNull();
    expect(payload.alternative_titles).toBeNull();
    expect(payload.related_references).toBeNull();
    expect(payload.lyrics).toBeNull();
    expect(payload.composer_names).toBeNull();
    expect(payload.translator_names).toBeNull();
  });

  it("sends `ecad_code` and `society_code` as two distinct fields", () => {
    const payload = formToWorkPayload(baseInput());
    expect(payload).toHaveProperty("ecad_code", "ECAD-456");
    expect(payload).toHaveProperty("society_code", "ABR-123");
  });

  it("sends participants as {id, name, role, link, percentage} with canonical roles only", () => {
    const payload = formToWorkPayload(fullyFilledInput());
    expect(payload.participants).toEqual([
      { id: "1", name: "Fulano", role: "composer_author", link: null, percentage: "50" },
      { id: "2", name: "Beltrano", role: "translator", link: "https://x.test", percentage: "30" },
      { id: "3", name: "Editora X", role: "publisher", link: null, percentage: "10" },
      { id: "4", name: "Adm Y", role: "administrator", link: null, percentage: "10" },
      { id: "5", name: "Sem Papel", role: "unspecified", link: null, percentage: null },
    ]);
    for (const participant of payload.participants) {
      expect(Object.keys(participant).sort()).toEqual(["id", "link", "name", "percentage", "role"]);
    }
  });

  it("sends a participant row without a picked role as 'unspecified' and drops form-only keys (artist_id)", () => {
    const row = { id: "9", name: "Novo", role: "", link: "", percentage: "", artist_id: "art-1" };
    const payload = formToWorkPayload(baseInput({ participants: [row] }));
    expect(payload.participants).toEqual([
      { id: "9", name: "Novo", role: "unspecified", link: null, percentage: null },
    ]);
  });

  it("always sends the full participant list — an empty list clears them (never null)", () => {
    expect(formToWorkPayload(baseInput({ participants: [] })).participants).toEqual([]);
  });

  it("derives `composer_names`/`translator_names` from the participants — never duplicates free data", () => {
    const payload = formToWorkPayload(fullyFilledInput());
    expect(payload.composer_names).toEqual(["Fulano"]);
    expect(payload.translator_names).toEqual(["Beltrano"]);
  });

  it("defaults an unset status to 'pending' (the column default)", () => {
    expect(formToWorkPayload(baseInput({ status: "" })).status).toBe("pending");
  });

  it("participantsToComposerAndTranslatorNames returns null when no participant has the matching role", () => {
    const result = participantsToComposerAndTranslatorNames([]);
    expect(result.composerNames).toBeNull();
    expect(result.translatorNames).toBeNull();
  });
});

describe("work readers — canonical response fields only (CZ-039)", () => {
  it("never reads the removed Portuguese response fields (no permanent alias)", () => {
    const legacyOnly = {
      participantes: [{ id: "1", name: "Dan", classeFuncao: "editor", link: "", percentual: "" }],
      compositores: ["Alice"],
      letristas: ["Carol"],
      idioma: "Português",
      instrumental: "sim",
      criada_por_ia: true,
      tipo_ia: "totalmente",
      ia_harmonia: { ferramenta: "Suno", prompt: "p" },
      outros_titulos: ["Alt"],
      referencias_conexas: ["Ref"],
      letra_completa: "Letra",
      cod_ecad: "E-1",
      cod_entidade: "S-1",
    } as unknown as Parameters<typeof workToFormFields>[0];
    expect(workToParticipants(legacyOnly)).toEqual([]);
    expect(workToFormFields(legacyOnly)).toMatchObject({
      language: "",
      isInstrumental: false,
      aiUsed: false,
      aiUsageLevel: "",
      aiHarmony: { tool: "", prompt: "" },
      alternativeTitles: [],
      relatedReferences: [],
      lyrics: "",
      ecadCode: "",
      societyCode: "",
      participants: [],
    });
  });

  it("ignores the pre-CZ-039 ai_usage_level values", () => {
    expect(workToFormFields({ ai_usage_level: "totalmente" as never }).aiUsageLevel).toBe("");
    expect(workToFormFields({ ai_usage_level: "parcialmente" as never }).aiUsageLevel).toBe("");
  });
});

describe("projectToWorkSeed (project track → canonical work seed)", () => {
  it("maps the track into canonical work fields only (ISO language, boolean instrumental, composer_author participants)", () => {
    const seed = projectToWorkSeed(
      { id: "proj-1", title: "Projeto", artist_id: "art-1", music_genre: "Rock" },
      {
        name: "Faixa 1",
        // projects persist the constants/languages slug and "sim"/"nao" for instrumental
        language: toLanguageSlug("Português"),
        durationMinutes: "3",
        durationSeconds: "5",
        instrumental: "sim",
        composers: ["Alice", " "],
        lyrics: "Letra da faixa",
      },
    );
    expect(Object.keys(seed).sort()).toEqual([
      "artist_id", "duration_text", "is_instrumental", "language", "lyrics",
      "music_genre", "participants", "project_id", "title",
    ]);
    expect(seed).toMatchObject({
      project_id: "proj-1",
      artist_id: "art-1",
      title: "Faixa 1",
      music_genre: "rock",
      language: "pt",
      duration_text: "03:05",
      is_instrumental: true,
      lyrics: "Letra da faixa",
    });
    expect(seed.participants).toEqual([
      { id: expect.any(String), name: "Alice", role: "composer_author", link: null, percentage: null },
    ]);
  });

  it("leaves the language empty when the project slug is unknown (never invents a code)", () => {
    const seed = projectToWorkSeed({ id: "proj-1" }, { language: "unknown-slug", instrumental: "nao" });
    expect(seed.language).toBeNull();
    expect(seed.is_instrumental).toBe(false);
    expect(seed.participants).toBeNull();
  });

  it("feeds the form: the seed round-trips into form state", () => {
    const fields = workToFormFields(
      projectToWorkSeed({ id: "proj-1" }, { language: toLanguageSlug("Inglês"), durationMinutes: "4", durationSeconds: "0", instrumental: "sim", composers: ["Bob"] }),
    );
    expect(fields.language).toBe("en");
    expect(fields.durationMinutes).toBe("4");
    expect(fields.durationSeconds).toBe("0");
    expect(fields.isInstrumental).toBe(true);
    expect(fields.participants.map((p) => [p.name, p.role])).toEqual([["Bob", "composer_author"]]);
  });
});
