import * as fs from 'fs';
import * as path from 'path';

/**
 * work-participants-normalization.spec.ts
 *
 * Guarda permanente (auditoria 2026-07-18): `works.participantes` era uma
 * única coluna jsonb representando uma lista de registros relacionados
 * (autoria) — normalizada em `work_participants` (migration
 * WorkParticipantsNormalization20260718000011). `works.detentores` e
 * `works.co_compositores` foram removidas por não terem nenhum writer ativo
 * comprovado (sem input no formulário, ausentes do DTO, `importable: false`
 * no contrato de Reports).
 *
 * Este teste é estático: garante que a entity não reintroduza as colunas
 * removidas e que a migration possui as validações fail-fast exigidas
 * (não perder dado, não usar CASCADE indiscriminado, down() honesto).
 */
const entitiesSrc = fs.readFileSync(path.resolve(__dirname, 'entities.ts'), 'utf8');
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260718000011_WorkParticipantsNormalization.ts'),
  'utf8',
);

function entityBlock(entityClassName: string): string {
  const start = entitiesSrc.indexOf(`export class ${entityClassName}`);
  if (start === -1) throw new Error(`Entity ${entityClassName} não encontrada em entities.ts`);
  const closingBrace = /\r?\n\}\r?\n/.exec(entitiesSrc.slice(start));
  if (!closingBrace) throw new Error(`Não foi possível localizar o fechamento da classe ${entityClassName}`);
  return entitiesSrc.slice(start, start + closingBrace.index);
}

describe('WorkEntity não reintroduz colunas removidas', () => {
  const workBlock = entityBlock('WorkEntity');

  it('não declara mais `participantes`, `detentores` ou `co_compositores` como @Column', () => {
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*participantes:/);
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*detentores:/);
    expect(workBlock).not.toMatch(/@Column\([^)]*\)\s*co_compositores:/);
  });

  it('mantém `compositor`, `compositores`, `editora` — writer real via bulk-import (Reports)', () => {
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*compositor:/);
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*compositores:/);
    expect(workBlock).toMatch(/@Column\([^)]*\)\s*editora:/);
  });

  it('possui relação para work_participants (participantes_rel)', () => {
    expect(workBlock).toMatch(/@OneToMany\(\(\) => WorkParticipantEntity/);
  });
});

describe('WorkParticipantEntity — tabela filha normalizada', () => {
  const block = entityBlock('WorkParticipantEntity');

  it('possui as colunas reais extraídas de ParticipanteForm (nome, classe_funcao, link, percentual, sort_order)', () => {
    for (const field of ['tenant_id', 'work_id', 'nome', 'classe_funcao', 'link', 'percentual', 'sort_order']) {
      expect(block).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it('possui FK para works via work_id', () => {
    expect(block).toMatch(/@ManyToOne\(\(\) => WorkEntity/);
    expect(block).toMatch(/@JoinColumn\(\{ name: 'work_id' \}\)/);
  });
});

describe('Migration WorkParticipantsNormalization20260718000011 — segurança de dados', () => {
  it('aborta (fail-fast) se houver item de participantes em formato desconhecido', () => {
    expect(migrationSrc).toMatch(/NOT \(item \? 'nome'\)/);
    expect(migrationSrc).toMatch(/throw new Error/);
  });

  it('aborta (fail-fast) se detentores/co_compositores tiverem dado remanescente antes de remover as colunas', () => {
    expect(migrationSrc).toMatch(/detentores IS NOT NULL/);
    expect(migrationSrc).toMatch(/co_compositores IS NOT NULL/);
  });

  it('verifica que o backfill não perdeu nenhum item (contagem origem = destino) antes de dropar colunas', () => {
    expect(migrationSrc).toMatch(/source_count/);
    expect(migrationSrc).toMatch(/target_count/);
  });

  it('não usa DROP COLUMN CASCADE nem DROP TABLE CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP COLUMN[^;]*CASCADE/i);
    expect(migrationSrc).not.toMatch(/DROP TABLE[^;]*CASCADE/i);
  });

  it('possui down() honesto — restaura as colunas e reconstrói o jsonb a partir de work_participants', () => {
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS participantes jsonb/);
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS detentores text/);
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS co_compositores text/);
    expect(migrationSrc).toMatch(/jsonb_agg/);
  });

  it('habilita RLS com tenant_isolation na tabela filha', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/tenant_isolation/);
  });
});
