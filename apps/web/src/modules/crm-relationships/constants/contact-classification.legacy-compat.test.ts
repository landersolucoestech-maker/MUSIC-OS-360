import { describe, expect, it } from "vitest";
import {
  CONTACT_PROFILES,
  DEFAULT_CONTACT_PROFILE,
  LEGACY_CONTACT_PROFILES,
  UNKNOWN_PROFILE_LABEL,
  canonicalContactProfile,
  ensureProfileOption,
  profileLabel,
} from "./contact-classification";

// [deprecated persisted profile slug, canonical profile value] (migration 20260930000012)
const LEGACY_PROFILES: ReadonlyArray<readonly [string, string]> = [
  ["a_e_r", "a_and_r"],
  ["advogado", "lawyer"],
  ["agencia", "agency"],
  ["agencia_de_booking", "booking_agency"],
  ["agencia_de_modelos", "model_agency"],
  ["agencia_de_publicidade", "advertising_agency"],
  ["artista_banda", "artist_or_band"],
  ["banco", "bank"],
  ["cartorio", "notary_office"],
  ["coach_vocal", "vocal_coach"],
  ["compositor", "composer"],
  ["construtora", "construction_company"],
  ["contador", "accountant"],
  ["contratante_show", "show_booker"],
  ["curador_musical", "music_curator"],
  ["diretor", "director"],
  ["diretor_de_video", "video_director"],
  ["distribuidora_digital", "digital_distributor"],
  ["editor_de_video", "video_editor"],
  ["empresa", "company"],
  ["empresa_de_ia", "ai_company"],
  ["empresa_de_internet", "internet_company"],
  ["empresa_de_som", "sound_company"],
  ["empresario_artistico", "artist_manager"],
  ["engenheiro_de_som", "sound_engineer"],
  ["estudio", "studio"],
  ["fotografo", "photographer"],
  ["fundo_de_investimento", "investment_fund"],
  ["gateway_de_pagamento", "payment_gateway"],
  ["gravadora_selo", "record_label"],
  ["influenciador", "influencer"],
  ["investidor", "investor"],
  ["jornalista", "journalist"],
  ["marca", "brand"],
  ["masterizador", "mastering_engineer"],
  ["oficina_mecanica", "auto_repair_shop"],
  ["operador_de_camera", "camera_operator"],
  ["outros", "other"],
  ["parceiro_comercial", "business_partner"],
  ["parceiros", "partner"],
  ["patrocinador", "sponsor"],
  ["plataforma_digital", "digital_platform"],
  ["prefeitura", "city_hall"],
  ["produtor_executivo", "executive_producer"],
  ["produtor_musical", "music_producer"],
  ["produtora_audiovisual", "audiovisual_production_company"],
  ["produtora_de_eventos", "event_producer"],
  ["programador", "developer"],
  ["psicologo", "psychologist"],
  ["sala_de_ensaio", "rehearsal_room"],
];

const CATALOG_VALUES = new Set(
  Object.values(CONTACT_PROFILES).flatMap((byCategory) => Object.values(byCategory).flatMap((options) => options.map((o) => o.value))),
);

describe("contact profile legacy read-compat (legacy in, canonical out)", () => {
  it.each(LEGACY_PROFILES)("reads %s as %s", (legacy, canonical) => {
    expect(canonicalContactProfile(legacy)).toBe(canonical);
    expect(canonicalContactProfile(`  ${legacy.toUpperCase()} `)).toBe(canonical);
    // the canonical value is a real catalog option and its label is shown, never the raw legacy slug
    expect(CATALOG_VALUES.has(canonical)).toBe(true);
    expect(profileLabel(legacy)).toBe(profileLabel(canonical));
    expect(profileLabel(legacy)).not.toBe(UNKNOWN_PROFILE_LABEL);
    // an edit of a legacy-profiled row offers the canonical option, not the legacy slug
    const options = ensureProfileOption([], legacy);
    expect(options.map((o) => o.value)).toEqual([canonical]);
  });

  it("the alias map covers exactly the legacy slugs listed here and never targets a legacy slug", () => {
    expect(Object.keys(LEGACY_CONTACT_PROFILES).sort()).toEqual(LEGACY_PROFILES.map(([legacy]) => legacy).sort());
    for (const canonical of Object.values(LEGACY_CONTACT_PROFILES)) expect(CATALOG_VALUES.has(canonical)).toBe(true);
    for (const legacy of Object.keys(LEGACY_CONTACT_PROFILES)) {
      if (legacy !== canonicalContactProfile(legacy)) expect(CATALOG_VALUES.has(legacy)).toBe(false);
    }
  });

  it("does not guess: unknown values are kept and the default profile is the canonical id", () => {
    expect(canonicalContactProfile("perfil_desconhecido")).toBe("perfil_desconhecido");
    expect(profileLabel("perfil_desconhecido")).toBe(UNKNOWN_PROFILE_LABEL);
    expect(DEFAULT_CONTACT_PROFILE).toBe("other");
  });
});
