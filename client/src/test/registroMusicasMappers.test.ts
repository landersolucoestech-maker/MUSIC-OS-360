import { describe, it, expect } from "vitest";
import {
  dbStatusToSelect,
  normalizeStatusForDb,
  parseDuracao,
  formatDuracao,
  parseIsrc,
  joinIsrc,
  obraToParticipantes,
  participantesToCompositoresLetristas,
  obraTitulo,
  fonogramaToParticipacao,
} from "@/components/forms/registroMusicasMappers";

describe("dbStatusToSelect", () => {
  it("maps DB 'analise' to Select 'em_análise'", () => {
    expect(dbStatusToSelect("analise")).toBe("em_análise");
  });
  it("passes through 'pendente', 'registrado', 'rejeitado'", () => {
    expect(dbStatusToSelect("pendente")).toBe("pendente");
    expect(dbStatusToSelect("registrado")).toBe("registrado");
    expect(dbStatusToSelect("rejeitado")).toBe("rejeitado");
  });
  it("returns empty string for null/undefined", () => {
    expect(dbStatusToSelect(null)).toBe("");
    expect(dbStatusToSelect(undefined)).toBe("");
    expect(dbStatusToSelect("")).toBe("");
  });
});

describe("normalizeStatusForDb", () => {
  it("maps Select 'em_análise' (and variants) to DB 'analise'", () => {
    expect(normalizeStatusForDb("em_análise")).toBe("analise");
    expect(normalizeStatusForDb("em_analise")).toBe("analise");
    expect(normalizeStatusForDb("Em Análise")).toBe("analise");
    expect(normalizeStatusForDb("em analise")).toBe("analise");
  });
  it("passes through other status values", () => {
    expect(normalizeStatusForDb("pendente")).toBe("pendente");
    expect(normalizeStatusForDb("registrado")).toBe("registrado");
    expect(normalizeStatusForDb("rejeitado")).toBe("rejeitado");
  });
  it("defaults to 'pendente' on empty input", () => {
    expect(normalizeStatusForDb("")).toBe("pendente");
    expect(normalizeStatusForDb(null)).toBe("pendente");
  });
});

describe("parseDuracao", () => {
  it("parses MM:SS", () => {
    expect(parseDuracao("03:45")).toEqual({ min: "3", seg: "45" });
  });
  it("parses HH:MM:SS by collapsing hours into minutes", () => {
    expect(parseDuracao("01:02:30")).toEqual({ min: "62", seg: "30" });
  });
  it("returns empty parts for missing duration", () => {
    expect(parseDuracao(null)).toEqual({ min: "", seg: "" });
    expect(parseDuracao("")).toEqual({ min: "", seg: "" });
  });
});

describe("formatDuracao", () => {
  it("formats min/seg into MM:SS", () => {
    expect(formatDuracao("3", "45")).toBe("03:45");
    expect(formatDuracao(0, 5)).toBe("00:05");
  });
  it("returns null when both empty", () => {
    expect(formatDuracao("", "")).toBeNull();
  });
});

describe("parseIsrc", () => {
  it("parses BR-XXX-YY-NNNNN", () => {
    expect(parseIsrc("BR-ABC-25-12345")).toEqual({
      pais: "BR",
      registrante: "ABC",
      ano: "25",
      designacao: "12345",
    });
  });
  it("parses compact format BRXXXYYNNNNN", () => {
    expect(parseIsrc("BRABC2512345")).toEqual({
      pais: "BR",
      registrante: "ABC",
      ano: "25",
      designacao: "12345",
    });
  });
  it("defaults to BR for empty input", () => {
    expect(parseIsrc(null)).toEqual({
      pais: "BR",
      registrante: "",
      ano: "",
      designacao: "",
    });
  });
});

describe("joinIsrc", () => {
  it("joins all four parts", () => {
    expect(
      joinIsrc({ pais: "BR", registrante: "ABC", ano: "25", designacao: "12345" }),
    ).toBe("BR-ABC-25-12345");
  });
  it("returns null when any part missing", () => {
    expect(
      joinIsrc({ pais: "BR", registrante: "", ano: "25", designacao: "12345" }),
    ).toBeNull();
  });
});

