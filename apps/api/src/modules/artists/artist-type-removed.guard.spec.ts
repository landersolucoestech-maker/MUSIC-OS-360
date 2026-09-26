/**
 * artist-type-removed.guard.spec.ts
 *
 * Permanent guard (Artists Schema 15): the "tipo" field (artist
 * formation — solo/banda/duo/trio/grupo/coletivo, and the old
 * "artista_solo" shape) was REMOVED from the Artist domain across all
 * layers — not normalized to a canonical vocabulary, not replaced by
 * another field, not kept as an enum. This guard fails if it reappears
 * without that being a deliberate, reviewed product decision.
 *
 * Does NOT do a naive grep for "tipo" — the word is legitimate in dozens
 * of other domains (contracts.tipo, works.tipo, transactions.tipo,
 * ArtistGoalEntity.tipo, ArtistaRelacionamento.tipo, artists.tipo_perfil).
 * Each check here is pointed: the exact property in the exact place.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getMetadataStorage } from 'class-validator';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { getReportFormContract } from '../reports/form-contracts/report-form-contracts';

function decoratedPropertyNames(dto: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(metas.map((m) => m.propertyName)));
}

function readArtistEntitySource(): string {
  const entitiesPath = path.resolve(__dirname, '../../database/entities.ts');
  const content = fs.readFileSync(entitiesPath, 'utf8');
  const start = content.indexOf("@Entity('artists')");
  if (start === -1) throw new Error("Não encontrei @Entity('artists') em entities.ts");
  const nextEntity = content.indexOf('@Entity(', start + 1);
  if (nextEntity === -1) throw new Error('Não encontrei o fim de ArtistEntity em entities.ts');
  return content.slice(start, nextEntity);
}

describe('Permanent guard: artists.tipo (artist formation) was removed, not normalized', () => {
  it('ArtistEntity does not declare the tipo property', () => {
    const source = readArtistEntitySource();
    expect(source).not.toMatch(/\btipo\s*[?!]?\s*:\s*/);
  });

  it('CreateArtistDto/UpdateArtistDto do not have "tipo" as a validated property', () => {
    expect(decoratedPropertyNames(CreateArtistDto)).not.toContain('tipo');
    expect(decoratedPropertyNames(UpdateArtistDto)).not.toContain('tipo');
  });

  it('the artists import/export contract does not expose the tipo column', () => {
    const contract = getReportFormContract('artists');
    expect(contract).not.toBeNull();
    const fieldKeys = contract!.fields.map((f) => f.key);
    expect(fieldKeys).not.toContain('tipo');
    expect(contract!.filterableColumns ?? []).not.toContain('tipo');
  });

  it('LeadEventsHandler does not write tipo when creating the ArtistEntity from a conversion', () => {
    const handlerPath = path.resolve(__dirname, '../leads/handlers/lead-events.handler.ts');
    const source = fs.readFileSync(handlerPath, 'utf8');
    expect(source).not.toMatch(/\btipo\s*:\s*/);
  });

  it('@music-os-360/types no longer exports an ArtistTipo enum', () => {
    // Dynamic import so a package rebuild does not break compilation —
    // the test fails explicitly if the symbol comes back.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const types = require('@music-os-360/types');
    expect(types.ArtistTipo).toBeUndefined();
  });
});
