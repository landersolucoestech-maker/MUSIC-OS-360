> Historical record. Kept as recorded; not the current contract.

# Tabelas e Colunas — Schema `public` (zero exceções)

Total de tabelas: 142. Total de colunas: 2382.

## `public.activity_logs`

ROW_COUNT_ESTIMATE: 14 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| entity_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| entity_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| description | text | text | NO |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| user_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| user_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| user_avatar_url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.ai_jobs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| user_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| provider | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| model | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| skill | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 12 |
| input_tokens | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 12 |
| output_tokens | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 12 |
| cost_usd | numeric | numeric | NO | 0 | NO | NEVER |  |  |  | 12 |
| latency_ms | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| completed_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |

## `public.ai_usage_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| job_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| model | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| feature | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| tokens_input | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| tokens_output | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| cost_usd | numeric | numeric | NO | 0 | NO | NEVER |  |  |  | 9 |
| latency_ms | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| outcome | character varying | varchar | NO | 'success'::character varying | NO | NEVER |  |  |  | 9 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.artist_goals`

ROW_COUNT_ESTIMATE: 3 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| artista_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| meta_valor | numeric | numeric | YES |  | NO | NEVER |  |  |  | 11 |
| valor_atual | numeric | numeric | NO | 0 | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'em_andamento'::character varying | NO | NEVER |  |  |  | 11 |
| periodo | character varying | varchar | NO | 'mensal'::character varying | NO | NEVER |  |  |  | 11 |
| data_inicio | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| data_fim | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |

## `public.artist_platform_profiles`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 8 |
| artist_id | uuid | uuid | NO |  | NO | NEVER |  | public.artists.id (CASCADE) | SIM | 8 |
| platform | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 8 |
| external_id | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| external_url | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| display_name | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| username | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| profile_url | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| image_url | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| followers | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| subscribers | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| monthly_listeners | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| popularity | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| total_views | bigint | int8 | YES |  | NO | NEVER |  |  |  | 8 |
| total_videos | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| total_tracks | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| total_albums | integer | int4 | YES |  | NO | NEVER |  |  |  | 8 |
| raw_payload | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| sync_status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 8 |
| last_synced_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |
| last_error | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.artists`

ROW_COUNT_ESTIMATE: 2 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 12 |
| foto_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| nome_artistico | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| genero_musical | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| especialidades | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| documentos_pessoais_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| presskit_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| nome_civil | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| data_nascimento | date | date | YES |  | NO | NEVER |  |  |  | 12 |
| cpf_cnpj_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| rg | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| genero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| endereco | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| telefone_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| email_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| banco | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| agencia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| conta | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| chave_pix | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| titular_conta | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| spotify_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| instagram | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| youtube_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| tiktok | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| soundcloud_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| apple_music_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| deezer_url | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| tipo_perfil | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| contatos_vinculados | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| distribuidoras_gerais | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| notas_internas | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| contrato_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 12 |
| slug_artistico | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| tags_musicais | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| fase_carreira | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| tipo | character varying | varchar | NO | 'solo'::character varying | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'em_negociacao'::character varying | NO | NEVER |  |  |  | 12 |
| status_cadastro | character varying | varchar | NO | 'ativo'::character varying | NO | NEVER |  |  |  | 12 |
| spotify_ouvintes | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| youtube_inscritos | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| deezer_fas | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| apple_music_albuns | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| soundcloud_seguidores | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| instagram_seguidores | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| tiktok_seguidores | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| relacionamentos | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| empresario_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| empresario_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| empresario_telefone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| empresario_email | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_telefone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_email | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_responsavel_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_responsavel_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_responsavel_telefone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| gravadora_responsavel_email | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| distribuidoras_selecionadas | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| distribuidoras_emails | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| distribuidoras_empresa_selecionadas | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| distribuidoras_empresa_emails | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| contatos_equipe | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 12 |
| manager_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| manager_contato_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| produtor_executivo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| agencia_booking | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| label_parceira | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| galeria_urls | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| documentos | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 12 |

## `public.asset_usage_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 6 |
| target_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| target_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| actor_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 6 |

## `public.asset_versions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 6 |
| file_url | text | text | NO |  | NO | NEVER |  |  |  | 6 |
| thumbnail_url | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| mime_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| size_bytes | bigint | int8 | YES |  | NO | NEVER |  |  |  | 6 |
| change_notes | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 6 |

## `public.assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| asset_type | character varying | varchar | NO | 'unknown'::character varying | NO | NEVER |  |  |  | 9 |
| mime_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'active'::character varying | NO | NEVER |  |  |  | 9 |
| source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| source_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| current_version_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.audiovisual_approvals`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| deliverable_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| requested_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| approved_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| rejected_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 10 |
| comments | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| revision_round | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 10 |
| requested_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| approved_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| rejected_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |

## `public.audiovisual_assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| kind | character varying | varchar | NO | 'other'::character varying | NO | NEVER |  |  |  | 11 |
| file_url | text | text | NO |  | NO | NEVER |  |  |  | 11 |
| thumbnail_url | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| mime_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| size_bytes | bigint | int8 | YES |  | NO | NEVER |  |  |  | 11 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| tags | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| uploaded_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |

## `public.audiovisual_briefings`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 11 |
| concept | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| visual_style | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| references_list | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| target_audience | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| platforms | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| format_requirements | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| aspect_ratios | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| color_palette | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| moodboard_links | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| inspiration_notes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| campaign_alignment | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| artist_notes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| manager_notes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| technical_notes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |

## `public.audiovisual_deliverables`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 13 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 13 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 13 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| type | character varying | varchar | NO | 'youtube_master'::character varying | NO | NEVER |  |  |  | 13 |
| platform | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| format | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| resolution | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| duration_sec | integer | int4 | YES |  | NO | NEVER |  |  |  | 13 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 13 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 13 |
| approved | boolean | bool | NO | false | NO | NEVER |  |  |  | 13 |
| published | boolean | bool | NO | false | NO | NEVER |  |  |  | 13 |
| file_url | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| thumbnail_url | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| published_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 13 |
| delivery_notes | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 13 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 13 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 13 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 13 |

## `public.audiovisual_production_days`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| shooting_date | date | date | NO |  | NO | NEVER |  |  |  | 8 |
| call_time | time without time zone | time | YES |  | NO | NEVER |  |  |  | 8 |
| end_time | time without time zone | time | YES |  | NO | NEVER |  |  |  | 8 |
| location | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| weather_notes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| team_notes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| production_notes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'scheduled'::character varying | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.audiovisual_projects`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) |  | 11 |
| phonogram_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| music_title | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| artist_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| type | character varying | varchar | NO | 'music_video'::character varying | NO | NEVER |  |  |  | 11 |
| format | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| director | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| videomaker | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| editor | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| shooting_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| location | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| capture_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| editing_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| approval_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| pre_release_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| release_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| budget_estimated | numeric | numeric | YES |  | NO | NEVER |  |  |  | 11 |
| budget_actual | numeric | numeric | YES |  | NO | NEVER |  |  |  | 11 |
| concept | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| observations | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 11 |
| final_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| completed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| publish_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| release_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| campaign_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| event_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| financial_project_id | uuid | uuid | YES |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) |  | 11 |
| slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| objective | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 11 |
| stage | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| production_company | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| producer | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| start_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| recording_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| delivery_date | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |

## `public.audiovisual_shots`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| ordering | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 12 |
| scene_title | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| location | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| actors | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| props | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| wardrobe | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| equipment | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| estimated_duration_sec | integer | int4 | YES |  | NO | NEVER |  |  |  | 12 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| shooting_status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |

## `public.audiovisual_tasks`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 12 |
| priority | character varying | varchar | NO | 'medium'::character varying | NO | NEVER |  |  |  | 12 |
| assigned_to | uuid | uuid | YES |  | NO | NEVER |  |  |  | 12 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| completed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| auto_generated | boolean | bool | NO | false | NO | NEVER |  |  |  | 12 |
| auto_stage | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |

## `public.audiovisual_team_members`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| audiovisual_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| user_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| external_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| role | character varying | varchar | NO | 'other'::character varying | NO | NEVER |  |  |  | 8 |
| contact | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| payment_amount | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| payment_status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 8 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.audit_logs`