describe("obraTitulo", () => {
  it("prefers DB titulo, falls back to legacy title", () => {
    expect(obraTitulo({ titulo: "DB Title", title: "Legacy" })).toBe("DB Title");
    expect(obraTitulo({ title: "Legacy" })).toBe("Legacy");
    expect(obraTitulo(null)).toBe("");
  });
});

describe("obraToParticipantes", () => {
  it("splits compositores and letristas into typed participantes", () => {
    const result = obraToParticipantes({
      compositores: ["Alice", "Bob"],
      letristas: ["Carol"],
    });
    expect(result).toHaveLength(3);
    expect(result.filter((p) => p.classeFuncao === "compositor/autor")).toHaveLength(2);
    expect(result.filter((p) => p.classeFuncao === "tradutor")).toHaveLength(1);
    expect(result.find((p) => p.classeFuncao === "tradutor")?.nome).toBe("Carol");
  });
  it("preserves legacy participantes array if provided", () => {
    const legacy = [
      { id: "1", nome: "Dan", classeFuncao: "Editor", link: "", percentual: "" },
    ];
    expect(obraToParticipantes({ participantes: legacy })).toEqual(legacy);
  });
  it("returns [] when no fields are present", () => {
    expect(obraToParticipantes({})).toEqual([]);
    expect(obraToParticipantes(null)).toEqual([]);
  });
});

describe("participantesToCompositoresLetristas", () => {
  it("splits the participantes back into named arrays", () => {
    const result = participantesToCompositoresLetristas([
      { id: "1", nome: "Alice", classeFuncao: "compositor/autor", link: "", percentual: "" },
      { id: "2", nome: "Carol", classeFuncao: "tradutor", link: "", percentual: "" },
      { id: "3", nome: "  ", classeFuncao: "compositor/autor", link: "", percentual: "" },
    ]);
    expect(result.compositores).toEqual(["Alice"]);
    expect(result.letristas).toEqual(["Carol"]);
  });
  it("returns nulls when no entries match", () => {
    expect(participantesToCompositoresLetristas([])).toEqual({
      compositores: null,
      letristas: null,
    });
  });
});

describe("fonogramaToParticipacao", () => {
  it("hydrates produtores into produtorFonografico", () => {
    const result = fonogramaToParticipacao({ produtores: ["P1", "P2"] });
    expect(result.produtorFonografico.map((p) => p.nome)).toEqual(["P1", "P2"]);
    expect(result.interprete).toEqual([]);
    expect(result.musicoAcompanhante).toEqual([]);
  });
  it("respects legacy participacao object if present", () => {
    const legacy = {
      produtorFonografico: [{ id: "1", nome: "X", percentual: "10" }],
      interprete: [],
      musicoAcompanhante: [],
    };
    expect(fonogramaToParticipacao({ participacao: legacy })).toEqual(legacy);
  });
  it("returns empty categories when fonograma is null", () => {
    expect(fonogramaToParticipacao(null)).toEqual({
      produtorFonografico: [],
      interprete: [],
      musicoAcompanhante: [],
    });
  });
});

describe("status round-trip", () => {
  it("DB → Select → DB stays consistent", () => {
    const cases = ["analise", "pendente", "registrado", "rejeitado"];
    for (const dbVal of cases) {
      const selectVal = dbStatusToSelect(dbVal);
      expect(normalizeStatusForDb(selectVal)).toBe(dbVal);
    }
  });
});

describe("duracao round-trip", () => {
  it("DB string → parts → DB string", () => {
    const cases = ["00:05", "03:45", "10:00", "59:59"];
    for (const dur of cases) {
      const { min, seg } = parseDuracao(dur);
      expect(formatDuracao(min, seg)).toBe(dur);
    }
  });
});

describe("ISRC round-trip", () => {
  it("DB string → parts → DB string", () => {
    const v = "BR-ABC-25-12345";
    expect(joinIsrc(parseIsrc(v))).toBe(v);
  });
});
