import {
  IsString, IsOptional, MaxLength, IsObject, IsArray, IsEnum, IsNumber, Matches, IsUUID, ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArtistStatus } from '@music-os-360/types';
import { APPLE_MUSIC_URL_PATTERN } from '../platform-profiles/apple-music-url.util';
import { ARTIST_GENDERS, ARTIST_PROFILE_TYPES, ARTIST_SPECIALTIES } from '../artist-legacy-fields';
import { HasHttpUrlItems, IsHttpUrl } from '../artist-url.validation';

// The same patterns used by the manual-sync extractors
// (artist-external-profile-sync.service.ts extractDeezerArtistId/
// extractSoundCloudSlug/extractInstagramUsername/extractTikTokUsername) —
// applied here to create/update too, so the format is validated at the same
// time for every platform (spotify/youtube were already validated here; the
// others were only validated in the manual sync flow).
const DEEZER_URL_PATTERN = /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?artist\/\d+(?:[/?#].*)?$/i;
const SOUNDCLOUD_URL_PATTERN = /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/i;
const INSTAGRAM_URL_PATTERN = /^https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(?:[?#].*)?$/i;
const TIKTOK_URL_PATTERN = /^https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._]{1,24}\/?(?:[?#].*)?$/i;

const DEPRECATED = (canonical: string) => ({ deprecated: true, description: `Deprecated (CZ-042): use "${canonical}".` });

/**
 * CZ-042: every key is the canonical English name — the physical column
 * (artists.*), the decrypted wire key of an encrypted column (email, phone,
 * cpf_cnpj, manager_contact) or a metadata-only key (gender, instagram_url,
 * tiktok_url, platform metrics). The pre-CZ-042 Portuguese names are accepted
 * as deprecated input and mapped by canonicalizeArtistInput
 * (artist-legacy-fields.ts) before persistence. MaxLength mirrors the column.
 */
export class CreateArtistDto {
  // Required on create — enforced by the service after the deprecated
  // `nome_artistico` alias is mapped (PT-BR error, see ArtistsService.create).
  @ApiPropertyOptional({ example: 'Seu Jorge', description: 'Required on create.' })
  @IsOptional() @IsString() @MaxLength(255)
  stage_name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) full_name?: string;
  @ApiPropertyOptional({ enum: ArtistStatus }) @IsOptional() @IsEnum(ArtistStatus) status?: ArtistStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) music_genre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsHttpUrl() photo_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]{22}(?:[/?#].*)?$/i, { message: 'Informe uma URL válida do Spotify' }) spotify_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:@[^/?#]+|channel\/UC[A-Za-z0-9_-]{22})(?:[/?#].*)?|music\.youtube\.com\/(?:.*))$/i, { message: 'Informe uma URL válida do YouTube' }) youtube_url?: string;
  @ApiPropertyOptional({ enum: ARTIST_SPECIALTIES, isArray: true }) @IsOptional() @IsArray() specialties?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cpf_cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Personal ─────────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '1990-01-31' }) @IsOptional() @IsString() birth_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) rg?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional({ enum: ARTIST_GENDERS }) @IsOptional() @IsString() gender?: string;

  // ── Banking ──────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) bank_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) bank_branch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) bank_account?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) pix_key?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) account_holder?: string;

  // ── Extra platforms ──────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DEEZER_URL_PATTERN, { message: 'Informe uma URL válida do Deezer' }) deezer_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(APPLE_MUSIC_URL_PATTERN, { message: 'Informe uma URL válida do Apple Music' }) apple_music_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(SOUNDCLOUD_URL_PATTERN, { message: 'Informe uma URL válida do SoundCloud' }) soundcloud_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(INSTAGRAM_URL_PATTERN, { message: 'Informe uma URL válida do Instagram' }) instagram_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(TIKTOK_URL_PATTERN, { message: 'Informe uma URL válida do TikTok' }) tiktok_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() spotify_listeners?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() youtube_subscribers?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() deezer_fans?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() apple_music_albums?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() soundcloud_followers?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() instagram_followers?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tiktok_followers?: number;

  // ── Profile / Relationships ──────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: ARTIST_PROFILE_TYPES }) @IsOptional() @IsString() @MaxLength(30) profile_type?: string;
  // "Empresário" (agent) — distinct from manager_* ("Manager", team section).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) agent_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) agent_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) agent_phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) agent_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) record_label_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) record_label_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) record_label_phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) record_label_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) record_label_contact_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) record_label_contact_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) record_label_contact_phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) record_label_contact_email?: string;
  // Items: { type, name, phone, email, office?, crc?, responsibles?: [{ name, phone, email }], distributors?: [{ customName?, ... }] }
  @ApiPropertyOptional() @IsOptional() @IsArray() relationships?: unknown[];

  // ── Distributors ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsObject() selected_distributors?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsObject() distributor_emails?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() company_selected_distributors?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsObject() company_distributor_emails?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsArray() general_distributors?: unknown[];

  // ── Documents / media ────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsHttpUrl({ each: true }) gallery_urls?: string[];
  // Items: { name, url }
  @ApiPropertyOptional() @IsOptional() @IsArray() @HasHttpUrlItems('url') documents?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() @IsHttpUrl() personal_documents_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsHttpUrl() press_kit_url?: string;

  // ── Team / Contacts ──────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) manager_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manager_contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) executive_producer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) booking_agency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) partner_label?: string;
  // Links to CRM contacts (references only: { contactId, distributors? })
  @ApiPropertyOptional() @IsOptional() @IsArray() linked_contacts?: unknown[];
  // @deprecated Embedded contacts (legacy / public self-signup): { name, category, phone, email, distributors }.
  @ApiPropertyOptional() @IsOptional() @IsArray() team_contacts?: unknown[];

  // ── Internal ─────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() internal_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) artist_slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() music_tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) career_stage?: string;

  // ── Contract ─────────────────────────────────────────────────────────────────
  // '' = no contract (blank select); any other value must be a UUID (400, never a Postgres cast 500).
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== '') @IsUUID() contract_id?: string;

  // ── Deprecated Portuguese names (CZ-042, ARTIST_DEPRECATED_FIELDS) ───────────
  @ApiPropertyOptional(DEPRECATED('stage_name')) @IsOptional() @IsString() @MaxLength(255) nome_artistico?: string;
  @ApiPropertyOptional(DEPRECATED('full_name')) @IsOptional() @IsString() @MaxLength(255) nome_civil?: string;
  @ApiPropertyOptional(DEPRECATED('photo_url')) @IsOptional() @IsString() @IsHttpUrl() foto_url?: string;
  @ApiPropertyOptional(DEPRECATED('gallery_urls')) @IsOptional() @IsArray() @IsHttpUrl({ each: true }) galeria_urls?: string[];
  @ApiPropertyOptional(DEPRECATED('specialties')) @IsOptional() @IsArray() especialidades?: string[];
  @ApiPropertyOptional(DEPRECATED('personal_documents_url')) @IsOptional() @IsString() @IsHttpUrl() documentos_pessoais_url?: string;
  @ApiPropertyOptional(DEPRECATED('press_kit_url')) @IsOptional() @IsString() @IsHttpUrl() presskit_url?: string;
  @ApiPropertyOptional(DEPRECATED('birth_date')) @IsOptional() @IsString() data_nascimento?: string;
  @ApiPropertyOptional(DEPRECATED('address')) @IsOptional() @IsString() @MaxLength(300) endereco?: string;
  @ApiPropertyOptional(DEPRECATED('phone')) @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional(DEPRECATED('bank_name')) @IsOptional() @IsString() @MaxLength(100) banco?: string;
  @ApiPropertyOptional(DEPRECATED('bank_branch')) @IsOptional() @IsString() @MaxLength(30) agencia?: string;
  @ApiPropertyOptional(DEPRECATED('bank_account')) @IsOptional() @IsString() @MaxLength(40) conta?: string;
  @ApiPropertyOptional(DEPRECATED('pix_key')) @IsOptional() @IsString() @MaxLength(150) chave_pix?: string;
  @ApiPropertyOptional(DEPRECATED('account_holder')) @IsOptional() @IsString() @MaxLength(150) titular_conta?: string;
  @ApiPropertyOptional(DEPRECATED('profile_type')) @IsOptional() @IsString() @MaxLength(30) tipo_perfil?: string;
  @ApiPropertyOptional(DEPRECATED('artist_slug')) @IsOptional() @IsString() @MaxLength(160) slug_artistico?: string;
  @ApiPropertyOptional(DEPRECATED('music_tags')) @IsOptional() @IsArray() tags_musicais?: string[];
  @ApiPropertyOptional(DEPRECATED('career_stage')) @IsOptional() @IsString() @MaxLength(60) fase_carreira?: string;
  @ApiPropertyOptional(DEPRECATED('relationships')) @IsOptional() @IsArray() relacionamentos?: unknown[];
  @ApiPropertyOptional(DEPRECATED('agent_id')) @IsOptional() @IsString() @MaxLength(64) empresario_id?: string;
  @ApiPropertyOptional(DEPRECATED('agent_name')) @IsOptional() @IsString() @MaxLength(150) empresario_nome?: string;
  @ApiPropertyOptional(DEPRECATED('agent_phone')) @IsOptional() @IsString() @MaxLength(30) empresario_telefone?: string;
  @ApiPropertyOptional(DEPRECATED('agent_email')) @IsOptional() @IsString() @MaxLength(150) empresario_email?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_id')) @IsOptional() @IsString() @MaxLength(64) gravadora_id?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_name')) @IsOptional() @IsString() @MaxLength(150) gravadora_nome?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_phone')) @IsOptional() @IsString() @MaxLength(30) gravadora_telefone?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_email')) @IsOptional() @IsString() @MaxLength(150) gravadora_email?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_contact_id')) @IsOptional() @IsString() @MaxLength(64) gravadora_responsavel_id?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_contact_name')) @IsOptional() @IsString() @MaxLength(150) gravadora_responsavel_nome?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_contact_phone')) @IsOptional() @IsString() @MaxLength(30) gravadora_responsavel_telefone?: string;
  @ApiPropertyOptional(DEPRECATED('record_label_contact_email')) @IsOptional() @IsString() @MaxLength(150) gravadora_responsavel_email?: string;
  @ApiPropertyOptional(DEPRECATED('selected_distributors')) @IsOptional() @IsObject() distribuidoras_selecionadas?: Record<string, boolean>;
  @ApiPropertyOptional(DEPRECATED('distributor_emails')) @IsOptional() @IsObject() distribuidoras_emails?: Record<string, string>;
  @ApiPropertyOptional(DEPRECATED('company_selected_distributors')) @IsOptional() @IsObject() distribuidoras_empresa_selecionadas?: Record<string, boolean>;
  @ApiPropertyOptional(DEPRECATED('company_distributor_emails')) @IsOptional() @IsObject() distribuidoras_empresa_emails?: Record<string, string>;
  @ApiPropertyOptional(DEPRECATED('general_distributors')) @IsOptional() @IsArray() distribuidoras_gerais?: unknown[];
  @ApiPropertyOptional(DEPRECATED('linked_contacts')) @IsOptional() @IsArray() contatos_vinculados?: unknown[];
  @ApiPropertyOptional(DEPRECATED('team_contacts')) @IsOptional() @IsArray() contatos_equipe?: unknown[];
  @ApiPropertyOptional(DEPRECATED('internal_notes')) @IsOptional() @IsString() notas_internas?: string;
  @ApiPropertyOptional(DEPRECATED('manager_name')) @IsOptional() @IsString() @MaxLength(255) manager_nome?: string;
  @ApiPropertyOptional(DEPRECATED('manager_contact')) @IsOptional() @IsString() manager_contato?: string;
  @ApiPropertyOptional(DEPRECATED('executive_producer')) @IsOptional() @IsString() @MaxLength(255) produtor_executivo?: string;
  @ApiPropertyOptional(DEPRECATED('booking_agency')) @IsOptional() @IsString() @MaxLength(255) agencia_booking?: string;
  @ApiPropertyOptional(DEPRECATED('partner_label')) @IsOptional() @IsString() @MaxLength(255) label_parceira?: string;
  @ApiPropertyOptional(DEPRECATED('contract_id')) @IsOptional() @ValidateIf((_, v) => v !== '') @IsUUID() contrato_id?: string;
  @ApiPropertyOptional(DEPRECATED('gender')) @IsOptional() @IsString() genero?: string;
  @ApiPropertyOptional(DEPRECATED('spotify_listeners')) @IsOptional() @IsNumber() spotify_ouvintes?: number;
  @ApiPropertyOptional(DEPRECATED('youtube_subscribers')) @IsOptional() @IsNumber() youtube_inscritos?: number;
  @ApiPropertyOptional(DEPRECATED('deezer_fans')) @IsOptional() @IsNumber() deezer_fas?: number;
  @ApiPropertyOptional(DEPRECATED('apple_music_albums')) @IsOptional() @IsNumber() apple_music_albuns_url?: number;
  @ApiPropertyOptional(DEPRECATED('soundcloud_followers')) @IsOptional() @IsNumber() soundcloud_seguidores_url?: number;
  @ApiPropertyOptional(DEPRECATED('instagram_followers')) @IsOptional() @IsNumber() instagram_seguidores?: number;
  @ApiPropertyOptional(DEPRECATED('tiktok_followers')) @IsOptional() @IsNumber() tiktok_seguidores?: number;
}
