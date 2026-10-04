import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateArtistDto } from './create-artist.dto';

// Real validation pipeline with the global pipe options. EVERY deprecated (CZ-042) property the DTO declares must stay
// accepted with a valid value (value preserved) and reject a malformed value with a constraint on that exact property.
const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreateArtistDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

type Kind = { valid: unknown; bad: unknown; constraint: string };
const STRING: Kind = { valid: 'x', bad: 42, constraint: 'isString' };
const URL: Kind = { valid: 'https://cdn.example.com/a.png', bad: 'javascript:alert(1)', constraint: '' };
const URL_LIST: Kind = { valid: ['https://cdn.example.com/a.png'], bad: ['javascript:alert(1)'], constraint: '' };
const ARRAY: Kind = { valid: ['x'], bad: 'not-an-array', constraint: 'isArray' };
const OBJECT: Kind = { valid: { a: true }, bad: 'not-an-object', constraint: 'isObject' };
const NUMBER: Kind = { valid: 10, bad: 'abc', constraint: 'isNumber' };
const UUID: Kind = { valid: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac001', bad: "1' OR '1'='1", constraint: 'isUuid' };

const KIND_OF: Record<string, Kind> = {
  foto_url: URL, documentos_pessoais_url: URL, presskit_url: URL,
  galeria_urls: URL_LIST,
  especialidades: ARRAY, tags_musicais: ARRAY, relacionamentos: ARRAY, distribuidoras_gerais: ARRAY,
  contatos_vinculados: ARRAY, contatos_equipe: ARRAY,
  distribuidoras_selecionadas: OBJECT, distribuidoras_emails: OBJECT,
  distribuidoras_empresa_selecionadas: OBJECT, distribuidoras_empresa_emails: OBJECT,
  spotify_ouvintes: NUMBER, youtube_inscritos: NUMBER, deezer_fas: NUMBER, apple_music_albuns_url: NUMBER,
  soundcloud_seguidores_url: NUMBER, instagram_seguidores: NUMBER, tiktok_seguidores: NUMBER,
  contrato_id: UUID,
};

/** Explicit, static list (a derived list would shrink with a renamed property and hide the regression). */
const DEPRECATED = [
  'nome_artistico',
  'nome_civil',
  'foto_url',
  'galeria_urls',
  'especialidades',
  'documentos_pessoais_url',
  'presskit_url',
  'data_nascimento',
  'endereco',
  'telefone',
  'banco',
  'agencia',
  'conta',
  'chave_pix',
  'titular_conta',
  'tipo_perfil',
  'slug_artistico',
  'tags_musicais',
  'fase_carreira',
  'relacionamentos',
  'empresario_id',
  'empresario_nome',
  'empresario_telefone',
  'empresario_email',
  'gravadora_id',
  'gravadora_nome',
  'gravadora_telefone',
  'gravadora_email',
  'gravadora_responsavel_id',
  'gravadora_responsavel_nome',
  'gravadora_responsavel_telefone',
  'gravadora_responsavel_email',
  'distribuidoras_selecionadas',
  'distribuidoras_emails',
  'distribuidoras_empresa_selecionadas',
  'distribuidoras_empresa_emails',
  'distribuidoras_gerais',
  'contatos_vinculados',
  'contatos_equipe',
  'notas_internas',
  'manager_nome',
  'manager_contato',
  'produtor_executivo',
  'agencia_booking',
  'label_parceira',
  'contrato_id',
  'genero',
  'spotify_ouvintes',
  'youtube_inscritos',
  'deezer_fas',
  'apple_music_albuns_url',
  'soundcloud_seguidores_url',
  'instagram_seguidores',
  'tiktok_seguidores',
];

/** The set the DTO itself marks deprecated in Swagger. */
const DECLARED_DEPRECATED: string[] = ((Reflect.getMetadata('swagger/apiModelPropertiesArray', CreateArtistDto.prototype) ?? []) as string[])
  .map((k) => k.replace(/^:/, ''))
  .filter((k) => Reflect.getMetadata('swagger/apiModelProperties', CreateArtistDto.prototype, k)?.deprecated === true);
const kindOf = (prop: string): Kind => KIND_OF[prop] ?? STRING;

describe('CreateArtistDto deprecated properties (legacy in)', () => {
  it('the DTO marks exactly these properties deprecated in the Swagger metadata', () => {
    expect([...DECLARED_DEPRECATED].sort()).toEqual([...DEPRECATED].sort());
  });

  it.each(DEPRECATED)('accepts %s with a valid value and preserves it', async (legacy) => {
    const { valid } = kindOf(legacy);
    const { instance, errors } = await run({ stage_name: 'Teste', [legacy]: valid });
    expect(errors).toEqual([]);
    expect((instance as unknown as Record<string, unknown>)[legacy]).toEqual(valid);
  });

  it.each(DEPRECATED)('rejects a malformed %s with a constraint on that property (not a whitelist error)', async (legacy) => {
    const { bad, constraint } = kindOf(legacy);
    const { errors } = await run({ stage_name: 'Teste', [legacy]: bad });
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    const keys = Object.keys(forLegacy[0].constraints ?? forLegacy[0].children?.[0]?.constraints ?? {});
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toContain('whitelistValidation');
    if (constraint) expect(keys).toContain(constraint);
  });

  it('accepts the blank (no contract) value on the deprecated contrato_id like the canonical contract_id', async () => {
    expect((await run({ stage_name: 'Teste', contrato_id: '' })).errors).toEqual([]);
  });
});
