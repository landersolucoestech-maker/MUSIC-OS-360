import { IsString, IsOptional, IsNotEmpty, IsBase64, IsIn, IsArray, IsEmail, IsObject, Matches } from 'class-validator';
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
  @ApiProperty({ description: 'Plataforma que iniciará o fluxo OAuth' })
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
  @ApiProperty({ description: 'Código de autorização retornado pela plataforma' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Identificador da plataforma (ex: corp_instagram, corp_tiktok, corp_youtube)' })
  @IsString() @IsNotEmpty()
  @IsIn([
    'corp_instagram', 'meta_business', 'meta_ads',
    'corp_tiktok', 'tiktok_business', 'tiktok_ads',
    'corp_youtube', 'youtube_business', 'google_business', 'google_ads', 'youtube_ads',
    'docusign', 'stripe_connect',
  ])
  platform!: string;

  @ApiProperty({ description: 'Token de troca de uso único emitido por POST /oauth/init (substitui redirect_uri)' })
  @IsString() @IsNotEmpty()
  exchange_token!: string;
}

export class ConfigureAutentiqueDto {
  @ApiProperty({ description: 'Token de API da Autentique' })
  @IsString() @IsNotEmpty()
  apiToken!: string;
}

export class AutentiqueSignerDto {
  @ApiProperty({ description: 'Nome do signatário' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'E-mail do signatário' })
  @IsEmail()
  email!: string;
}

export class CreateAutentiqueDocumentDto {
  @ApiProperty({ description: 'Nome do documento' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Conteúdo do arquivo em base64' })
  @IsString() @IsBase64()
  fileBase64!: string;

  @ApiProperty({ description: 'Lista de signatários', type: 'array' })
  @IsArray()
  signers!: AutentiqueSignerDto[];

  @ApiPropertyOptional({ description: 'ID do contrato interno vinculado ao documento' })
  @IsOptional() @IsString()
  contractId?: string;
}

export class SendForSignatureDto {
  @ApiProperty({ description: 'ID do contrato na plataforma' })
  @IsString() @IsNotEmpty()
  contractId!: string;

  @ApiProperty({ description: 'Nome do documento' })
  @IsString() @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Conteúdo do ficheiro em base64' })
  @IsString() @IsBase64()
  fileBase64!: string;

  @ApiProperty({ description: 'Lista de signatários', type: 'array' })
  @IsArray()
  signers!: AutentiqueSignerDto[];
}

export class RecognizeAudioDto {
  @ApiProperty({ description: 'Áudio em base64 (mp3, wav)' })
  @IsString() @IsBase64()
  audioBase64!: string;
}

export class SpotifyConnectDto {
  @ApiProperty({ description: 'Código OAuth devolvido pelo Spotify' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'State passado no fluxo OAuth' })
  @IsString() @IsNotEmpty()
  state!: string;
}

export class SyncSpotifyArtistDto {
  @ApiProperty({ description: 'URL do perfil do artista no Spotify' })
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
  @ApiProperty({ description: 'ID do provider distribuidor registrado (não há default — nenhum provider real está registrado em produção)' })
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
  @ApiProperty({ description: 'ID do provider de sociedade/PRO registrado (não há default — nenhum provider real está registrado em produção)' })
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
  @ApiProperty({ description: 'ID do provider registrado (não há default — nenhum provider real está registrado em produção)' })
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

export class RegisterAbramusWorkDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  titulo!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  compositor!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  iswc?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  genero?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  duracao?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  editora?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  coautores?: string[];
}

export class ConfigureSoundCloudDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  clientId!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  clientSecret!: string;
}

export class OAuthCodeStateDto {
  @ApiProperty({ description: 'Código de autorização retornado pela plataforma (Instagram/TikTok/Google Ads)' })
  @IsString() @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'State opaco emitido em /oauth/init, usado para correlacionar o callback' })
  @IsString() @IsNotEmpty()
  state!: string;
}

export class AutentiqueWebhookDto {
  @ApiProperty({ description: 'Tipo de evento enviado pela Autentique (ex: document.signed)' })
  @IsString() @IsNotEmpty()
  event!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  event_id!: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  document_id!: string;
}
