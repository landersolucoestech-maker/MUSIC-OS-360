/**
 * Pure registry rule evaluators — no DB. Given an entity + its active shares,
 * return validation issues. The orchestrating SocietyValidationService loads the
 * data, calls these, and persists the results.
 */

import { Injectable } from '@nestjs/common';
import { SocietyValidationSeverity } from '@music-os-360/types';
import type { WorkEntity, PhonogramEntity, ShareEntity } from '../../../database/entities';
import type { RegistryValidationIssue } from '../payloads/registry-payload.types';
import { isValidIsrc, isValidCpf, isValidCnpj, onlyDigits } from '../validators/registry-validators';
import { isRegistryEligibleShare } from '../../shares/share-eligibility.util';

const E = SocietyValidationSeverity.ERROR;
const W = SocietyValidationSeverity.WARNING;

function issue(severity: SocietyValidationSeverity, code: string, field: string | null, message: string): RegistryValidationIssue {
  return { severity, code, field_path: field, message };
}

function toPercent(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isPublisherRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return r.includes('publisher') || r.includes('editor');
}

// Canonical share roles are English (CZ-037: party_role author/composer/
// performer/producer/publisher); the Portuguese substrings only tolerate
// free-text roles on rows outside the migrated vocabulary.
function isInterpreterRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return r.includes('performer') || r.includes('interpret') || r.includes('main_artist') || r.includes('artist') || r.includes('vocal') || r.includes('cantor');
}

function isProducerRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return r.includes('producer') || r.includes('produtor');
}

function validateDocumentSoft(doc: string | null | undefined): boolean {
  if (!doc) return true;
  const digits = onlyDigits(doc);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return true; // unknown length — not blocked here
}

@Injectable()
export class WorkRegistryValidationService {
  validate(work: WorkEntity, shares: ShareEntity[]): RegistryValidationIssue[] {
    const issues: RegistryValidationIssue[] = [];
    const active = shares.filter((s) => !s.deleted_at);
    // Registry eligibility (isRegistryEligibleShare) — financial/
    // pending shares (see Phase 5 / C6) never count as an author nor
    // enter the splits sum.
    const eligible = active.filter(isRegistryEligibleShare);

    if (!work.title || !work.title.trim()) {
      issues.push(issue(E, 'work_title_required', 'title', 'Título da obra é obrigatório.'));
    }

    const authors = eligible.filter((s) => !isPublisherRole(s.role ?? s.party_role));
    if (authors.length === 0) {
      issues.push(issue(E, 'work_no_author', 'authors', 'A obra precisa de pelo menos um autor/compositor.'));
    }

    let percentageSum = 0;
    for (const s of eligible) {
      if (!s.holder_name || !s.holder_name.trim()) {
        issues.push(issue(E, 'work_split_holder_name_missing', 'splits.holder_name', `Share ${s.id} elegível para registro está sem holder_name.`));
      }
      if (s.percentage == null) {
        issues.push(issue(E, 'work_split_percentage_missing', 'splits.percentage', `Share ${s.id} elegível para registro está sem percentage.`));
        continue;
      }
      const p = toPercent(s.percentage);
      if (p < 0 || p > 100) {
        issues.push(issue(E, 'work_split_percentage_invalid', 'splits', `Percentual inválido (${p}). Deve estar entre 0 e 100.`));
      }
      percentageSum += p;
      if (!validateDocumentSoft(s.holder_document)) {
        issues.push(issue(W, 'work_invalid_document', 'splits.document', `Documento do titular "${s.holder_name}" parece inválido.`));
      }
    }

    if (eligible.length > 0) {
      if (Math.abs(percentageSum - 100) > 0.01) {
        issues.push(issue(E, 'work_split_not_100', 'splits', `A soma dos splits ativos deve ser 100% (atual: ${percentageSum.toFixed(2)}%).`));
      }
    }

    if (work.ai_used === true) {
      const tools = Array.isArray(work.ai_tools) ? work.ai_tools : [];
      const prompts = Array.isArray(work.ai_prompts) ? work.ai_prompts : [];
      if (tools.length === 0 && prompts.length === 0) {
        issues.push(issue(E, 'work_ai_declaration_missing', 'ai_declaration', 'IA declarada: informe ferramentas (ai_tools) ou prompts (ai_prompts).'));
      }
    }

    return issues;
  }
}

