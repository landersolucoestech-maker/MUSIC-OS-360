/**
 * modules/reports/computed-fields/releases-faixas.field.ts  ·  Parte 89
 *
 * Resolver dedicado para a aba filha "Faixas do Lançamento"
 * (RELEASES_CONTRACT.childSheets). `faixas[]` vive dentro de
 * releases.metadata.faixas (não normalizada em tabela própria, ao contrário
 * de Projetos/project_tracks). Cada faixa usa a chave `title` no armazenamento
 * real do formulário (LancamentoFormModal.tsx) — renomeada para `nome` na aba
 * filha para não colidir com a coluna `title` do Lançamento (linha-pai).
 *
 * Simplificação documentada (Parte 89): produtores/músicos/artistas
 * adicionais de cada faixa são arrays de objetos ({nome,role}/{nome,
 * instrumento}) — fora do alcance desta aba filha nesta Parte (não incluídos
 * como colunas). Apenas compositores (já uma lista simples de nomes) é
 * exportado/importado.
 */
import { BadRequestException } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';
import { normalizeIsrc, isValidIsrc } from '../../registry/validators/registry-validators';

interface FaixaItem {
  nome: string;
  isVersionAlternativa: unknown;
  tipoVersao: unknown;
  versionCustomName: unknown;
  compositores: string[];
  aiAssistanceLevel: unknown;
  instrumental: unknown;
  faixa_idioma: unknown;
  letra: unknown;
  explicit: unknown;
  isrc: unknown;
  artista: unknown;
}

export async function fetchReleasesFaixasForExport(
  ds: DataSource,
  tenantId: string,
  releaseIds: string[],
): Promise<Map<string, FaixaItem[]>> {
  const out = new Map<string, FaixaItem[]>();
  if (releaseIds.length === 0) return out;
  const rows = (await ds.query(
    `SELECT "id", "metadata"->'faixas' AS faixas FROM "releases" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [tenantId, releaseIds],
  )) as { id: string; faixas: unknown }[];
  for (const row of rows) {
    const raw = Array.isArray(row.faixas) ? (row.faixas as Record<string, unknown>[]) : [];
    out.set(
      row.id,
      raw.map((f) => ({
        nome: String(f.title ?? ''),
        isVersionAlternativa: f.isVersionAlternativa ?? null,
        tipoVersao: f.tipoVersao ?? null,
        versionCustomName: f.versionCustomName ?? null,
        compositores: Array.isArray(f.compositores) ? (f.compositores as string[]) : [],
        aiAssistanceLevel: f.aiAssistanceLevel ?? null,
        instrumental: f.instrumental ?? null,
        faixa_idioma: f.idioma ?? null,
        letra: f.letra ?? null,
        explicit: f.explicit ?? null,
        isrc: f.isrc ?? null,
        artista: f.artista ?? null,
      })),
    );
  }
  return out;
}

export async function writeReleasesFaixasForImport(
  qr: QueryRunner,
  tenantId: string,
  releaseId: string,
  faixas: unknown,
): Promise<void> {
  const list = Array.isArray(faixas) ? faixas : [];
  const stored = list.map((raw, i) => {
    const f = (raw ?? {}) as Record<string, unknown>;
    // find-532335a9: per-track ISRC inside the "Faixas do Lançamento" child
    // sheet bypassed ImportCommitService.assertValidIsrc()/normalizeIsrc()
    // entirely (those only walk the general/non-repeating columns) — the
    // same real ISRC could land here in a different textual form than the
    // manual-entry or general-column import paths.
    let isrc: string | null = null;
    if (typeof f.isrc === 'string' && f.isrc.trim() !== '') {
      const canonicalIsrc = normalizeIsrc(f.isrc);
      if (!isValidIsrc(canonicalIsrc)) {
        throw new BadRequestException(
          `Faixa ${i + 1}: ISRC inválido "${f.isrc}". Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).`,
        );
      }
      isrc = canonicalIsrc;
    }
    return {
      title: String(f.nome ?? ''),
      isVersionAlternativa: f.isVersionAlternativa ?? null,
      tipoVersao: f.tipoVersao ?? null,
      versionCustomName: f.versionCustomName ?? null,
      compositores: Array.isArray(f.compositores) ? f.compositores : [],
      aiAssistanceLevel: f.aiAssistanceLevel ?? null,
      instrumental: f.instrumental ?? null,
      idioma: f.faixa_idioma ?? null,
      letra: f.letra ?? null,
      explicit: f.explicit ?? null,
      isrc,
      artista: f.artista ?? null,
    };
  });
  await qr.query(
    `UPDATE "releases" SET "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{faixas}', $1::jsonb) WHERE "id" = $2 AND "tenant_id" = $3`,
    [JSON.stringify(stored), releaseId, tenantId],
  );
}
