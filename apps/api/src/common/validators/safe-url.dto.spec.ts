import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate as classValidate } from 'class-validator';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateReleaseDto, UpdateReleaseDto } from '../../modules/releases/dto/releases.dto';
import { CreateContentDetectionDto } from '../../modules/content-detections/dto/create-content-detection.dto';
import { CreateTakedownDto } from '../../modules/takedowns/dto/takedowns.dto';
import { CreateMarketingContentDto } from '../../modules/marketing/dto/marketing-contents.dto';
import { CreateMarketingTaskDto } from '../../modules/marketing/dto/marketing-tasks.dto';
import { CreateMarketingAssetDto } from '../../modules/marketing/dto/marketing-assets.dto';
import { CreateProjectDto } from '../../modules/projects/dto/projects.dto';
import { isHttpOrStorageUrl, isSafeUrlText, hasSafeUrlValues } from './safe-url.validation';

/** Same options as the global pipe in create-app.ts. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = <T>(metatype: new () => T, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype }) as Promise<T>;
const rejects = async <T>(metatype: new () => T, value: Record<string, unknown>) => {
  await expect(validate(metatype, value)).rejects.toBeInstanceOf(BadRequestException);
};
/**
 * Array-of-object fields: validated on the plain object graph (the global pipe's implicit
 * conversion does not keep untyped array items, see the findings note), like projects.dto.spec.ts.
 */
const plainErrors = async <T extends object>(metatype: new () => T, value: Record<string, unknown>) =>
  classValidate(plainToInstance(metatype, value), { whitelist: true, forbidNonWhitelisted: true });
const plainUrlOnlyFails = async <T extends object>(metatype: new () => T, build: (url: string) => Record<string, unknown>, evil: string) => {
  expect(await plainErrors(metatype, build('https://cdn.example.com/ok.png'))).toEqual([]);
  expect((await plainErrors(metatype, build(evil))).length).toBeGreaterThan(0);
};
/** The payload is valid with a safe URL (so the rejection below is about the URL only) and invalid with `evil`. */
const urlOnlyFails = async <T>(metatype: new () => T, build: (url: string) => Record<string, unknown>, evil: string) => {
  await expect(validate(metatype, build('https://cdn.example.com/ok.png'))).resolves.toBeDefined();
  await rejects(metatype, build(evil));
};

const EVIL = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  '\u0001javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  '//evil.example/x',
  '\\\\evil.example/x',
  '/\t/evil.example',
  'file:///etc/passwd',
  'blob:https://evil.example/x',
];

const SAFE_STRICT = [
  'https://cdn.example.com/a.png',
  'http://localhost:54321/storage/v1/object/public/x.png',
  'https://pub-abc.r2.dev/tenants/11111111-1111-1111-1111-111111111111/images/22222222-2222-2222-2222-222222222222/cover.png',
  'r2://music-os/tenants/t/images/f/cover.png',
];

describe('shared URL validators (SEC1 / find-77526160)', () => {
  it.each(EVIL)('isHttpOrStorageUrl rejects %j', (value) => {
    expect(isHttpOrStorageUrl(value)).toBe(false);
  });
  it.each(EVIL)('isSafeUrlText rejects %j', (value) => {
    expect(isSafeUrlText(value)).toBe(false);
  });
  it.each(SAFE_STRICT)('accepts storage/http URL %s', (value) => {
    expect(isHttpOrStorageUrl(value)).toBe(true);
    expect(isSafeUrlText(value)).toBe(true);
  });
  it('isSafeUrlText keeps bare hosts and host:port, caps the length', () => {
    expect(isSafeUrlText('example.com/watch?v=1')).toBe(true);
    expect(isSafeUrlText('example.com:8080/x')).toBe(true);
    expect(isSafeUrlText(`https://example.com/${'a'.repeat(2100)}`)).toBe(false);
  });
  it.each([
    'javascript:1/alert(document.domain)', 'javascript:1?alert(1):0', 'JAVASCRIPT:12/alert(1)', 'javascript:1', 'javascript:0#\nalert(1)',
    'data:1/x', 'vbscript:1/x', 'file:1/x', 'blob:1/x', 'about:1/x', 'java\tscript:1/x', 'foo:1/x',
  ])('isSafeUrlText / hasSafeUrlValues reject digit-suffixed dangerous scheme %j (S2-1)', (value) => {
    expect(isSafeUrlText(value)).toBe(false);
    expect(hasSafeUrlValues({ url: value })).toBe(false);
  });
  it('isSafeUrlText still allows host:port only for host-looking names', () => {
    expect(isSafeUrlText('localhost:3000/x')).toBe(true);
    expect(isSafeUrlText('cdn.example.com:8443')).toBe(true);
  });
  it.each(['uri', 'website', 'avatar', 'image', 'cover', 'thumbnail', 'download', 'permalink', 'photo', 'logo', 'profile_image', 'coverImage', 'thumbnails'])(
    'hasSafeUrlValues checks the %s key too (S2-2)', (key) => {
      expect(hasSafeUrlValues({ [key]: 'javascript:alert(1)' })).toBe(false);
      expect(hasSafeUrlValues({ [key]: 'javascript:1/x' })).toBe(false);
      expect(hasSafeUrlValues({ [key]: 'https://ok.example/a.png' })).toBe(true);
    });
  it('hasSafeUrlValues inspects url-ish keys at any depth', () => {
    expect(hasSafeUrlValues({ audio_master_url: 'https://x.example/a.wav', lyrics: 'javascript:not a url key' })).toBe(true);
    expect(hasSafeUrlValues({ a: { b: [{ previewUrl: 'javascript:alert(1)' }] } })).toBe(false);
    expect(hasSafeUrlValues({ links: ['https://ok.example', 'javascript:alert(1)'] })).toBe(false);
    expect(hasSafeUrlValues({ link: 'java\tscript:alert(1)' })).toBe(false);
    expect(hasSafeUrlValues({ url: 5 })).toBe(false);
    expect(hasSafeUrlValues({ url: null, link: '' })).toBe(true);
    expect(hasSafeUrlValues({ a: { b: { c: { d: { e: { f: { g: {} } } } } } } })).toBe(false); // depth bomb fails closed
  });
});

