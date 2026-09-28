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
  // CZ-042 (20260928000022): same physical order, columns renamed to English.
  artists: [
    'id', 'tenant_id', 'photo_url', 'stage_name', 'music_genre', 'specialties',
    'personal_documents_url', 'press_kit_url', 'notes', 'full_name', 'birth_date', 'cpf_cnpj_encrypted',
    'rg', 'address', 'phone_encrypted', 'email_encrypted', 'bank_name',
    'bank_branch', 'bank_account', 'pix_key', 'account_holder', 'spotify_url', 'youtube_url',
    'soundcloud_url', 'apple_music_url', 'deezer_url', 'profile_type', 'linked_contacts', 'general_distributors',
    'internal_notes', 'contract_id', 'artist_slug', 'music_tags', 'career_stage', 'status',
    'registration_status', 'relationships', 'agent_id', 'agent_name', 'agent_phone', 'agent_email',
    'record_label_id', 'record_label_name', 'record_label_phone', 'record_label_email', 'record_label_contact_id', 'record_label_contact_name',
    'record_label_contact_phone', 'record_label_contact_email', 'selected_distributors', 'distributor_emails', 'company_selected_distributors', 'company_distributor_emails',
    'team_contacts', 'manager_name', 'manager_contact_encrypted', 'executive_producer', 'booking_agency', 'partner_label',
    'gallery_urls', 'documents', 'metadata', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at',
  ],
  works: [
    'id', 'tenant_id', 'project_id', 'society_code', 'ecad_code', 'iswc',
    'title', 'music_genre', 'legacy_language_label', 'duration_text', 'legacy_instrumental_flag', 'legacy_ai_used',
    'status', 'ai_usage_level', 'ai_harmony', 'ai_melody', 'ai_lyrics', 'legacy_alternative_titles',
    'related_references', 'legacy_lyrics', 'artist_id', 'type', 'work_origin', 'composer_name',
    'composer_names', 'publisher_name', 'translator_names', 'isrc', 'alternative_titles', 'language',
    'lyrics', 'is_instrumental', 'duration_seconds', 'registry_status', 'external_reference', 'ai_used',
    'ai_tools', 'ai_prompts', 'external_source', 'external_source_id', 'external_source_synced_at', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ],
  work_participants: [
    'id', 'tenant_id', 'work_id', 'name', 'role', 'link',
    'percentage', 'sort_order', 'created_at', 'updated_at',
  ],
  phonograms: [
    'id', 'tenant_id', 'work_id', 'title', 'society_code', 'ecad_code',
    'aggregator', 'isrc', 'isrc_country_code', 'isrc_registrant_code', 'isrc_year', 'isrc_designation_code',
    'ai_used', 'is_instrumental', 'issue_date', 'legacy_recording_date', 'legacy_release_date', 'duration_text',
    'legacy_duration_minutes', 'legacy_duration_seconds_part', 'music_genre', 'media_type', 'is_national', 'is_simultaneous_publication',
    'legacy_origin_country', 'publication_country', 'recording_classification', 'status', 'participation', 'audio_file',
    'notes', 'artist_id', 'type',
    'record_label_name', 'version_title', 'recording_date', 'release_date', 'phonographic_producer_id', 'main_artist_id',
    'label_id', 'copyright_year', 'copyright_owner', 'country_of_recording', 'audio_file_id', 'duration_seconds',
    'registry_status', 'external_reference', 'external_source', 'external_source_id', 'external_source_synced_at', 'metadata',
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
    'instrumental', 'duration_minutes', 'duration_seconds', 'music_genre', 'language', 'lyrics',
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
    'id', 'tenant_id', 'person_type', 'category', 'profile', 'name',
    'photo_url', 'individual_name', 'legal_name', 'trade_name', 'cpf_cnpj_encrypted', 'email_encrypted',
    'phone_encrypted', 'instagram', 'job_title', 'street', 'street_number', 'address_complement',
    'neighborhood', 'city', 'state', 'zip_code', 'address', 'legacy_contact_status',
    'priority', 'responsible_name', 'responsible_job_title', 'responsible_email', 'responsible_phone', 'attachments',
    'notes', 'interactions', 'status', 'metadata', 'created_at', 'updated_at',
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
    'id', 'tenant_id', 'title', 'work_id', 'work_title', 'artist_name',
    'client_id', 'client_name', 'project_name', 'type', 'usage_type', 'target_media',
    'territory', 'status', 'start_date', 'end_date', 'amount', 'currency',
    'notes', 'remuneration_type', 'artist_id', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at', 'percentage',
  ],
  takedowns: [
    'id', 'tenant_id', 'title', 'type', 'affected_work', 'artist_name',
    'status', 'priority', 'platform', 'infringing_url', 'reason', 'identified_at',
    'description', 'evidence', 'notes', 'metadata', 'created_at', 'updated_at',
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