@Injectable()
export class RecordingRegistryValidationService {
  validate(recording: PhonogramEntity, shares: ShareEntity[]): RegistryValidationIssue[] {
    const issues: RegistryValidationIssue[] = [];
    const active = shares.filter((s) => !s.deleted_at);
    // Registry eligibility via isRegistryEligibleShare (see Phase 5 / C6).
    const eligible = active.filter(isRegistryEligibleShare);

    // The Work link is optional: a recording may exist, and be registered, with no Work and its registration
    // does not depend on the Work's status. No issue is raised for an absent work_id.
    if (!recording.title || !recording.title.trim()) {
      issues.push(issue(E, 'recording_title_required', 'title', 'Título do fonograma é obrigatório.'));
    }

    // duration_seconds is authoritative; the duration_text fallback stays until migration 20260930000038
    // (BackfillPhonogramDerivedFields) has run everywhere (census: no row with duration_seconds IS NULL AND a
    // well-formed duration_text). Only then may hasDuration read duration_seconds alone.
    const hasDuration = (recording.duration_seconds ?? 0) > 0 || !!(recording.duration_text && recording.duration_text.trim());
    if (!hasDuration) {
      issues.push(issue(E, 'recording_duration_required', 'duration_seconds', 'Duração do fonograma é obrigatória.'));
    }

    const hasMainArtist = !!recording.main_artist_id || !!recording.artist_id ||
      eligible.some((s) => isInterpreterRole(s.role ?? s.party_role));
    if (!hasMainArtist) {
      issues.push(issue(E, 'recording_main_artist_required', 'main_artist', 'Fonograma precisa de um artista principal/intérprete.'));
    }

    const hasProducer = !!recording.phonographic_producer_id ||
      eligible.some((s) => isProducerRole(s.role ?? s.party_role));
    if (!hasProducer) {
      issues.push(issue(E, 'recording_producer_required', 'phonographic_producer', 'Fonograma precisa de um produtor fonográfico.'));
    }

    const hasInterpreter = eligible.some((s) => isInterpreterRole(s.role ?? s.party_role)) || !!recording.artist_id;
    if (!hasInterpreter) {
      issues.push(issue(E, 'recording_no_interpreter', 'interpreters', 'Fonograma precisa de pelo menos um intérprete.'));
    }

    // The Phonogram split is its own structure (independent of the Work split and of the Release shares) and must
    // total exactly 100% before the formal registration. While the Phonogram is only being built (for example created
    // from a Project) partial or empty splits are allowed; this check runs only at the registry stage.
    let percentageSum = 0;
    for (const s of eligible) {
      if (s.percentage == null) {
        issues.push(issue(E, 'recording_split_percentage_missing', 'splits.percentage', `Share ${s.id} elegível para registro está sem percentage.`));
        continue;
      }
      const p = toPercent(s.percentage);
      if (p < 0 || p > 100) {
        issues.push(issue(E, 'recording_split_percentage_invalid', 'splits', `Percentual inválido (${p}). Deve estar entre 0 e 100.`));
      }
      percentageSum += p;
    }
    if (Math.abs(percentageSum - 100) > 0.01) {
      issues.push(issue(E, 'recording_split_not_100', 'splits', `A soma dos splits do fonograma deve ser 100% (atual: ${percentageSum.toFixed(2)}%).`));
    }

    if (recording.isrc && !isValidIsrc(recording.isrc)) {
      issues.push(issue(E, 'recording_isrc_invalid', 'isrc', 'ISRC inválido. Deixe vazio para PENDING_ISRC ou corrija o formato.'));
    }

    return issues;
  }
}