describe('releases DTO URLs', () => {
  const base = { title: 'T', type: 'single' };
  it.each(EVIL)('coverUrl %j is rejected (create and update)', async (evil) => {
    await urlOnlyFails(CreateReleaseDto, (coverUrl) => ({ ...base, coverUrl }), evil);
    await urlOnlyFails(UpdateReleaseDto, (coverUrl) => ({ coverUrl }), evil);
  });
  it.each(EVIL)('assets URL %j is rejected', async (evil) => {
    await urlOnlyFails(CreateReleaseDto, (u) => ({ ...base, assets: { epk_url: u } }), evil);
    await urlOnlyFails(UpdateReleaseDto, (u) => ({ assets: { music_video_url: u } }), evil);
    await urlOnlyFails(UpdateReleaseDto, (u) => ({ assets: { audio_master_url: u } }), evil);
    await urlOnlyFails(CreateReleaseDto, (u) => ({ ...base, assets: { cover_url: u } }), evil);
    await urlOnlyFails(CreateReleaseDto, (u) => ({ ...base, metadata: { nested: { audioUrl: u } } }), evil);
  });
  it('rejects non-string and over-long URLs', async () => {
    await rejects(CreateReleaseDto, { ...base, coverUrl: { href: 'javascript:alert(1)' } });
    await rejects(CreateReleaseDto, { ...base, coverUrl: `https://a.example/${'x'.repeat(2100)}` });
  });
  it.each(SAFE_STRICT)('legitimate storage/http cover %s and assets pass', async (url) => {
    await expect(validate(CreateReleaseDto, { ...base, coverUrl: url, assets: { cover_url: url, epk_url: url, lyrics: 'la la' } })).resolves.toBeDefined();
  });
  it('blank/null url values (clearing a field) still pass', async () => {
    await expect(validate(UpdateReleaseDto, { coverUrl: '', assets: { epk_url: null, music_video_url: '' } })).resolves.toBeDefined();
  });
});

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT = { title: 't', targetType: 'artist', targetName: 'n', channel: 'instagram', type: 'post', publishDate: '2026-10-01', publishTime: '10:00', copy: 'c' };

describe('other DTOs feeding raw hrefs/srcs', () => {
  it.each(EVIL)('content detection url %j', async (evil) => {
    await urlOnlyFails(CreateContentDetectionDto, (url) => ({ platform: 'youtube', url }), evil);
  });
  it.each(EVIL)('takedown infringing_url %j', async (evil) => {
    await urlOnlyFails(CreateTakedownDto, (infringing_url) => ({ title: 'T', platform: 'youtube', reason: 'r', infringing_url }), evil);
  });
  it.each(EVIL)('marketing asset fileUrl/thumbnailUrl %j', async (evil) => {
    await urlOnlyFails(CreateMarketingAssetDto, (fileUrl) => ({ title: 'a', assetType: 'COVER', fileUrl }), evil);
    await urlOnlyFails(CreateMarketingAssetDto, (thumbnailUrl) => ({ title: 'a', assetType: 'COVER', fileUrl: 'https://ok.example/a.png', thumbnailUrl }), evil);
  });
  it.each(EVIL)('marketing content files[].url %j', async (evil) => {
    await plainUrlOnlyFails(CreateMarketingContentDto, (url) => ({ ...CONTENT, files: [{ id: '1', name: 'n', url }] }), evil);
  });
  it.each(EVIL)('marketing task metadata referenceAudio.url %j', async (evil) => {
    await urlOnlyFails(CreateMarketingTaskDto, (url) => ({ title: 't', marketingProjectId: PROJECT_ID, metadata: { referenceAudio: { fileName: 'a', url } } }), evil);
  });
  it.each(EVIL)('project tracks[].audioUrl %j', async (evil) => {
    await plainUrlOnlyFails(CreateProjectDto, (audioUrl) => ({ title: 't', type: 'single', tracks: [{ id: '1', name: 'n', audioUrl }] }), evil);
  });
  it('legitimate values still pass', async () => {
    await expect(validate(CreateContentDetectionDto, { platform: 'youtube', url: 'https://youtube.com/watch?v=1' })).resolves.toBeDefined();
    await expect(validate(CreateTakedownDto, { title: 'T', platform: 'p', reason: 'r', infringing_url: 'example.com/x' })).resolves.toBeDefined();
    await expect(validate(CreateTakedownDto, { title: 'T', platform: 'p', reason: 'r', infringing_url: 'https://example.com/x' })).resolves.toBeDefined();
    expect(await plainErrors(CreateProjectDto, { title: 't', type: 'single', tracks: [{ id: '1', name: 'n', audioUrl: 'r2://b/tenants/t/audio/f/a.wav' }] })).toEqual([]);
    expect(await plainErrors(CreateMarketingContentDto, { ...CONTENT, files: [{ id: '1', name: 'n', url: 'https://cdn.example/a.mp4' }] })).toEqual([]);
  });
});
