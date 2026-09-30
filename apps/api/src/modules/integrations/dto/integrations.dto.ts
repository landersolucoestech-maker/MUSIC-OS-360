import { IsString, IsOptional, IsNotEmpty, IsBase64, IsIn, IsArray, IsEmail, IsObject, Matches, ValidateIf } from 'class-validator';
import type { DeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// find-89cba006: RegisterAbramusWorkDto/ConfigureSoundCloudDto/OAuthCodeStateDto/
// AutentiqueWebhookDto were referenced by integrations.dto.spec.ts (Wave 10) but
// never defined here -- the import silently resolved to undefined and the whole
// spec failed at runtime with a confusing class-validator "unknown value" error.
// Added here to close that compile-time gap. Now wired into
// IntegrationsController's @Body() types for soundcloud/configure,
// abramus/register-work and the instagram|tiktok|google-ads callbacks,
// activating the global ValidationPipe's whitelist/forbidNonWhitelisted/
// transform on those routes. autentique/webhook keeps `@Body() payload: any`
// (a scoped @UsePipes cannot override the global ValidationPipe -- both run)
// and validates AutentiqueWebhookDto manually with whitelist:false, to keep
// tolerating unmodeled provider fields -- see IntegrationsController.

export class OAuthInitDto {
  @ApiProperty({ description: 'Platform that will start the OAuth flow' })
  @IsString() @IsNotEmpty()
  @IsIn([
    'corp_instagram', 'meta_business', 'meta_ads',
    'corp_tiktok', 'tiktok_business', 'tiktok_ads',
    'corp_youtube', 'youtube_business', 'google_business', 'google_ads', 'youtube_ads',
    'spotify_ads', 'corp_spotify',
    'docusign', 'stripe_connect',
  ])
  platform!: string;
}

export class OAuthExchangeDto {
  @ApiProperty({ description: 'Authorization code returned by the platform' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Platform identifier (e.g. corp_instagram, corp_tiktok, corp_youtube)' })
  @IsString() @IsNotEmpty()
  @IsIn([
    'corp_instagram', 'meta_business', 'meta_ads',
    'corp_tiktok', 'tiktok_business', 'tiktok_ads',
    'corp_youtube', 'youtube_business', 'google_business', 'google_ads', 'youtube_ads',
    'docusign', 'stripe_connect',
  ])
  platform!: string;

  @ApiProperty({ description: 'Single-use exchange token issued by POST /oauth/init (replaces redirect_uri)' })
  @IsString() @IsNotEmpty()
  exchange_token!: string;
}

export class ConfigureAutentiqueDto {
  @ApiProperty({ description: 'Autentique API token' })
  @IsString() @IsNotEmpty()
  apiToken!: string;
}

export class AutentiqueSignerDto {
  @ApiProperty({ description: 'Signer name' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Signer e-mail' })
  @IsEmail()
  email!: string;
}

export class CreateAutentiqueDocumentDto {
  @ApiProperty({ description: 'Document name' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'File content in base64' })
  @IsString() @IsBase64()
  fileBase64!: string;

  @ApiProperty({ description: 'Signers list', type: 'array' })
  @IsArray()
  signers!: AutentiqueSignerDto[];

  @ApiPropertyOptional({ description: 'ID of the internal contract linked to the document' })
  @IsOptional() @IsString()
  contractId?: string;
}

export class SendForSignatureDto {
  @ApiProperty({ description: 'Contract ID on the platform' })
  @IsString() @IsNotEmpty()
  contractId!: string;

  @ApiProperty({ description: 'Document name' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'File content in base64' })
  @IsString() @IsBase64()
  fileBase64!: string;

  @ApiProperty({ description: 'Signers list', type: 'array' })
  @IsArray()
  signers!: AutentiqueSignerDto[];
}

export class RecognizeAudioDto {
  @ApiProperty({ description: 'Audio in base64 (mp3, wav)' })
  @IsString() @IsBase64()
  audioBase64!: string;
}

export class SpotifyConnectDto {
  @ApiProperty({ description: 'OAuth code returned by Spotify' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'State passed in the OAuth flow' })
  @IsString() @IsNotEmpty()
  state!: string;
}

export class SyncSpotifyArtistDto {
  @ApiProperty({ description: 'Artist profile URL on Spotify' })
  @IsString() @IsNotEmpty() @Matches(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]{22}(?:[/?#].*)?$/i, { message: 'Informe uma URL válida do Spotify' })
  spotifyUrl!: string;
}

export class RequestExternalDataSyncDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  artistId!: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray()
  workIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  societyHint?: string;
}

export class DistributorSubmitDto {
  @ApiProperty({ description: 'Registered distributor provider ID (no default — no real provider is registered in production)' })
  @IsString() @IsNotEmpty()
  providerId!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  artistId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  releaseId?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray()
  phonogramIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class SocietySubmitDto {
  @ApiProperty({ description: 'Registered society/PRO provider ID (no default — no real provider is registered in production)' })
  @IsString() @IsNotEmpty()
  providerId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  artistId?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray()
  workIds?: string[];

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray()
  phonogramIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExternalDataStatusCheckDto {
  @ApiProperty({ description: 'Registered provider ID (no default — no real provider is registered in production)' })
  @IsString() @IsNotEmpty()
  providerId!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  submissionId!: string;

  @ApiPropertyOptional({ enum: ['artist', 'release', 'work', 'phonogram'] })
  @IsOptional() @IsIn(['artist', 'release', 'work', 'phonogram'])
  entityType?: 'artist' | 'release' | 'work' | 'phonogram';

  @ApiPropertyOptional() @IsOptional() @IsString()
  entityId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  idempotencyKey?: string;
}

/**
 * Deploy-skew window: Portuguese field names a pre-canonical web build sends
 * (see applyDeprecatedFieldAliases). The Abramus EXTERNAL vocabulary
 * (compositor/coautores/genero/duracao/editora) lives only in AbramusService.
 */
export const ABRAMUS_WORK_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  titulo: 'title',
  compositor: 'composer',
  coautores: 'co_composers',
  genero: 'genre',
  duracao: 'duration',
  editora: 'publisher',
};

export class RegisterAbramusWorkDto {
  // Required unless the deprecated alias is sent; an explicitly sent empty value always fails.
  @ApiProperty() @ValidateIf((o: RegisterAbramusWorkDto) => o.title !== undefined || o.titulo == null)
  @IsString() @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of title.' })
  @IsOptional() @IsString() @IsNotEmpty()
  titulo?: string;

  @ApiProperty() @ValidateIf((o: RegisterAbramusWorkDto) => o.composer !== undefined || o.compositor == null)
  @IsString() @IsNotEmpty()
  composer!: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of composer.' })
  @IsOptional() @IsString() @IsNotEmpty()
  compositor?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  co_composers?: string[];

  @ApiPropertyOptional({ type: [String], deprecated: true, description: 'Deprecated alias of co_composers.' })
  @IsOptional() @IsArray() @IsString({ each: true })
  coautores?: string[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  iswc?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  genre?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of genre.' })
  @IsOptional() @IsString()
  genero?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  duration?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of duration.' })
  @IsOptional() @IsString()
  duracao?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  publisher?: string;

  @ApiPropertyOptional({ deprecated: true, description: 'Deprecated alias of publisher.' })
  @IsOptional() @IsString()
  editora?: string;
}

export class ConfigureSoundCloudDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  clientId!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  clientSecret!: string;
}

export class OAuthCodeStateDto {
  @ApiProperty({ description: 'Authorization code returned by the platform (Instagram/TikTok/Google Ads)' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Opaque state issued by /oauth/init, used to correlate the callback' })
  @IsString() @IsNotEmpty()
  state!: string;
}

export class AutentiqueWebhookDto {
  @ApiProperty({ description: 'Event type sent by Autentique (e.g. document.signed)' })
  @IsString() @IsNotEmpty()
  event!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  event_id!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  document_id!: string;
}
