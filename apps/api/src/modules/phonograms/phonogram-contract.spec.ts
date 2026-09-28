import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePhonogramDto } from './dto/create-phonogram.dto';
import { QueryPhonogramDto } from './dto/query-phonogram.dto';
import { PHONOGRAM_DEPRECATED_FIELDS, canonicalizePhonogramInput, canonicalizePhonogramQuery } from './phonogram-legacy-fields';

/**
 * CZ-040: phonogram fields, values, participation keys and query values are
 * English. LEGACY_WEB_PHONOGRAM is the payload a pre-CZ-040 web build sends; it
 * must validate and map to the canonical contract (the Portuguese duplicates
 * of the registry fields land on the registry column, the single source).
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_PHONOGRAM = {
  title: 'Noite Estrelada',
  cod_ecad: 'ECAD-1',
  cod_entidade: 'ABR-1',
  agregadora: 'outro',
  isrc_pais: 'BR',
  isrc_registrante: 'ABC',
  isrc_ano: '25',
  isrc_designacao: '12345',
  criada_por_ia: false,
  nacional: true,
  pub_simultanea: false,
  emissao: '2026-01-10',
  gravacao_original: '2025-12-01',
  data_lancamento: '2026-02-01',
  duracao_min: 3,
  duracao_seg: 30,
  midia: 'físico',
  classificacao: 'outro',
  pais_origem: 'brazil',
  pais_publicacao: 'uk',
  gravadora: 'Selo Y',
  participacao: {
    produtorFonografico: [{ id: '1', name: 'Produtor A', percentual: '50' }],
    interprete: [{ id: '2', name: 'Intérprete B', percentual: '50' }],
    musicoAcompanhante: [],
  },
  arquivo_audio: { name: 'a.wav' },
};

describe('Phonogram request contract (CZ-040)', () => {
  it('the pre-CZ-040 web payload validates', () => {
    expect(errorsFor(CreatePhonogramDto, LEGACY_WEB_PHONOGRAM)).toEqual([]);
  });

  it('rejects unknown media type / classification values', () => {
    expect(errorsFor(CreatePhonogramDto, { title: 'x', media_type: 'vinil' })).toContain('media_type');
    expect(errorsFor(CreatePhonogramDto, { title: 'x', recording_classification: 'x' })).toContain('recording_classification');
  });

  it('maps the pre-CZ-040 payload to canonical names, values and nested keys', () => {
    const out = canonicalizePhonogramInput(LEGACY_WEB_PHONOGRAM) as Record<string, unknown>;
    expect(out).toMatchObject({
      ecad_code: 'ECAD-1', society_code: 'ABR-1', aggregator: 'other',
      isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '25', isrc_designation_code: '12345',
      ai_used: false, is_national: true, is_simultaneous_publication: false,
      issue_date: '2026-01-10', recording_date: '2025-12-01', release_date: '2026-02-01',
      duration_seconds: 210, media_type: 'physical', recording_classification: 'other',
      country_of_recording: 'BR', publication_country: 'GB', record_label_name: 'Selo Y',
      participation: {
        phonographic_producers: [{ id: '1', name: 'Produtor A', percentage: '50' }],
        performers: [{ id: '2', name: 'Intérprete B', percentage: '50' }],
        session_musicians: [],
      },
      audio_file: { name: 'a.wav' },
    });
    for (const legacy of [...Object.keys(PHONOGRAM_DEPRECATED_FIELDS), 'duracao_min', 'duracao_seg']) {
      expect(out).not.toHaveProperty(legacy);
    }
  });

  it('"Outro" country becomes ZZ; ISO codes are upper-cased; canonical wins over alias', () => {
    expect(canonicalizePhonogramInput({ pais_origem: 'outro' })).toEqual({ country_of_recording: 'ZZ' });
    expect(canonicalizePhonogramInput({ country_of_recording: 'br' })).toEqual({ country_of_recording: 'BR' });
    expect(canonicalizePhonogramInput({ duration_seconds: 99, duracao_min: 3, duracao_seg: 30 })).toEqual({ duration_seconds: 99 });
  });

  it('maps the pre-CZ-040 query values', () => {
    expect(errorsFor(QueryPhonogramDto, { obra_vinculada: 'sem-obra', ecad: 'com-ecad' })).toEqual([]);
    expect(canonicalizePhonogramQuery({ obra_vinculada: 'sem-obra', ecad: 'com-ecad' })).toEqual({ has_work: 'false', ecad: 'with_code' });
    expect(canonicalizePhonogramQuery({ obra_vinculada: 'com-obra' })).toEqual({ has_work: 'true' });
  });
});
