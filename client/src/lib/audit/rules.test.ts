import { describe, it, expect } from "vitest";
import { AUDIT_RULES, evaluateRow } from "./rules";

function ruleFor(module: string) {
  const rule = AUDIT_RULES.find((r) => r.module === module);
  if (!rule) throw new Error(`Rule for module ${module} not found`);
  return rule;
}

describe("audit rules", () => {
  it("flags artistas without recommended fields", () => {
    const rule = ruleFor("artistas");
    const issues = evaluateRow(rule, {
      id: "a-1",
      nome_artistico: "Fulano",
      tipo: "artista_solo",
      status: "contratado",
      email: null,
      telefone: null,
      genero_musical: null,
      spotify_artist_id: null,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("recomendado");
    expect(issues[0].missing_fields).toEqual(
      expect.arrayContaining(["E-mail", "Telefone", "Gênero musical", "ID do Spotify"]),
    );
  });

  it("returns no issues when artist has all fields", () => {
    const rule = ruleFor("artistas");
    const issues = evaluateRow(rule, {
      id: "a-2",
      nome_artistico: "Beltrano",
      tipo: "banda",
      status: "contratado",
      email: "x@y.com",
      telefone: "+55 11 99999-0000",
      genero_musical: "MPB",
      spotify_artist_id: "abc",
    });
    expect(issues).toHaveLength(0);
  });

  it("flags contrato missing required dates and party", () => {
    const rule = ruleFor("contratos");
    const issues = evaluateRow(rule, {
      id: "c-1",
      titulo: "Contrato X",
      tipo: "exclusividade",
      status: "ativo",
      data_inicio: null,
      data_fim: null,
      artista_id: null,
      cliente_id: null,
      valor: 0,
    });
    const obrig = issues.find((i) => i.severity === "obrigatorio");
    expect(obrig).toBeDefined();
    expect(obrig!.missing_fields).toEqual(
      expect.arrayContaining([
        "Data de início",
        "Data de término",
        "Artista ou cliente vinculado",
      ]),
    );
    const recom = issues.find((i) => i.severity === "recomendado");
    expect(recom).toBeDefined();
    expect(recom!.missing_fields).toContain("Valor");
  });

  it("flags fonograma without isrc and obra", () => {
    const rule = ruleFor("fonogramas");
    const issues = evaluateRow(rule, {
      id: "f-1",
      titulo: "Música A",
      status: "ativo",
      isrc: null,
      artista_id: null,
      obra_id: null,
      genero_musical: null,
      duracao: null,
      duracao_min: null,
      duracao_seg: null,
      participacao: [],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("recomendado");
    expect(issues[0].missing_fields).toEqual(
      expect.arrayContaining(["ISRC", "Artista vinculado", "Obra vinculada", "Duração", "Participações"]),
    );
  });

  it("flags nota fiscal with invalid valor as obrigatorio", () => {
    const rule = ruleFor("notas_fiscais");
    const issues = evaluateRow(rule, {
      id: "nf-1",
      numero: "001",
      status: "emitida",
      valor: 0,
      data_emissao: "2025-01-01",
      cliente_id: "c-1",
      url_pdf: "http://x",
    });
    expect(issues.some((i) => i.severity === "obrigatorio" && i.missing_fields.includes("Valor"))).toBe(true);
  });

  it("flags cliente missing email and telefone (combined recomendado)", () => {
    const rule = ruleFor("clientes");
    const issues = evaluateRow(rule, {
      id: "cl-1",
      nome: "Cliente X",
      tipo_pessoa: "fisica",
      status: "ativo",
      email: null,
      telefone: null,
      cpf_cnpj: "123",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("recomendado");
    expect(issues[0].missing_fields).toContain("E-mail ou telefone");
  });

  it("does not flag cliente when only one of email/telefone is present", () => {
    const rule = ruleFor("clientes");
    const issues = evaluateRow(rule, {
      id: "cl-2",
      nome: "Cliente Y",
      tipo_pessoa: "juridica",
      status: "ativo",
      email: "a@b.com",
      telefone: null,
      cpf_cnpj: "11222333000144",
    });
    expect(issues).toHaveLength(0);
  });
});