ROW_COUNT_ESTIMATE: 1765 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| entity | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| entity_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| before | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 5 |
| after | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 5 |
| ip_address | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| user_agent | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| request_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 5 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 5 |
| org_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |
| actor_role | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| diff | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 5 |
| correlation_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| session_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| http_method | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| http_path | text | text | YES |  | NO | NEVER |  |  |  | 5 |

## `public.billing_plans`

ROW_COUNT_ESTIMATE: 3 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 14 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 14 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 14 |
| amount | integer | int4 | NO |  | NO | NEVER |  |  |  | 14 |
| currency | character varying | varchar | NO | 'brl'::character varying | NO | NEVER |  |  |  | 14 |
| interval | character varying | varchar | NO | 'month'::character varying | NO | NEVER |  |  |  | 14 |
| active | boolean | bool | NO | true | NO | NEVER |  |  |  | 14 |
| features | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 14 |
| limits | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 14 |
| stripe_product_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| stripe_price_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 14 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 14 |

## `public.billing_settings`

ROW_COUNT_ESTIMATE: 1 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 5 |
| value | jsonb | jsonb | NO |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.billing_subscriptions`

ROW_COUNT_ESTIMATE: 4 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| org_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| stripe_customer_id | character varying | varchar | YES |  | NO | NEVER |  |  | SIM | 11 |
| stripe_sub_id | character varying | varchar | YES |  | NO | NEVER |  |  | SIM | 11 |
| plan | character varying | varchar | NO | 'starter'::character varying | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'trial'::character varying | NO | NEVER |  |  |  | 11 |
| trial_ends_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| current_period_end | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| seats | integer | int4 | NO | 3 | NO | NEVER |  |  |  | 11 |
| seats_used | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| stripe_subscription_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| stripe_price_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| current_period_start | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| cancel_at_period_end | boolean | bool | NO | false | NO | NEVER |  |  |  | 11 |
| grace_until | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| suspended_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| resumed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |

## `public.briefings`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| campanha_id | uuid | uuid | YES |  | NO | NEVER |  | public.campaigns.id (SET NULL) |  | 7 |
| status | character varying | varchar | NO | 'rascunho'::character varying | NO | NEVER |  |  |  | 7 |
| prazo | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |

## `public.budget_revisions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.budgets.tenant_id (CASCADE) | SIM | 8 |
| budget_id | uuid | uuid | NO |  | NO | NEVER |  | public.budgets.tenant_id (CASCADE) |  | 8 |
| previous_amount | numeric | numeric | NO |  | NO | NEVER |  |  |  | 8 |
| new_amount | numeric | numeric | NO |  | NO | NEVER |  |  |  | 8 |
| reason | text | text | NO |  | NO | NEVER |  |  |  | 8 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.budgets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) | SIM | 11 |
| project_id | uuid | uuid | NO |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) |  | 11 |
| amount | numeric | numeric | NO |  | NO | NEVER |  |  |  | 11 |
| currency | character | bpchar | NO | 'BRL'::bpchar | NO | NEVER |  |  |  | 11 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 11 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |

## `public.campaign_assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.campaigns.id (CASCADE) |  | 8 |
| campaign_id | uuid | uuid | NO |  | NO | NEVER |  | public.campaigns.id (CASCADE) |  | 8 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| asset_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| file_url | text | text | NO |  | NO | NEVER |  |  |  | 8 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.campaign_tasks`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.campaigns.id (CASCADE) |  | 8 |
| campaign_id | uuid | uuid | NO |  | NO | NEVER |  | public.campaigns.id (CASCADE) |  | 8 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 8 |
| priority | character varying | varchar | NO | 'medium'::character varying | NO | NEVER |  |  |  | 8 |
| assigned_to | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |
| completed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |

## `public.campaigns`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 8 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'rascunho'::character varying | NO | NEVER |  |  |  | 8 |
| objetivo | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| orcamento | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| data_inicio | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| data_fim | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |

## `public.client_attachments`

ROW_COUNT_ESTIMATE: 1 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.clients.tenant_id (NO ACTION) |  | 8 |
| client_id | uuid | uuid | NO |  | NO | NEVER |  | public.clients.id (NO ACTION) |  | 8 |
| storage_key | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| filename | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| mime_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| size_bytes | bigint | int8 | NO |  | NO | NEVER |  |  |  | 8 |
| checksum | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| uploaded_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |

## `public.clients`

ROW_COUNT_ESTIMATE: 19 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 10 |
| tipo_pessoa | character varying | varchar | NO | 'pessoa_juridica'::character varying | NO | NEVER |  |  |  | 10 |
| categoria | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| perfil | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| foto | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| nome_pf | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| razao_social | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| nome_fantasia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| cpf_cnpj_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| email_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| telefone_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| instagram | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| funcao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| logradouro | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| numero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| complemento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| bairro | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| cidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| estado | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| cep | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| endereco_completo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| status_contato | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| prioridade_contato | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| responsavel_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| responsavel_cargo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| responsavel_email | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| responsavel_telefone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| attachments | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 10 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| interacoes | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'ativo'::character varying | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |

## `public.content_detections`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| obra_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| plataforma | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| titulo_detectado | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| score | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 9 |
| tipo | character varying | varchar | NO | 'uso_nao_autorizado'::character varying | NO | NEVER |  |  |  | 9 |
| detectado_em | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.contract_service_types`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 20 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 20 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 20 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 20 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 20 |
| category | character varying | varchar | YES |  | NO | NEVER |  |  |  | 20 |
| client_types | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 20 |
| financial_model | character varying | varchar | NO | 'valor_fixo'::character varying | NO | NEVER |  |  |  | 20 |
| requires_external_rights_terms | boolean | bool | NO | false | NO | NEVER |  |  |  | 20 |
| requires_fixed_value | boolean | bool | NO | false | NO | NEVER |  |  |  | 20 |
| requires_advance | boolean | bool | NO | false | NO | NEVER |  |  |  | 20 |
| requires_financial_support | boolean | bool | NO | false | NO | NEVER |  |  |  | 20 |
| allow_installments | boolean | bool | NO | false | NO | NEVER |  |  |  | 20 |
| default_financial_category | character varying | varchar | YES |  | NO | NEVER |  |  |  | 20 |
| active | boolean | bool | NO | true | NO | NEVER |  |  |  | 20 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 20 |
| header_image_url | text | text | YES |  | NO | NEVER |  |  |  | 20 |
| footer_image_url | text | text | YES |  | NO | NEVER |  |  |  | 20 |
| conteudo | text | text | NO | ''::text | NO | NEVER |  |  |  | 20 |
| participants | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 20 |
| variables | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 20 |
| music_work | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 20 |
| signature_settings | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 20 |
| branding_settings | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 20 |
| financial_currency | character varying | varchar | NO | 'BRL'::character varying | NO | NEVER |  |  |  | 20 |
| financial_payment_frequency | character varying | varchar | NO | 'unico'::character varying | NO | NEVER |  |  |  | 20 |
| financial_penalty_percentage | numeric | numeric | YES |  | NO | NEVER |  |  |  | 20 |
| financial_interest_percentage | numeric | numeric | YES |  | NO | NEVER |  |  |  | 20 |
| financial_due_days | integer | int4 | YES |  | NO | NEVER |  |  |  | 20 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 20 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 20 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 20 |

