/**
 * scripts/verify-canonical-column-order.ts
 *
 * Compares a table's real physical order (information_schema.columns.ordinal_position)
 * with the documented canonical order (extracted from the real
 * form). Used after each physical table rebuild (Rebuild*InCanonicalFormOrder).
 *
 * Usage: tsx scripts/verify-canonical-column-order.ts <table>
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/database/datasource';

// Canonical order documented per table — updated on every physical rebuild.
const CANONICAL_ORDER: Record<string, string[]> = {
  artists: [
    'id', 'tenant_id', 'foto_url', 'nome_artistico', 'music_genre', 'especialidades',
    'documentos_pessoais_url', 'presskit_url', 'notes', 'nome_civil', 'data_nascimento', 'cpf_cnpj_encrypted',
    'rg', 'endereco', 'telefone_encrypted', 'email_encrypted', 'banco',
    'agencia', 'conta', 'chave_pix', 'titular_conta', 'spotify_url', 'youtube_url',
    'soundcloud_url', 'apple_music_url', 'deezer_url', 'tipo_perfil', 'contatos_vinculados', 'distribuidoras_gerais',
    'notas_internas', 'contrato_id', 'slug_artistico', 'tags_musicais', 'fase_carreira', 'status',
    'status_cadastro', 'relacionamentos', 'empresario_id', 'empresario_nome', 'empresario_telefone', 'empresario_email',
    'gravadora_id', 'gravadora_nome', 'gravadora_telefone', 'gravadora_email', 'gravadora_responsavel_id', 'gravadora_responsavel_nome',
    'gravadora_responsavel_telefone', 'gravadora_responsavel_email', 'distribuidoras_selecionadas', 'distribuidoras_emails', 'distribuidoras_empresa_selecionadas', 'distribuidoras_empresa_emails',
    'contatos_equipe', 'manager_nome', 'manager_contato_encrypted', 'produtor_executivo', 'agencia_booking', 'label_parceira',
    'galeria_urls', 'documents', 'metadata', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at',
  ],
  works: [
    'id', 'tenant_id', 'project_id', 'cod_entidade', 'cod_ecad', 'iswc',
    'title', 'music_genre', 'idioma', 'duration_text', 'instrumental', 'criada_por_ia',
    'status', 'tipo_ia', 'ia_harmonia', 'ia_melodia', 'ia_letra', 'outros_titulos',
    'referencias_conexas', 'letra_completa', 'artist_id', 'type', 'tipo_obra', 'compositor',
    'compositores', 'editora', 'letristas', 'isrc', 'alternative_titles', 'language',
    'lyrics', 'is_instrumental', 'duration_seconds', 'registry_status', 'external_reference', 'ai_used',
    'ai_tools', 'ai_prompts', 'origem_externa', 'origem_externa_id', 'origem_externa_sincronizado_em', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  work_participants: [
    'id', 'tenant_id', 'work_id', 'name', 'classe_funcao', 'link',
    'percentual', 'sort_order', 'created_at', 'updated_at',
  ],
  phonograms: [
    'id', 'tenant_id', 'work_id', 'title', 'cod_entidade', 'cod_ecad',
    'agregadora', 'isrc', 'isrc_pais', 'isrc_registrante', 'isrc_ano', 'isrc_designacao',
    'criada_por_ia', 'is_instrumental', 'emissao', 'gravacao_original', 'data_lancamento', 'duration_text',
    'duracao_min', 'duracao_seg', 'music_genre', 'midia', 'nacional', 'pub_simultanea',
    'pais_origem', 'pais_publicacao', 'classificacao', 'status', 'participacao', 'arquivo_audio',
    'notes', 'artist_id', 'type',
    'gravadora', 'version_title', 'recording_date', 'release_date', 'phonographic_producer_id', 'main_artist_id',
    'label_id', 'copyright_year', 'copyright_owner', 'country_of_recording', 'audio_file_id', 'duration_seconds',
    'registry_status', 'external_reference', 'origem_externa', 'origem_externa_id', 'origem_externa_sincronizado_em', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  releases: [
    'id', 'tenant_id', 'title', 'type', 'artist_id', 'music_genre',
    'language', 'record_label', 'copyright', 'upc', 'distributor', 'release_date',
    'cover_url', 'platforms', 'isrc_global', 'assets', 'schedule', 'internal_notes',
    'notes', 'status', 'metadata', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at',
  ],
  projects: [
    'id', 'tenant_id', 'type', 'title', 'music_genre', 'notes',
    'status', 'artist_id', 'budget', 'description', 'metadata', 'created_at',
    'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  project_tracks: [
    'id', 'tenant_id', 'project_id', 'name', 'solo_feat', 'original_remix',
    'instrumental', 'duracao_min', 'duracao_seg', 'music_genre', 'idioma', 'letra',
    'audio_url', 'sort_order', 'created_at', 'updated_at',
  ],
  project_track_participants: [
    'id', 'tenant_id', 'project_track_id', 'name', 'role', 'sort_order',
    'created_at',
  ],
  audiovisual_projects: [
    'id', 'tenant_id', 'phonogram_id', 'music_title', 'title', 'artist_name',
    'type', 'format', 'director', 'videographer', 'editor', 'shooting_date',
    'location', 'capture_status', 'editing_status', 'approval_status', 'pre_release_date', 'release_date',
    'budget_estimated', 'budget_actual', 'concept', 'observations', 'status', 'final_status',
    'completed_at', 'publish_date', 'artist_id', 'release_id', 'campaign_id', 'event_id',
    'financial_project_id', 'slug', 'description', 'objective', 'priority', 'stage',
    'production_company', 'producer', 'start_date', 'recording_date', 'delivery_date', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  events: [
    'id', 'tenant_id', 'title', 'type', 'participants', 'status',
    'data', 'starts_at', 'end_date', 'venue', 'venue_contact', 'address',
    'fee_amount', 'expected_attendance', 'description', 'notes', 'artist_id', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  marketing_projects: [
    'id', 'tenant_id', 'type', 'title', 'description', 'status',
    'priority', 'source_project_id', 'artist_id', 'company_id', 'label_id', 'publisher_id',
    'studio_id', 'event_id', 'campaign_id', 'financial_project_id', 'starts_at', 'ends_at',
    'goals', 'metrics', 'context', 'metadata', 'created_at', 'updated_at',
    'created_by', 'updated_by', 'deleted_at',
  ],
  marketing_tasks: [
    'id', 'tenant_id', 'marketing_project_id', 'title', 'description', 'status',
    'completed_at', 'priority', 'kind', 'assigned_to', 'due_date', 'dependencies',
    'metrics', 'task_key', 'metadata', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at',
  ],
  clients: [
    'id', 'tenant_id', 'tipo_pessoa', 'categoria', 'perfil', 'nome',
    'foto', 'individual_name', 'razao_social', 'trade_name', 'cpf_cnpj_encrypted', 'email_encrypted',
    'telefone_encrypted', 'instagram', 'funcao', 'logradouro', 'numero', 'complemento',
    'bairro', 'city', 'state', 'cep', 'endereco_completo', 'status_contato',
    'prioridade_contato', 'responsavel_nome', 'responsavel_cargo', 'responsavel_email', 'responsavel_telefone', 'attachments',
    'notes', 'interacoes', 'status', 'metadata', 'created_at', 'updated_at',
    'created_by', 'updated_by', 'deleted_at',
  ],
  leads: [
    'id', 'tenant_id', 'name', 'full_name', 'company', 'email_encrypted',
    'whatsapp', 'instagram', 'city', 'state', 'client_type', 'service_type',
    'service_payload', 'status',
    'crm_internal_data', 'uploads', 'country',
    'stage_name', 'phone_encrypted', 'client_id', 'source', 'tags', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  contracts: [
    'id', 'tenant_id', 'template_id', 'title', 'type', 'status',
    'artist_id', 'client_id', 'release_id', 'start_date', 'end_date', 'fixed_value',
    'exclusive', 'notes', 'file_url', 'autentique_doc_id', 'signing_platform', 'versions',
    'signers', 'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by',
    'deleted_at', 'documents',
  ],
  rights_holders: [
    'id', 'tenant_id', 'legal_name', 'artistic_name', 'document_type', 'document_number',
    'country', 'ipi_cae', 'society', 'society_member_code', 'holder_type', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  shares: [
    'id', 'tenant_id', 'work_id', 'phonogram_id', 'holder_name', 'holder_document',
    'party_role', 'rights_holder_id', 'publisher_id', 'role', 'territory', 'instrument',
    'credited_name', 'is_primary', 'is_featured', 'start_date', 'end_date', 'share_type',
    'percentage', 'status', 'agreement_notes', 'agreement_url', 'notes', 'direction',
    'release_id', 'music_title', 'holder', 'recipient', 'type', 'external_artist_name',
    'legacy_artist_project_id', 'artist_id', 'payer', 'payer_contact', 'agreement_source', 'expected_at',
    'documents', 'version', 'history', 'metadata', 'created_at', 'updated_at',
    'deleted_at', 'total_amount', 'settled_amount',
  ],
  licenses: [
    'id', 'tenant_id', 'title', 'work_id', 'obra_musical', 'artista',
    'client_id', 'cliente', 'projeto', 'type', 'tipo_uso', 'midia_destino',
    'territorio', 'status', 'start_date', 'end_date', 'valor', 'moeda',
    'notes', 'remuneration_type', 'artist_id', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at', 'percentage',
  ],
  takedowns: [
    'id', 'tenant_id', 'title', 'type', 'obra_afetada', 'artista',
    'status', 'prioridade', 'plataforma', 'url_infracao', 'motivo', 'data_identificacao',
    'description', 'evidencias', 'notes', 'metadata', 'created_at', 'updated_at',
    'created_by', 'deleted_at',
  ],
  inventory_items: [
    'id', 'tenant_id', 'name', 'category', 'quantity', 'unit_price',
    'storage_location', 'status', 'responsible_person', 'sector', 'entry_date', 'purchase_location',
    'numero_nota_fiscal', 'notes', 'created_at', 'updated_at', 'created_by', 'updated_by',
    'deleted_at',
  ],
  employees: [
    'id', 'tenant_id', 'legacy_full_name', 'name', 'cpf_encrypted', 'rg',
    'birth_date', 'email_encrypted', 'phone_encrypted', 'address', 'job_title', 'legacy_sector',
    'department', 'contract_type', 'hired_at', 'terminated_at', 'legacy_base_salary', 'salary',
    'status', 'notes', 'linked_user_id', 'documents', 'metadata', 'created_at',
    'updated_at', 'created_by', 'deleted_at',
  ],
  payroll_entries: [
    'id', 'tenant_id', 'legacy_employee_id', 'employee_id', 'legacy_reference_month', 'reference_month',
    'gross_salary', 'deductions', 'bonus', 'net_salary', 'payment_date', 'status',
    'notes', 'file_url', 'paid_at', 'metadata', 'created_at', 'updated_at',
    'deleted_at',
  ],
  org_members: [
    'id', 'tenant_id', 'auth_user_id', 'email', 'full_name', 'phone',
    'role', 'is_active', 'org_id', 'role_id', 'department_id', 'position_id',
    'joined_at', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  musicchat_automation_settings: [
    'id', 'tenant_id', 'enabled', 'welcome_message', 'main_menu_message', 'menu_options',
    'templates', 'required_fields', 'optional_fields', 'invalid_option_message', 'absence_message', 'out_of_hours_message',
    'closing_message', 'return_to_menu_rule', 'escalation_rules', 'notification_channels', 'supervisor_user_id', 'manager_user_id',
    'created_at', 'updated_at', 'updated_by',
  ],
  campaigns: [
    'id', 'tenant_id', 'name', 'type', 'status', 'objective',
    'budget', 'start_date', 'end_date', 'artist_id', 'metadata', 'created_at',
    'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  campaign_tasks: [
    'id', 'tenant_id', 'campaign_id', 'title', 'description', 'status',
    'priority', 'assigned_to', 'due_date', 'completed_at', 'created_at', 'updated_at',
    'created_by',
  ],
  campaign_assets: [
    'id', 'tenant_id', 'campaign_id', 'name', 'asset_type', 'file_url',
    'description', 'metadata', 'created_at', 'created_by', 'deleted_at',
  ],
  leave_requests: [
    'id', 'tenant_id', 'legacy_employee_id', 'employee_id', 'type', 'start_date',
    'end_date', 'total_days', 'status', 'approved_by', 'notes', 'reason',
    'document_url', 'metadata', 'created_at', 'updated_at', 'created_by', 'deleted_at',
  ],
};

async function main() {
  const table = process.argv[2];
  if (!table || !CANONICAL_ORDER[table]) {
    console.error(`Uso: tsx verify-canonical-column-order.ts <${Object.keys(CANONICAL_ORDER).join('|')}>`);
    process.exit(1);
  }

  await AppDataSource.initialize();
  const rows: { column_name: string }[] = await AppDataSource.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table],
  );
  const actual = rows.map((r) => r.column_name);
  const expected = CANONICAL_ORDER[table];

  const mismatches: string[] = [];
  const max = Math.max(actual.length, expected.length);
  for (let i = 0; i < max; i++) {
    if (actual[i] !== expected[i]) {
      mismatches.push(`  position ${i + 1}: expected="${expected[i] ?? '<missing>'}" actual="${actual[i] ?? '<missing>'}"`);
    }
  }

  await AppDataSource.destroy();

  if (mismatches.length > 0) {
    console.error(`[verify-canonical-column-order] "${table}" DIVERGES from the canonical order:`);
    console.error(mismatches.join('\n'));
    process.exit(1);
  }
  console.log(`[verify-canonical-column-order] "${table}" ✓ physical order == canonical order (${actual.length} columns).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
