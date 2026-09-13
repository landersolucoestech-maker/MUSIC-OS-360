import {
  IsString, IsOptional, MaxLength, IsObject, IsArray, IsEnum, IsNumber, IsUUID, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArtistStatus } from '@music-os-360/types';
import { APPLE_MUSIC_URL_PATTERN } from '../platform-profiles/apple-music-url.util';

// Mesmos padrões usados pelos extractors de sync manual
// (artist-external-profile-sync.service.ts extractDeezerArtistId/
// extractSoundCloudSlug/extractInstagramUsername/extractTikTokUsername) —
// aqui aplicados também no create/update, para que o formato seja validado
// no mesmo momento para todas as plataformas (spotify/youtube já validavam
// aqui; as demais só eram validadas no fluxo de sync manual).
const DEEZER_URL_PATTERN = /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?artist\/\d+(?:[/?#].*)?$/i;
const SOUNDCLOUD_URL_PATTERN = /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/i;
const INSTAGRAM_URL_PATTERN = /^https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(?:[?#].*)?$/i;
const TIKTOK_URL_PATTERN = /^https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._]{1,24}\/?(?:[?#].*)?$/i;

export class CreateArtistDto {
  @ApiProperty({ example: 'Seu Jorge' })
  @IsString()
  @MaxLength(255)
  nome_artistico!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) nome_civil?: string;
  @ApiPropertyOptional({ enum: ArtistStatus }) @IsOptional() @IsEnum(ArtistStatus) status?: ArtistStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) genero_musical?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() foto_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]{22}(?:[/?#].*)?$/i, { message: 'Informe uma URL válida do Spotify' }) spotify_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:@[^/?#]+|channel\/UC[A-Za-z0-9_-]{22})(?:[/?#].*)?|music\.youtube\.com\/(?:.*))$/i, { message: 'Informe uma URL válida do YouTube' }) youtube_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() especialidades?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cpf_cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  // ── Pessoal ──────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() data_nascimento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rg?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endereco?: string;

  // ── Bancário ─────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() banco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() conta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chave_pix?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() titular_conta?: string;

  // ── Plataformas extras ───────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DEEZER_URL_PATTERN, { message: 'Informe uma URL válida do Deezer' }) deezer_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(APPLE_MUSIC_URL_PATTERN, { message: 'Informe uma URL válida do Apple Music' }) apple_music_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(SOUNDCLOUD_URL_PATTERN, { message: 'Informe uma URL válida do SoundCloud' }) soundcloud_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(INSTAGRAM_URL_PATTERN, { message: 'Informe uma URL válida do Instagram' }) instagram_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(TIKTOK_URL_PATTERN, { message: 'Informe uma URL válida do TikTok' }) tiktok_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() spotify_ouvintes?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() youtube_inscritos?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() deezer_fas?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() apple_music_albuns_url?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() soundcloud_seguidores_url?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() instagram_seguidores?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() tiktok_seguidores?: number;

  // ── Perfil / Relacionamentos ──────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() tipo_perfil?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() empresario_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() empresario_nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() empresario_telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() empresario_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_responsavel_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_responsavel_nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_responsavel_telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gravadora_responsavel_email?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() relacionamentos?: unknown[];

  // ── Distribuidoras ────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsObject() distribuidoras_selecionadas?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsObject() distribuidoras_emails?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() distribuidoras_empresa_selecionadas?: Record<string, boolean>;
  @ApiPropertyOptional() @IsOptional() @IsObject() distribuidoras_empresa_emails?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsArray() distribuidoras_gerais?: unknown[];

  // ── Documentos / Mídia ───────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsArray() galeria_urls?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() documents?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsString() documentos_pessoais_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() presskit_url?: string;

  // ── Equipe / Contatos ────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() manager_nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manager_contato?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() produtor_executivo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agencia_booking?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() label_parceira?: string;
  // Vínculos com contatos do CRM (apenas referências: { contactId, distribuidoras? })
  @ApiPropertyOptional() @IsOptional() @IsArray() contatos_vinculados?: unknown[];
  // @deprecated Contatos embutidos (legado / auto-cadastro público). Mantido para retrocompat.
  @ApiPropertyOptional() @IsOptional() @IsArray() contatos_equipe?: unknown[];

  // ── Interno ───────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() notas_internas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug_artistico?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() tags_musicais?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() fase_carreira?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() genero?: string;

  // ── Contrato ─────────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() contrato_id?: string;
}