## `public.contract_templates`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| conteudo | text | text | NO |  | NO | NEVER |  |  |  | 9 |
| variaveis | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 9 |
| ativo | boolean | bool | NO | true | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |

## `public.contracts`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 10 |
| template_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'rascunho'::character varying | NO | NEVER |  |  |  | 10 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.id (SET NULL) |  | 10 |
| cliente_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| lancamento_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| data_inicio | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |
| data_fim | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |
| valor | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| exclusivo | boolean | bool | NO | false | NO | NEVER |  |  |  | 10 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| arquivo_url | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| autentique_doc_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| signing_platform | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| versoes | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 10 |
| signers | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |

## `public.conversation_messages`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| conversation_id | uuid | uuid | NO |  | NO | NEVER |  | public.conversations.id (CASCADE) |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| body | text | text | NO | ''::text | NO | NEVER |  |  |  | 9 |
| sender_id | text | text | NO |  | NO | NEVER |  |  |  | 9 |
| sender_type | USER-DEFINED | message_sender_type | NO | 'user'::message_sender_type | NO | NEVER |  |  |  | 9 |
| attachments | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.conversation_notes`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| conversation_id | uuid | uuid | NO |  | NO | NEVER |  | public.conversations.id (CASCADE) |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| body | text | text | NO | ''::text | NO | NEVER |  |  |  | 7 |
| author_id | text | text | NO |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.conversations`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 8 |
| contact_id | uuid | uuid | YES |  | NO | NEVER |  | public.leads.id (SET NULL) |  | 8 |
| subject | text | text | NO | ''::text | NO | NEVER |  |  |  | 8 |
| status | USER-DEFINED | conversation_status | NO | 'open'::conversation_status | NO | NEVER |  |  |  | 8 |
| channel | USER-DEFINED | conversation_channel | NO | 'internal'::conversation_channel | NO | NEVER |  |  |  | 8 |
| assigned_to | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| last_message_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_by | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.cost_centers`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 6 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 6 |
| code | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 6 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 6 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 6 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 6 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 6 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 6 |

## `public.counterparties`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.clients.id (NO ACTION) | SIM | 8 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| type | USER-DEFINED | counterparty_type | NO |  | NO | NEVER |  |  |  | 8 |
| document | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| country | character | bpchar | YES |  | NO | NEVER |  |  |  | 8 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.tenant_id (NO ACTION) |  | 8 |
| client_id | uuid | uuid | YES |  | NO | NEVER |  | public.clients.tenant_id (NO ACTION) |  | 8 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.departments`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 9 |
| parent_department_id | uuid | uuid | YES |  | NO | NEVER |  | public.departments.id (SET NULL) |  | 9 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 9 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 9 |

## `public.domain_event_log`

ROW_COUNT_ESTIMATE: 71 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| aggregate_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| aggregate_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| actor_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| correlation_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| payload | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 5 |
| occurred_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 5 |
| processed_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 5 |
| error | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.ecad_reports`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| obra_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| periodo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| valor_bruto | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| valor_liquido | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 8 |
| arquivo_url | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |

## `public.employees`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| nome_completo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| cpf_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| rg | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| data_nascimento | date | date | YES |  | NO | NEVER |  |  |  | 9 |
| email_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| telefone_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| endereco | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| cargo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| setor | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| departamento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tipo_contrato | character varying | varchar | NO | 'clt'::character varying | NO | NEVER |  |  |  | 9 |
| data_admissao | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| data_demissao | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| salario_base | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| salario | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'ativo'::character varying | NO | NEVER |  |  |  | 9 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| vinculo_usuario_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| documentos | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.events`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 9 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| participantes | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'agendado'::character varying | NO | NEVER |  |  |  | 9 |
| data | timestamp without time zone | timestamp | NO |  | NO | NEVER |  |  |  | 9 |
| starts_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| data_fim | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| local | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| contato_local | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| endereco | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| valor_cache | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| publico_esperado | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.external_identifiers`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 14 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 14 |
| entity_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| entity_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 14 |
| provider | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| identifier_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| identifier_value | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| is_primary | boolean | bool | NO | false | NO | NEVER |  |  |  | 14 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 14 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 14 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 14 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |

## `public.financial_accounts`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 10 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| type | USER-DEFINED | account_type | NO |  | NO | NEVER |  |  |  | 10 |
| currency | character | bpchar | NO | 'BRL'::bpchar | NO | NEVER |  |  |  | 10 |
| opening_balance | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| opening_balance_date | date | date | YES |  | NO | NEVER |  |  |  | 10 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |

## `public.financial_categories`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.financial_categories.id (NO ACTION) | SIM | 11 |
| parent_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_categories.id (NO ACTION) | SIM | 11 |
| template_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_category_templates.id (NO ACTION) |  | 11 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 11 |
| nature | USER-DEFINED | category_nature | NO |  | NO | NEVER |  |  |  | 11 |
| includes_in_pnl | boolean | bool | NO | true | NO | NEVER |  |  |  | 11 |
| level | smallint | int2 | NO |  | NO | NEVER |  |  |  | 11 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 11 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |

## `public.financial_category_audit_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| category_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| actor_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| actor_type | character varying | varchar | NO | 'user'::character varying | NO | NEVER |  |  |  | 8 |
| before | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| after | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| ip | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| timestamp | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.financial_category_templates`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| parent_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_category_templates.id (NO ACTION) | SIM | 7 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 7 |
| nature | USER-DEFINED | category_nature | NO |  | NO | NEVER |  |  |  | 7 |
| includes_in_pnl | boolean | bool | NO | true | NO | NEVER |  |  |  | 7 |
| level | smallint | int2 | NO |  | NO | NEVER |  |  |  | 7 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 7 |

## `public.financial_rules`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| categoria | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| calculo | character varying | varchar | NO | 'percentual'::character varying | NO | NEVER |  |  |  | 10 |
| valor | numeric | numeric | NO | 0 | NO | NEVER |  |  |  | 10 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| ativo | boolean | bool | NO | true | NO | NEVER |  |  |  | 10 |
| condicoes | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |

## `public.financial_transactions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 19 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.financial_transactions.id (NO ACTION) | SIM | 19 |
| type | USER-DEFINED | transaction_type | NO |  | NO | NEVER |  |  |  | 19 |
| status | USER-DEFINED | transaction_status | NO | 'pending'::transaction_status | NO | NEVER |  |  |  | 19 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 19 |
| amount | numeric | numeric | NO |  | NO | NEVER |  |  |  | 19 |
| currency | character | bpchar | NO | 'BRL'::bpchar | NO | NEVER |  |  |  | 19 |
| category_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_categories.id (NO ACTION) |  | 19 |
| category_snapshot | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 19 |
| competence_date | date | date | NO |  | NO | NEVER |  |  |  | 19 |
| due_date | date | date | YES |  | NO | NEVER |  |  |  | 19 |
| settlement_date | date | date | YES |  | NO | NEVER |  |  |  | 19 |
| account_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_accounts.tenant_id (NO ACTION) |  | 19 |
| counter_account_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_accounts.id (NO ACTION) |  | 19 |
| counterparty_id | uuid | uuid | YES |  | NO | NEVER |  | public.counterparties.id (NO ACTION) |  | 19 |
| cost_center_id | uuid | uuid | YES |  | NO | NEVER |  | public.cost_centers.id (NO ACTION) |  | 19 |
| contract_id | uuid | uuid | YES |  | NO | NEVER |  | public.contracts.tenant_id (NO ACTION) |  | 19 |
| event_id | uuid | uuid | YES |  | NO | NEVER |  | public.events.tenant_id (NO ACTION) |  | 19 |
| installment_group_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 19 |
| installment_number | smallint | int2 | YES |  | NO | NEVER |  |  |  | 19 |
| installment_count | smallint | int2 | YES |  | NO | NEVER |  |  |  | 19 |
| installment_interval | USER-DEFINED | installment_interval | YES |  | NO | NEVER |  |  |  | 19 |
| reversal_of_id | uuid | uuid | YES |  | NO | NEVER |  | public.financial_transactions.tenant_id (NO ACTION) | SIM | 19 |
| payment_method | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| payment_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| client_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| collecting_agency | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| investment_item | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| travel_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| advertising_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| attachment_url | text | text | YES |  | NO | NEVER |  |  |  | 19 |
| attachment_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 19 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 19 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 19 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 19 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 19 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 19 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 19 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 19 |

