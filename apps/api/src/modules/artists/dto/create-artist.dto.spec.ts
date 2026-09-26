/**
 * create-artist.dto.spec.ts
 *
 * Regression: the Artist create/edit contract works exclusively with URLs
 * (spotify_url/youtube_url/foto_url). Reproduces exactly the global
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
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);
  return Array.from(new Set(metas.map((m) => m.propertyName)));
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
        nome_artistico: 'Teste',
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

  it('accepts payload containing only foto_url/spotify_url/youtube_url', async () => {
    const errors = await validatePayload(CreateArtistDto, {
      nome_artistico: 'Teste',
      foto_url: 'https://cdn.example.com/foto.png',
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
    expect(createProps).toEqual(expect.arrayContaining(['foto_url', 'spotify_url', 'youtube_url']));
  });
});
