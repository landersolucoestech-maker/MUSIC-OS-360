import { describe, it, expect } from "vitest";
import {
  LEGACY_OPERATIONAL_SLUGS,
  canonicalOperationalKind,
  canonicalAllowedServiceSlugs,
  canonicalOperationalSlug,
  legacyOperationalSlugs,
  migrateLegacyDefaultItem,
} from "./operational-vocabulary";
import { DEFAULT_OPERATIONAL_LISTS } from "@/modules/settings/hooks/useOperationalSettings";

describe("operational vocabulary (legacy reader)", () => {
  it("every legacy slug maps to an existing default of the same kind, and is never itself canonical", () => {
    for (const [kind, map] of Object.entries(LEGACY_OPERATIONAL_SLUGS)) {
      const canonical = DEFAULT_OPERATIONAL_LISTS.filter((d) => d.kind === kind).map((d) => d.slug);
      for (const [legacy, target] of Object.entries(map)) {
        expect(canonical).toContain(target);
        expect(canonical).not.toContain(legacy);
      }
    }
  });

  it("maps legacy slugs, keeps canonical and tenant slugs, and maps the marketing kinds (AP3)", () => {
    expect(canonicalOperationalSlug("lead_status", "novo_lead")).toBe("new");
    expect(canonicalOperationalSlug("lead_status", "new")).toBe("new");
    expect(canonicalOperationalSlug("lead_type", "custom_slug")).toBe("custom_slug");
    expect(canonicalOperationalSlug("marketing_sector", "Comunicação")).toBe("communication");
    expect(canonicalOperationalSlug("marketing_context", "projeto_musical")).toBe("music_project");
    expect(canonicalOperationalSlug("briefing_service_type", "conteudo")).toBe("content");
    expect(legacyOperationalSlugs("event_type", "meetings")).toEqual(["reunioes"]);
  });

  it("migrates only an EXACT (kind, slug, name) legacy default", () => {
    const exact = { kind: "event_type", slug: "reunioes", name: "Reuniões" };
    expect(migrateLegacyDefaultItem(exact, DEFAULT_OPERATIONAL_LISTS).slug).toBe("meetings");
    const renamed = { kind: "event_type", slug: "reunioes", name: "Reunião de pauta" };
    expect(migrateLegacyDefaultItem(renamed, DEFAULT_OPERATIONAL_LISTS)).toBe(renamed);
    const otherKind = { kind: "service_interest", slug: "reunioes", name: "Reuniões" };
    expect(migrateLegacyDefaultItem(otherKind, DEFAULT_OPERATIONAL_LISTS)).toBe(otherKind);
    const apiSeed = { kind: "lead_status", slug: "proposta_enviada", name: "Proposta enviada" };
    expect(migrateLegacyDefaultItem(apiSeed, DEFAULT_OPERATIONAL_LISTS).slug).toBe("proposal");
  });

  it("canonicalises legacy service slugs listed in lead_type metadata", () => {
    expect(canonicalAllowedServiceSlugs({ allowed_service_slugs: ["gestao_artistica", "show_booking", "x"] })).toEqual(["artist_management", "show_booking", "x"]);
    expect(canonicalAllowedServiceSlugs({})).toBeUndefined();
  });

  it("maps the renamed contact kinds for every stored item (a kind is a container id) and keeps the slugs", () => {
    expect(canonicalOperationalKind("contact_pf_classification")).toBe("contact_individual_classification");
    expect(canonicalOperationalKind("contact_pj_classification")).toBe("contact_company_classification");
    expect(canonicalOperationalKind("lead_type")).toBe("lead_type");
    const platform = migrateLegacyDefaultItem({ kind: "contact_pf_classification", slug: "VIDEOMAKER", name: "Videomaker" }, DEFAULT_OPERATIONAL_LISTS);
    expect(platform).toMatchObject({ kind: "contact_individual_classification", slug: "VIDEOMAKER" });
    const tenant = migrateLegacyDefaultItem({ kind: "contact_pj_classification", slug: "MEU", name: "Meu tipo" }, DEFAULT_OPERATIONAL_LISTS);
    expect(tenant).toMatchObject({ kind: "contact_company_classification", slug: "MEU", name: "Meu tipo" });
  });

  it("marketing defaults carry canonical slugs, English ids, and the stored legacy default is read canonically", () => {
    const sector = DEFAULT_OPERATIONAL_LISTS.filter((d) => d.kind === "marketing_sector").map((d) => d.slug);
    expect(sector).toEqual(["design", "audiovisual", "marketing", "communication"]);
    for (const d of DEFAULT_OPERATIONAL_LISTS) expect(d.id).toMatch(/^[a-z0-9-]+$/);
    expect(migrateLegacyDefaultItem({ kind: "marketing_sector", slug: "Comunicação", name: "Comunicação" }, DEFAULT_OPERATIONAL_LISTS).slug).toBe("communication");
    const custom = { kind: "marketing_sector", slug: "Produção", name: "Produção" };
    expect(migrateLegacyDefaultItem(custom, DEFAULT_OPERATIONAL_LISTS)).toBe(custom);
  });
});

describe("operational vocabulary legacy slug table (explicit pairs through the real reader)", () => {
  const EXPECTED: Record<string, Record<string, string>> = {
    lead_type: { artista_banda: "artist_or_band", contratante_show: "show_booker", marca_empresa: "brand_or_company", produtora_eventos: "event_producer", gravadora_selo: "record_label", agencia: "agency", influenciador: "influencer" },
    lead_category: { artista_banda: "artist_or_band", contratante_show: "show_booker", marca_empresa: "brand_or_company", agencia: "agency" },
    service_interest: { gestao_artistica: "artist_management", producao_musical: "music_production", mixagem: "mixing", masterizacao: "mastering", distribuicao_digital: "digital_distribution", marketing_musical: "music_marketing", producao_audiovisual: "audiovisual_production", design_grafico: "graphic_design", licenciamento: "licensing", consultoria: "consulting", outro: "other" },
    lead_status: { novo_lead: "new", qualificado: "qualified", em_contato: "in_contact", proposta_enviada: "proposal", fechado: "closed", perdido: "lost" },
    lead_segment: { musical: "music", eventos: "events", corporativo: "corporate" },
    marketing_context: { projeto_musical: "music_project", artista: "artist", empresa: "company" },
    marketing_task_type: { campanha: "campaign" },
    briefing_service_type: { campanha: "campaign", conteudo: "content" },
    event_type: { sessoes_estudio: "studio_sessions", ensaios: "rehearsals", sessoes_fotos: "photo_shoots", entrevistas: "interviews", programas_tv: "tv_shows", producao_conteudo: "content_production", reunioes: "meetings" },
  };

  it("canonicalOperationalSlug maps every legacy default slug to its canonical English slug (and legacyOperationalSlugs reverses it)", () => {
    for (const [kind, pairs] of Object.entries(EXPECTED)) {
      for (const [legacy, canonical] of Object.entries(pairs)) {
        expect(canonicalOperationalSlug(kind, legacy)).toBe(canonical);
        expect(canonicalOperationalSlug(kind, canonical)).toBe(canonical);
        expect(legacyOperationalSlugs(kind, canonical)).toContain(legacy);
      }
      expect(Object.keys(LEGACY_OPERATIONAL_SLUGS[kind]).sort()).toEqual(Object.keys(pairs).sort());
    }
  });
});