## `public.form_submissions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| form_id | uuid | uuid | NO |  | NO | NEVER |  | public.forms.id (CASCADE) |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| lead_id | uuid | uuid | YES |  | NO | NEVER |  | public.leads.id (SET NULL) |  | 6 |
| data | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 6 |
| origin | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| ip | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 6 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 6 |

## `public.forms`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 9 |
| name | text | text | NO |  | NO | NEVER |  |  |  | 9 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| fields | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 9 |
| settings | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| status | USER-DEFINED | form_status | NO | 'draft'::form_status | NO | NEVER |  |  |  | 9 |
| submission_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| created_by | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 9 |

## `public.integrations`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 9 |
| provider | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 9 |
| status | character varying | varchar | NO | 'disconnected'::character varying | NO | NEVER |  |  |  | 9 |
| credentials_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| settings | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| last_sync_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| failure_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.inventory_items`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| categoria | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| quantidade | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 7 |
| valor_unitario | numeric | numeric | YES |  | NO | NEVER |  |  |  | 7 |
| localizacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| status | character varying | varchar | NO | 'disponivel'::character varying | NO | NEVER |  |  |  | 7 |
| responsavel | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| setor | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| data_entrada | date | date | YES |  | NO | NEVER |  |  |  | 7 |
| local_compra | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| numero_nota_fiscal | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |

## `public.invoices`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| numero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 9 |
| prestador_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_doc_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| valor | numeric | numeric | NO |  | NO | NEVER |  |  |  | 9 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| data_emissao | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| data_vencimento | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| arquivo_url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| stripe_invoice_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| amount_due | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| amount_paid | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| currency | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 9 |
| hosted_invoice_url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| invoice_pdf | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| attempt_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| serie | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tipo_nota | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| cliente_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| venda_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| url_pdf | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| natureza_operacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| codigo_servico_municipal | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| codigo_municipio | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| cfop | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| descricao_servicos | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| vencimento | date | date | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_cnpj | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_razao_social | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_inscricao_estadual | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_inscricao_municipal | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_email | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_endereco | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_cidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_uf | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| tomador_cep | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| valor_servicos | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_deducoes | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| base_calculo | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| aliquota_iss | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_iss | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| iss_retido | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| valor_pis | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_cofins | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_inss | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_ir | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_csll | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| valor_liquido | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| forma_pagamento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| condicao_pagamento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| itens | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |

## `public.job_functions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 7 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| category | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |

## `public.lead_interactions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| lead_id | uuid | uuid | NO |  | NO | NEVER |  | public.leads.id (CASCADE) |  | 6 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 6 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| data | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 6 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 6 |

## `public.lead_uploads`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| lead_id | uuid | uuid | NO |  | NO | NEVER |  | public.leads.id (CASCADE) |  | 9 |
| file_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| mime_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| extension | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| size | bigint | int8 | NO |  | NO | NEVER |  |  |  | 9 |
| url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 9 |

## `public.leads`

ROW_COUNT_ESTIMATE: 3 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| nome_completo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| empresa | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| email_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| whatsapp | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| instagram | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| cidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| estado | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| tipo_cliente | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| tipo_servico | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| payload_servico | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| origem_lead | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| responsavel | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'novo'::character varying | NO | NEVER |  |  |  | 10 |
| prioridade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| proximo_follow_up | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| valor_estimado | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| temperatura | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| dados_internos_crm | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| uploads | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 10 |
| pais | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| probabilidade_fechamento | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| nome_artistico | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| telefone_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| cliente_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| fonte | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| tags | ARRAY | _text | NO | '{}'::text[] | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |

## `public.leave_requests`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| funcionario_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| employee_id | uuid | uuid | NO |  | NO | NEVER |  | public.employees.id (RESTRICT) |  | 10 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| data_inicio | timestamp without time zone | timestamp | NO |  | NO | NEVER |  |  |  | 10 |
| data_fim | timestamp without time zone | timestamp | NO |  | NO | NEVER |  |  |  | 10 |
| dias_totais | integer | int4 | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 10 |
| aprovado_por | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| motivo | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| documento_url | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |

## `public.licenses`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| obra_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| obra_musical | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| artista | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| cliente_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| cliente | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| projeto | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| tipo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| tipo_uso | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| midia_destino | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| territorio | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 8 |
| data_inicio | date | date | YES |  | NO | NEVER |  |  |  | 8 |
| data_fim | date | date | YES |  | NO | NEVER |  |  |  | 8 |
| valor | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| moeda | character varying | varchar | NO | 'BRL'::character varying | NO | NEVER |  |  |  | 8 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| remuneration_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |
| percentage | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |

## `public.marketing_asset_approvals`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  | public.marketing_assets.id (CASCADE) |  | 8 |
| version_id | uuid | uuid | NO |  | NO | NEVER |  | public.marketing_asset_versions.id (CASCADE) |  | 8 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 8 |
| requested_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| decided_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| comments | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| requested_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| decided_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.marketing_asset_versions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  | public.marketing_assets.id (CASCADE) |  | 10 |
| version | integer | int4 | NO |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 10 |
| file_url | text | text | NO |  | NO | NEVER |  |  |  | 10 |
| thumbnail_url | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| mime_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| size_bytes | bigint | int8 | YES |  | NO | NEVER |  |  |  | 10 |
| change_notes | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |

## `public.marketing_assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 13 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 13 |
| marketing_project_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| company_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| campaign_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| creative_request_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| audiovisual_project_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| source_upload_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| asset_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 13 |
| current_version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 13 |
| current_version_id | uuid | uuid | YES |  | NO | NEVER |  | public.marketing_asset_versions.id (NO ACTION) |  | 13 |
| file_url | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| thumbnail_url | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| mime_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| size_bytes | bigint | int8 | YES |  | NO | NEVER |  |  |  | 13 |
| tags | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 13 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 13 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 13 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 13 |
| approved_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 13 |
| approved_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 13 |

## `public.marketing_content_posts`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 17 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 17 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| target_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| target_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| channel | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| content_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| status | character varying | varchar | NO | 'agendado'::character varying | NO | NEVER |  |  |  | 17 |
| publication_status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 17 |
| publish_date | date | date | NO |  | NO | NEVER |  |  |  | 17 |
| publish_time | character varying | varchar | NO |  | NO | NEVER |  |  |  | 17 |
| scheduled_for | timestamp with time zone | timestamptz | NO |  | NO | NEVER |  |  |  | 17 |
| copy | text | text | NO |  | NO | NEVER |  |  |  | 17 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 17 |
| owner | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| campaign_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 17 |
| project_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 17 |
| format | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| files | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 17 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 17 |
| publish_job_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| provider_post_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| publication_error | text | text | YES |  | NO | NEVER |  |  |  | 17 |
| published_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 17 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 17 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 17 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 17 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 17 |

## `public.marketing_projects`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 15 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) |  | 15 |
| type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 15 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 15 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 15 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 15 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 15 |
| source_project_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| company_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| label_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| publisher_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| studio_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| event_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| campaign_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| financial_project_id | uuid | uuid | YES |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) |  | 15 |
| starts_at | date | date | YES |  | NO | NEVER |  |  |  | 15 |
| ends_at | date | date | YES |  | NO | NEVER |  |  |  | 15 |
| goals | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| context | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 15 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 15 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 15 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 15 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 15 |

