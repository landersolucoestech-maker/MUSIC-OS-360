/**
 * create-artist.dto.spec.ts
 *
 * Regression: the Artist create/edit contract works exclusively with URLs
 * (spotify_url/youtube_url/photo_url). Reproduces exactly the global
 * ValidationPipe (whitelist + forbidNonWhitelisted) from main.ts to prove,
 * without needing to boot the whole app, that:
 *   - a payload with the removed legacy fields is REJECTED (400);
 *   - a payload with only the correct URLs is ACCEPTED.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, getMetadataStorage } from 'class-validator';
import { CreateArtistDto } from './create-artist.dto';
import { UpdateArtistDto } from './update-artist.dto';

/** Property names with at least one class-validator decorator (the DTO's real contract). */
function decoratedPropertyNames(dto: new () => object): string[] {
  const validationMetadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(validationMetadata.map((m) => m.propertyName)));
}

async function validatePayload(dto: object, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto as new () => object, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateArtistDto/UpdateArtistDto — URL-only domain', () => {
  const LEGACY_FIELDS = {
    spotify_artist_id: '4NHQUGzhtTLFvgF5SZesLK',
    youtube_artist_id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    youtube_channel_id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    banner_url: 'https://cdn.example.com/banner.png',
    video_apresentacao_url: 'https://cdn.example.com/video.mp4',
  };

  it.each(Object.entries(LEGACY_FIELDS))(
    'rejects payload for creation containing "%s" (non-whitelisted property)',
    async (field, value) => {
      const errors = await validatePayload(CreateArtistDto, {
        stage_name: 'Teste',
        [field]: value,
      });
      expect(errors.length).toBeGreaterThan(0);
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      expect(messages.some((m) => m.toLowerCase().includes(field.toLowerCase()))).toBe(true);
    },
  );

  it.each(Object.entries(LEGACY_FIELDS))(
    'rejects payload for update containing "%s" (non-whitelisted property)',
    async (field, value) => {
      const errors = await validatePayload(UpdateArtistDto, { [field]: value });
      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('accepts payload containing only photo_url/spotify_url/youtube_url', async () => {
    const errors = await validatePayload(CreateArtistDto, {
      stage_name: 'Teste',
      photo_url: 'https://cdn.example.com/foto.png',
      spotify_url: 'https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK',
      youtube_url: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    });
    expect(errors).toEqual([]);
  });

  it('CreateArtistDto/UpdateArtistDto declare no legacy property, and declare the 3 correct ones', () => {
    const createProps = decoratedPropertyNames(CreateArtistDto);
    const updateProps = decoratedPropertyNames(UpdateArtistDto);
    for (const legacyField of Object.keys(LEGACY_FIELDS)) {
      expect(createProps).not.toContain(legacyField);
      expect(updateProps).not.toContain(legacyField);
    }
    expect(createProps).toEqual(expect.arrayContaining(['photo_url', 'spotify_url', 'youtube_url']));
  });
});

describe('CreateArtistDto/UpdateArtistDto — every URL-ish field is http(s) only (SEC-F1)', () => {
  const HOSTILE = [
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(document.cookie)',
    'JAVASCRIPT://example.com/%0Aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example.com/x.png',
  ];
  const URL_FIELDS = ['photo_url', 'press_kit_url', 'personal_documents_url', 'foto_url', 'presskit_url', 'documentos_pessoais_url'];
  const LIST_FIELDS = ['gallery_urls', 'galeria_urls'];

  for (const dto of [CreateArtistDto, UpdateArtistDto]) {
    it.each(URL_FIELDS.flatMap((field) => HOSTILE.map((value) => [field, value])))(
      `${dto.name} rejects %s = %j`,
      async (field, value) => {
        const errors = await validatePayload(dto, { stage_name: 'Teste', [field]: value });
        expect(errors.map((e) => e.property)).toContain(field);
      },
    );

    it.each(LIST_FIELDS.flatMap((field) => HOSTILE.map((value) => [field, value])))(
      `${dto.name} rejects a %s item = %j`,
      async (field, value) => {
        const errors = await validatePayload(dto, { stage_name: 'Teste', [field]: ['https://cdn.example.com/ok.png', value] });
        expect(errors.map((e) => e.property)).toContain(field);
      },
    );

    it.each(HOSTILE)(`${dto.name} rejects a documents item url = %j`, async (value) => {
      const errors = await validatePayload(dto, { stage_name: 'Teste', documents: [{ name: 'RG', url: value }] });
      expect(errors.map((e) => e.property)).toContain('documents');
    });

    it.each([
      ['instagram_url', 'javascript:alert(1)'],
      ['tiktok_url', 'data:text/html,<script>alert(1)</script>'],
      ['soundcloud_url', ' JaVaScRiPt:alert(1)'],
      ['deezer_url', 'javascript://deezer.com/artist/1'],
    ])(`${dto.name} rejects the social link %s = %j`, async (field, value) => {
      const errors = await validatePayload(dto, { stage_name: 'Teste', [field]: value });
      expect(errors.map((e) => e.property)).toContain(field);
    });

    it(`${dto.name} accepts http(s) links (including local storage hosts) and blanks`, async () => {
      const errors = await validatePayload(dto, {
        stage_name: 'Teste',
        photo_url: 'https://cdn.example.com/foto.png',
        press_kit_url: 'http://localhost:54321/storage/v1/object/public/press.pdf',
        personal_documents_url: '',
        gallery_urls: ['https://cdn.example.com/g1.png', 'https://cdn/x/g2.png'],
        documents: [{ name: 'RG', url: 'https://cdn.example.com/rg.pdf' }, { name: 'Sem link', url: '' }],
        foto_url: '',
      });
      expect(errors).toEqual([]);
    });
  }
});

describe('CreateArtistDto — contract_id is a UUID (400, never a Postgres cast 500) (SEC-F4)', () => {
  it.each(['contract_id', 'contrato_id'])('%s rejects a non-UUID value', async (field) => {
    const errors = await validatePayload(CreateArtistDto, { stage_name: 'Teste', [field]: "1' OR '1'='1" });
    expect(errors.map((e) => e.property)).toContain(field);
    const numeric = await validatePayload(UpdateArtistDto, { [field]: 42 });
    expect(numeric.map((e) => e.property)).toContain(field);
  });

  it.each(['contract_id', 'contrato_id'])('%s accepts a UUID, a blank (no contract) and null', async (field) => {
    for (const value of ['5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac001', '', null]) {
      expect(await validatePayload(UpdateArtistDto, { [field]: value })).toEqual([]);
    }
  });
});