## `public.marketing_strategies`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| marketing_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| responsible_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 11 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'draft'::character varying | NO | NEVER |  |  |  | 11 |
| dependencies | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |

## `public.marketing_strategy_actions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| marketing_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| initiative_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| responsible_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 12 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'planned'::character varying | NO | NEVER |  |  |  | 12 |
| dependencies | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |

## `public.marketing_strategy_initiatives`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| marketing_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| objective_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| responsible_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 12 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'planned'::character varying | NO | NEVER |  |  |  | 12 |
| dependencies | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |

## `public.marketing_strategy_objectives`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| marketing_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| strategy_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| responsible_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 12 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'planned'::character varying | NO | NEVER |  |  |  | 12 |
| dependencies | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 12 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |

## `public.marketing_tasks`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 14 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 14 |
| marketing_project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 14 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 14 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 14 |
| completed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 14 |
| priority | character varying | varchar | NO | 'normal'::character varying | NO | NEVER |  |  |  | 14 |
| kind | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| assigned_to | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 14 |
| dependencies | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 14 |
| metrics | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 14 |
| task_key | character varying | varchar | NO |  | NO | NEVER |  |  |  | 14 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 14 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 14 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 14 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 14 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 14 |

## `public.membership_job_functions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 5 |
| membership_id | uuid | uuid | NO |  | NO | NEVER |  | public.org_members.id (CASCADE) | SIM | 5 |
| job_function_id | uuid | uuid | NO |  | NO | NEVER |  | public.job_functions.id (RESTRICT) | SIM | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |

## `public.musicchat_automation_events`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 5 |
| conversation_id | uuid | uuid | YES |  | NO | NEVER |  | public.conversations.id (CASCADE) |  | 5 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| summary | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| payload | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 5 |
| actor_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.musicchat_automation_notifications`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 10 |
| conversation_id | uuid | uuid | NO |  | NO | NEVER |  | public.conversations.id (CASCADE) | SIM | 10 |
| level | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 10 |
| channel | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| recipient_user_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| body | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |

## `public.musicchat_automation_settings`

ROW_COUNT_ESTIMATE: 1 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 18 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 18 |
| enabled | boolean | bool | NO | true | NO | NEVER |  |  |  | 18 |
| welcome_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| main_menu_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| menu_options | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 18 |
| templates | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 18 |
| required_fields | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 18 |
| optional_fields | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 18 |
| invalid_option_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| absence_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| out_of_hours_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| closing_message | text | text | NO |  | NO | NEVER |  |  |  | 18 |
| return_to_menu_rule | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 18 |
| escalation_rules | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 18 |
| notification_channels | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 18 |
| supervisor_user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 18 |
| manager_user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 18 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 18 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 18 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 18 |

## `public.musicos360_migrations`

ROW_COUNT_ESTIMATE: 144 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | integer | int4 | NO | nextval('musicos360_migrations_id_seq'::regclass) | NO | NEVER | SIM |  |  | 3 |
| timestamp | bigint | int8 | NO |  | NO | NEVER |  |  |  | 3 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 3 |

## `public.notification_settings`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) | SIM | 7 |
| notification_key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 7 |
| enabled | boolean | bool | NO | true | NO | NEVER |  |  |  | 7 |
| config_json | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.notifications`

ROW_COUNT_ESTIMATE: 13 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| user_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| body | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| entity | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| entity_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| read_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.oauth_connections`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 8 |
| user_id | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 8 |
| provider | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 8 |
| access_token_encrypted | text | text | NO |  | NO | NEVER |  |  |  | 8 |
| refresh_token_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| expires_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| scopes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.operational_list_items`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 10 |
| kind | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| active | boolean | bool | NO | true | NO | NEVER |  |  |  | 10 |
| order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 10 |
| group | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |

## `public.operational_tasks`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 7 |
| priority | character varying | varchar | NO | 'medium'::character varying | NO | NEVER |  |  |  | 7 |
| type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| contact_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| company_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| assigned_to | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| due_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| completed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.org_members`

ROW_COUNT_ESTIMATE: 2 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 9 |
| auth_user_id | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 9 |
| email | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| full_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| phone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| role | character varying | varchar | NO | 'viewer'::character varying | NO | NEVER |  |  |  | 9 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 9 |
| org_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  | public.roles.id (RESTRICT) |  | 9 |
| department_id | uuid | uuid | YES |  | NO | NEVER |  | public.departments.id (SET NULL) |  | 9 |
| position_id | uuid | uuid | YES |  | NO | NEVER |  | public.positions.id (SET NULL) |  | 9 |
| joined_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 9 |

## `public.organizations`

ROW_COUNT_ESTIMATE: 1 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| external_auth_org_id | character varying | varchar | YES |  | NO | NEVER |  |  | SIM | 12 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 12 |
| plan | character varying | varchar | NO | 'starter'::character varying | NO | NEVER |  |  |  | 12 |
| billing_status | character varying | varchar | NO | 'trial'::character varying | NO | NEVER |  |  |  | 12 |
| industry | character varying | varchar | NO | 'gravadora'::character varying | NO | NEVER |  |  |  | 12 |
| cnpj_encrypted | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| phone | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| address | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| config | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 12 |
| is_system_tenant | boolean | bool | NO | false | NO | NEVER |  |  |  | 12 |

## `public.payment_events`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| stripe_event_id | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 5 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  | public.tenants.id (SET NULL) |  | 5 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| payload | jsonb | jsonb | NO |  | NO | NEVER |  |  |  | 5 |
| processed_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.payroll_entries`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| funcionario_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| employee_id | uuid | uuid | NO |  | NO | NEVER |  | public.employees.id (RESTRICT) |  | 11 |
| mes_referencia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| competencia | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| salario_bruto | numeric | numeric | NO |  | NO | NEVER |  |  |  | 11 |
| descontos | numeric | numeric | NO | 0 | NO | NEVER |  |  |  | 11 |
| bonus | numeric | numeric | YES |  | NO | NEVER |  |  |  | 11 |
| salario_liquido | numeric | numeric | NO |  | NO | NEVER |  |  |  | 11 |
| data_pagamento | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 11 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| arquivo_url | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| pago_em | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |

## `public.performance_metric_entries`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 15 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.performance_metric_entries.tenant_id (NO ACTION) | SIM | 15 |
| metric_type | USER-DEFINED | performance_metric_type | NO |  | NO | NEVER |  |  |  | 15 |
| platform | character varying | varchar | NO |  | NO | NEVER |  |  |  | 15 |
| aggregator | character varying | varchar | YES |  | NO | NEVER |  |  |  | 15 |
| phonogram_id | uuid | uuid | YES |  | NO | NEVER |  | public.phonograms.id (NO ACTION) |  | 15 |
| release_id | uuid | uuid | YES |  | NO | NEVER |  | public.releases.tenant_id (NO ACTION) |  | 15 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.tenant_id (NO ACTION) |  | 15 |
| project_id | uuid | uuid | YES |  | NO | NEVER |  | public.projects.id (NO ACTION) |  | 15 |
| period_start | date | date | NO |  | NO | NEVER |  |  |  | 15 |
| period_end | date | date | NO |  | NO | NEVER |  |  |  | 15 |
| quantity | bigint | int8 | NO |  | NO | NEVER |  |  |  | 15 |
| source | USER-DEFINED | metric_source | NO |  | NO | NEVER |  |  |  | 15 |
| external_reference | text | text | YES |  | NO | NEVER |  |  |  | 15 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 15 |
| superseded_by_id | uuid | uuid | YES |  | NO | NEVER |  | public.performance_metric_entries.id (NO ACTION) |  | 15 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 15 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 15 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 15 |

## `public.permission_aliases`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| legacy_key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 5 |
| new_key | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.permission_conflicts`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (CASCADE) | SIM | 5 |
| conflicts_with_permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (CASCADE) | SIM | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.permission_dependencies`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (CASCADE) | SIM | 5 |
| depends_on_permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (CASCADE) | SIM | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |

## `public.permission_groups`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 7 |
| domain | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| label | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.permissions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 11 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 11 |
| key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 11 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 11 |
| group_id | uuid | uuid | YES |  | NO | NEVER |  | public.permission_groups.id (RESTRICT) |  | 11 |
| label | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| since_version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 11 |
| deprecated_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 11 |
| replaced_by_key | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| is_assignable | boolean | bool | NO | true | NO | NEVER |  |  |  | 11 |

## `public.phonograms`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 9 |
| obra_id | uuid | uuid | YES |  | NO | NEVER |  | public.works.id (SET NULL) |  | 9 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| cod_entidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| cod_ecad | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| agregadora | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| isrc | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| isrc_pais | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| isrc_registrante | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| isrc_ano | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| isrc_designacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| criada_por_ia | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| instrumental | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| emissao | date | date | YES |  | NO | NEVER |  |  |  | 9 |
| gravacao_original | date | date | YES |  | NO | NEVER |  |  |  | 9 |
| data_lancamento | date | date | YES |  | NO | NEVER |  |  |  | 9 |
| duracao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| duracao_min | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| duracao_seg | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| genero_musical | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| midia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| nacional | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| pub_simultanea | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| pais_origem | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| pais_publicacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| classificacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 9 |
| participacao | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| arquivo_audio | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.id (SET NULL) |  | 9 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| compositores | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| interpretes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| produtores | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| gravadora | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| version_title | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| recording_date | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| release_date | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| phonographic_producer_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| main_artist_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| label_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| copyright_year | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| copyright_owner | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| country_of_recording | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| audio_file_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| duration_seconds | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| registry_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| external_reference | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa_sincronizado_em | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.pipeline_opportunities`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| pipeline_id | uuid | uuid | NO |  | NO | NEVER |  | public.pipelines.id (CASCADE) |  | 10 |
| stage_id | uuid | uuid | YES |  | NO | NEVER |  | public.pipeline_stages.id (SET NULL) |  | 10 |
| title | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| contact_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| company_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 10 |
| value | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'open'::character varying | NO | NEVER |  |  |  | 10 |
| probability | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| expected_close_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| actual_close_date | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| sla_due_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |
| sla_breached | boolean | bool | NO | false | NO | NEVER |  |  |  | 10 |
| assigned_to | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| notes | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| stage_history | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 10 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 10 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 10 |

## `public.pipeline_stages`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| pipeline_id | uuid | uuid | NO |  | NO | NEVER |  | public.pipelines.id (CASCADE) |  | 10 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| position | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 10 |
| color | character varying | varchar | NO | '#6366f1'::character varying | NO | NEVER |  |  |  | 10 |
| sla_days | integer | int4 | YES |  | NO | NEVER |  |  |  | 10 |
| win_probability | numeric | numeric | YES |  | NO | NEVER |  |  |  | 10 |
| is_terminal | boolean | bool | NO | false | NO | NEVER |  |  |  | 10 |
| is_won | boolean | bool | NO | false | NO | NEVER |  |  |  | 10 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 10 |

## `public.pipelines`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| type | character varying | varchar | NO | 'sales'::character varying | NO | NEVER |  |  |  | 7 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 7 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |

## `public.positions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 8 |
| department_id | uuid | uuid | YES |  | NO | NEVER |  | public.departments.id (SET NULL) |  | 8 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| is_active | boolean | bool | NO | true | NO | NEVER |  |  |  | 8 |
| sort_order | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.project_assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| project_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| role | character varying | varchar | NO | 'reference'::character varying | NO | NEVER |  |  |  | 6 |
| source_event | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| linked_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 6 |

## `public.project_track_participants`

ROW_COUNT_ESTIMATE: 17 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO |  | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| project_track_id | uuid | uuid | NO |  | NO | NEVER |  | public.project_tracks.id (CASCADE) |  | 8 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| role | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| ordem | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.project_tracks`

ROW_COUNT_ESTIMATE: 6 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO |  | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| project_id | uuid | uuid | NO |  | NO | NEVER |  | public.projects.id (CASCADE) |  | 7 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| solo_feat | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| original_remix | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| instrumental | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| duracao_min | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| duracao_seg | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| genero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| idioma | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| letra | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| audio_url | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| ordem | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.projects`

ROW_COUNT_ESTIMATE: 4 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 8 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| genero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'planejamento'::character varying | NO | NEVER |  |  |  | 8 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 8 |
| orcamento | numeric | numeric | YES |  | NO | NEVER |  |  |  | 8 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |

## `public.rbac_decision_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: unknown | RLS_FORCED: unknown | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_2026_06`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_2026_07`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_2026_08`

ROW_COUNT_ESTIMATE: 583 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_2026_09`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_2026_10`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_decision_logs_default`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id, created_at

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 22 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER | SIM |  |  | 22 |
| request_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| trace_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| workspace_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| membership_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 22 |
| role_slug | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| resource | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| action | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| permission | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| endpoint | text | text | NO |  | NO | NEVER |  |  |  | 22 |
| method | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| active_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| shadow_decision | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| comparison_result | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| decision_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |
| resolver_reason | character varying | varchar | YES |  | NO | NEVER |  |  |  | 22 |
| would_allow | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| would_deny | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| latency_ms | double precision | float8 | NO | 0 | NO | NEVER |  |  |  | 22 |
| cache_hit | boolean | bool | NO | false | NO | NEVER |  |  |  | 22 |
| authority_mode | character varying | varchar | NO |  | NO | NEVER |  |  |  | 22 |

## `public.rbac_error_logs`

ROW_COUNT_ESTIMATE: 128 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 5 |
| request_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| trace_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |
| user_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 5 |
| error_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| error_source | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| message | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| stack | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| authority_mode | character varying | varchar | YES |  | NO | NEVER |  |  |  | 5 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 5 |

## `public.release_works`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: release_id, work_id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| release_id | uuid | uuid | NO |  | NO | NEVER | SIM | public.releases.id (CASCADE) |  | 2 |
| work_id | uuid | uuid | NO |  | NO | NEVER | SIM | public.works.id (CASCADE) |  | 2 |

## `public.releases`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  | SIM | 9 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| tipo | character varying | varchar | NO | 'single'::character varying | NO | NEVER |  |  |  | 9 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.id (SET NULL) |  | 9 |
| genero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| idioma | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| gravadora | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| copyright | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| upc | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| distribuidora | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| data_lancamento | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| capa_url | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| plataformas | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 9 |
| isrc_global | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| assets | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| cronograma | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| notas_internas | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'planejamento'::character varying | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

## `public.rights_holders`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| legal_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| artistic_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| document_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| document_number | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| country | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| ipi_cae | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| society | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| society_member_code | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| holder_type | character varying | varchar | NO | 'OTHER'::character varying | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |

## `public.role_inheritance`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 6 |
| child_role_id | uuid | uuid | NO |  | NO | NEVER |  | public.roles.id (CASCADE) |  | 6 |
| parent_role_id | uuid | uuid | NO |  | NO | NEVER |  | public.roles.id (RESTRICT) |  | 6 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  | public.users.id (SET NULL) |  | 6 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  | public.users.id (SET NULL) |  | 6 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 6 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 6 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 6 |

## `public.role_permissions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 4 |
| role_id | uuid | uuid | NO |  | NO | NEVER |  | public.roles.id (CASCADE) | SIM | 4 |
| permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (RESTRICT) | SIM | 4 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 4 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 4 |

## `public.role_template_permissions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 4 |
| template_id | uuid | uuid | NO |  | NO | NEVER |  | public.role_templates.id (CASCADE) | SIM | 4 |
| permission_id | uuid | uuid | NO |  | NO | NEVER |  | public.permissions.id (RESTRICT) | SIM | 4 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 4 |

## `public.role_templates`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| key | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 8 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 8 |
| is_system | boolean | bool | NO | true | NO | NEVER |  |  |  | 8 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 8 |

## `public.roles`

ROW_COUNT_ESTIMATE: 20 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 12 |
| canonical_role_id | uuid | uuid | YES |  | NO | NEVER |  | public.roles.id (SET NULL) |  | 12 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 12 |
| hierarchy_level | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 12 |
| is_system | boolean | bool | NO | false | NO | NEVER |  |  |  | 12 |
| is_assignable | boolean | bool | NO | true | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  | public.users.id (SET NULL) |  | 12 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  | public.users.id (SET NULL) |  | 12 |
| deleted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| archived_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| current_version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 12 |

## `public.shares`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| obra_id | uuid | uuid | YES |  | NO | NEVER |  | public.works.id (SET NULL) |  | 7 |
| fonograma_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| titular_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| titular_doc | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| papel | character varying | varchar | NO | 'autor'::character varying | NO | NEVER |  |  |  | 7 |
| rights_holder_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| publisher_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| role | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| territory | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| instrument | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| credited_name | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| is_primary | boolean | bool | YES |  | NO | NEVER |  |  |  | 7 |
| is_featured | boolean | bool | YES |  | NO | NEVER |  |  |  | 7 |
| start_date | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| end_date | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| share_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| percentual | numeric | numeric | YES |  | NO | NEVER |  |  |  | 7 |
| status | character varying | varchar | NO | 'ativo'::character varying | NO | NEVER |  |  |  | 7 |
| acordo_notas | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| acordo_url | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| direcao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| lancamento_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| nome_musica | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| detentor | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| destinatario | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| tipo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| artista_externo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| artista_projeto_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| pagador | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| pagador_contato | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| origem_acordo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| data_prevista | date | date | YES |  | NO | NEVER |  |  |  | 7 |
| documentos | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| versao | integer | int4 | YES |  | NO | NEVER |  |  |  | 7 |
| historico | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 7 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |

## `public.skill_run_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| skill_run_id | uuid | uuid | NO |  | NO | NEVER |  | public.skill_runs.id (CASCADE) |  | 5 |
| level | character varying | varchar | NO | 'info'::character varying | NO | NEVER |  |  |  | 5 |
| message | text | text | NO |  | NO | NEVER |  |  |  | 5 |
| payload | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 5 |

## `public.skill_runs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| skill_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 6 |
| entity_type | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| entity_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| correlation_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 6 |
| input_payload | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 6 |
| output_payload | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 6 |
| error_message | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| started_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 6 |
| finished_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 6 |

## `public.society_accounts`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| society | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| driver | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| account_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| member_code | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| credentials_ref | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'PENDING'::character varying | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |

## `public.society_payload_snapshots`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 7 |
| submission_id | uuid | uuid | NO |  | NO | NEVER |  | public.society_submissions.id (CASCADE) | SIM | 7 |
| version | integer | int4 | NO |  | NO | NEVER |  |  | SIM | 7 |
| payload | jsonb | jsonb | NO |  | NO | NEVER |  |  |  | 7 |
| payload_hash | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.society_submission_events`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| submission_id | uuid | uuid | NO |  | NO | NEVER |  | public.society_submissions.id (CASCADE) |  | 6 |
| from_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| to_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 6 |
| message | text | text | YES |  | NO | NEVER |  |  |  | 6 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 6 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 6 |

## `public.society_submissions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 13 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 13 |
| account_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| society | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| driver | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| entity_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 13 |
| entity_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 13 |
| status | character varying | varchar | NO | 'DRAFT'::character varying | NO | NEVER |  |  |  | 13 |
| protocol | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| external_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| current_payload_snapshot_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 13 |
| submitted_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 13 |
| submitted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 13 |
| approved_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 13 |
| rejected_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 13 |
| failure_reason | text | text | YES |  | NO | NEVER |  |  |  | 13 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 13 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 13 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 13 |

## `public.society_sync_jobs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| society | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| driver | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'PENDING'::character varying | NO | NEVER |  |  |  | 8 |
| started_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| finished_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |
| error_message | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |

## `public.society_validation_errors`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| submission_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| entity_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| entity_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| severity | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| field_path | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| code | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| message | text | text | NO |  | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.support_tickets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| ticket_number | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 11 |
| subject | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| description | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'open'::character varying | NO | NEVER |  |  |  | 11 |
| priority | character varying | varchar | NO | 'medium'::character varying | NO | NEVER |  |  |  | 11 |
| category | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| assigned_to | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| sla_deadline | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| resolved_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| tags | jsonb | jsonb | NO | '[]'::jsonb | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |

## `public.takedowns`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 8 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 8 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| tipo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| obra_afetada | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| artista | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 8 |
| prioridade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| plataforma | character varying | varchar | NO |  | NO | NEVER |  |  |  | 8 |
| url_infracao | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| motivo | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| data_identificacao | date | date | YES |  | NO | NEVER |  |  |  | 8 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| evidencias | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 8 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 8 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 8 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 8 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 8 |

## `public.task_assets`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 6 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| task_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| asset_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 6 |
| role | character varying | varchar | NO | 'reference'::character varying | NO | NEVER |  |  |  | 6 |
| source_event | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| linked_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 6 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 6 |

## `public.tenant_billing_state`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) | SIM | 7 |
| status | character varying | varchar | NO | 'trial'::character varying | NO | NEVER |  |  |  | 7 |
| last_payment_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| next_payment_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| grace_until | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| suspended_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| manual_override | boolean | bool | NO | false | NO | NEVER |  |  |  | 7 |
| manual_override_reason | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| manual_override_until | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 7 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.tenant_invitations`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.tenants.id (CASCADE) |  | 12 |
| org_id | uuid | uuid | NO |  | NO | NEVER |  | public.organizations.id (CASCADE) |  | 12 |
| email | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| role_id | uuid | uuid | NO |  | NO | NEVER |  | public.roles.id (RESTRICT) |  | 12 |
| auth_user_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| invited_by | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 12 |
| expires_at | timestamp with time zone | timestamptz | NO | (now() + '7 days'::interval) | NO | NEVER |  |  |  | 12 |
| accepted_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| cancelled_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 12 |
| last_sent_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |

## `public.tenants`

ROW_COUNT_ESTIMATE: 1 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 15 |
| org_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 15 |
| external_auth_org_id | character varying | varchar | YES |  | NO | NEVER |  |  | SIM | 15 |
| name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 15 |
| slug | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 15 |
| plan | character varying | varchar | NO | 'starter'::character varying | NO | NEVER |  |  |  | 15 |
| features | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| settings | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 15 |
| active | boolean | bool | NO | true | NO | NEVER |  |  |  | 15 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 15 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 15 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 15 |
| allow_public_registration | boolean | bool | NO | true | NO | NEVER |  |  |  | 15 |
| public_registration_blocked | boolean | bool | NO | false | NO | NEVER |  |  |  | 15 |
| public_registration_revoked_at | timestamp with time zone | timestamptz | YES |  | NO | NEVER |  |  |  | 15 |
| public_registration_access_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 15 |
| public_registration_conversion_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 15 |
| is_system_tenant | boolean | bool | NO | false | NO | NEVER |  |  |  | 15 |

## `public.transaction_allocations`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  | SIM | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  | public.financial_transactions.id (CASCADE) | SIM | 12 |
| transaction_id | uuid | uuid | NO |  | NO | NEVER |  | public.financial_transactions.tenant_id (CASCADE) | SIM | 12 |
| dimension | USER-DEFINED | allocation_dimension | NO |  | NO | NEVER |  |  | SIM | 12 |
| project_id | uuid | uuid | YES |  | NO | NEVER |  | public.projects.tenant_id (NO ACTION) | SIM | 12 |
| artist_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.tenant_id (NO ACTION) | SIM | 12 |
| phonogram_id | uuid | uuid | YES |  | NO | NEVER |  | public.phonograms.id (NO ACTION) | SIM | 12 |
| release_id | uuid | uuid | YES |  | NO | NEVER |  | public.releases.tenant_id (NO ACTION) | SIM | 12 |
| percentage | numeric | numeric | NO |  | NO | NEVER |  |  |  | 12 |
| allocated_amount | numeric | numeric | NO |  | NO | NEVER |  |  |  | 12 |
| version | integer | int4 | NO | 1 | NO | NEVER |  |  |  | 12 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 12 |
| created_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 12 |
| updated_by | uuid | uuid | YES |  | NO | NEVER |  |  |  | 12 |

## `public.transactions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 11 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 11 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| categoria | character varying | varchar | NO |  | NO | NEVER |  |  |  | 11 |
| descricao | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| valor | numeric | numeric | NO |  | NO | NEVER |  |  |  | 11 |
| data | timestamp without time zone | timestamp | NO |  | NO | NEVER |  |  |  | 11 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 11 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| contrato_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| projeto_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| referencia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| comprovante_url | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 11 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 11 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| financial_category_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |
| financial_category_snapshot | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 11 |
| tipo_transacao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| tipo_cliente | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| subcategoria | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| data_transacao | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| observacoes | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| fornecedor_cliente | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| orgao_arrecadador | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| centro_custo | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| competencia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| conta_origem | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| conta_destino | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| item_investimento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| motivo_viagem | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| nome_publicidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| forma_pagamento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| tipo_pagamento | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| quantidade_parcelas | integer | int4 | YES |  | NO | NEVER |  |  |  | 11 |
| intervalo_parcelas | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| data_primeira_parcela | date | date | YES |  | NO | NEVER |  |  |  | 11 |
| anexo_url | text | text | YES |  | NO | NEVER |  |  |  | 11 |
| anexo_nome | character varying | varchar | YES |  | NO | NEVER |  |  |  | 11 |
| evento_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 11 |

## `public.uploads`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 12 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 12 |
| user_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| file_id | character varying | varchar | NO |  | NO | NEVER |  |  | SIM | 12 |
| original_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| mime_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| size_bytes | integer | int4 | NO |  | NO | NEVER |  |  |  | 12 |
| r2_key | text | text | NO |  | NO | NEVER |  |  |  | 12 |
| category | character varying | varchar | NO |  | NO | NEVER |  |  |  | 12 |
| entity | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| entity_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 12 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 12 |
| confirmed_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 12 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 12 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 12 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 12 |

## `public.users`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO |  | NO | NEVER | SIM |  |  | 4 |
| auth_user_id | text | text | NO |  | NO | NEVER |  |  | SIM | 4 |
| email | text | text | YES |  | NO | NEVER |  |  |  | 4 |
| display_name | text | text | YES |  | NO | NEVER |  |  |  | 4 |
| created_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 4 |
| updated_at | timestamp with time zone | timestamptz | NO | now() | NO | NEVER |  |  |  | 4 |

## `public.webhook_events`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 7 |
| tenant_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 7 |
| provider | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 7 |
| external_id | character varying | varchar | YES |  | NO | NEVER |  |  | SIM | 7 |
| payload | jsonb | jsonb | NO |  | NO | NEVER |  |  |  | 7 |
| status | character varying | varchar | NO | 'pending'::character varying | NO | NEVER |  |  |  | 7 |
| processed_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 7 |
| error | text | text | YES |  | NO | NEVER |  |  |  | 7 |
| retry_count | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 7 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 7 |

## `public.work_participants`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO |  | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| work_id | uuid | uuid | NO |  | NO | NEVER |  | public.works.id (CASCADE) |  | 9 |
| nome | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| classe_funcao | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| link | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| percentual | numeric | numeric | YES |  | NO | NEVER |  |  |  | 9 |
| ordem | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.workflow_execution_logs`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: false | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 5 |
| execution_id | uuid | uuid | NO |  | NO | NEVER |  | public.workflow_executions.id (CASCADE) |  | 5 |
| action_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| status | character varying | varchar | NO |  | NO | NEVER |  |  |  | 5 |
| message | text | text | YES |  | NO | NEVER |  |  |  | 5 |
| payload | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 5 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 5 |

## `public.workflow_executions`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 10 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 10 |
| rule_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| rule_name | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| event_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 10 |
| correlation_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 10 |
| status | character varying | varchar | NO | 'running'::character varying | NO | NEVER |  |  |  | 10 |
| actions_total | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 10 |
| actions_succeeded | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 10 |
| actions_failed | integer | int4 | NO | 0 | NO | NEVER |  |  |  | 10 |
| error_message | text | text | YES |  | NO | NEVER |  |  |  | 10 |
| started_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |
| finished_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 10 |
| created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP | NO | NEVER |  |  |  | 10 |

## `public.workflow_transitions`

ROW_COUNT_ESTIMATE: 10 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| entity_type | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| entity_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| from_status | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| to_status | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| actor_id | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| actor_role | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| reason | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |

## `public.works`

ROW_COUNT_ESTIMATE: 0 | RLS_ENABLED: true | RLS_FORCED: true | PRIMARY_KEY: id

| COLUMN | DATA_TYPE | UDT_TYPE | NULLABLE | DEFAULT | IDENTITY | GENERATED | PK | FK | UNIQUE | CHECK |
|---|---|---|---|---|---|---|---|---|---|---|
| id | uuid | uuid | NO | gen_random_uuid() | NO | NEVER | SIM |  |  | 9 |
| tenant_id | uuid | uuid | NO |  | NO | NEVER |  |  |  | 9 |
| projeto_id | uuid | uuid | YES |  | NO | NEVER |  |  |  | 9 |
| cod_entidade | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| cod_ecad | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| iswc | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| titulo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| genero | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| idioma | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| duracao | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| instrumental | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| criada_por_ia | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| status | character varying | varchar | NO | 'pendente'::character varying | NO | NEVER |  |  |  | 9 |
| tipo_ia | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| ia_harmonia | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| ia_melodia | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| ia_letra | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| outros_titulos | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| referencias_conexas | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| letra_completa | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| artista_id | uuid | uuid | YES |  | NO | NEVER |  | public.artists.id (SET NULL) |  | 9 |
| tipo | character varying | varchar | NO |  | NO | NEVER |  |  |  | 9 |
| tipo_obra | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| compositor | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| compositores | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| editora | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| letristas | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| isrc | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| alternative_titles | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| language | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| lyrics | text | text | YES |  | NO | NEVER |  |  |  | 9 |
| is_instrumental | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| duration_seconds | integer | int4 | YES |  | NO | NEVER |  |  |  | 9 |
| registry_status | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| external_reference | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| ai_used | boolean | bool | YES |  | NO | NEVER |  |  |  | 9 |
| ai_tools | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| ai_prompts | jsonb | jsonb | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa_id | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| origem_externa_sincronizado_em | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |
| metadata | jsonb | jsonb | NO | '{}'::jsonb | NO | NEVER |  |  |  | 9 |
| created_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| updated_at | timestamp without time zone | timestamp | NO | now() | NO | NEVER |  |  |  | 9 |
| created_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| updated_by | character varying | varchar | YES |  | NO | NEVER |  |  |  | 9 |
| deleted_at | timestamp without time zone | timestamp | YES |  | NO | NEVER |  |  |  | 9 |

