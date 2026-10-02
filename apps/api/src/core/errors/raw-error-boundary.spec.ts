import {
  API_ERROR_CODES,
  API_ERROR_CODE_COPY_PT_BR,
  classifyFailureCode,
  isApiErrorCode,
} from '@music-os-360/types';
import { toPublicSocialPlatformProfile } from '../../modules/artists/platform-profiles/social-platform-sync.types';
import { toPublicSkillRun } from '../skills/skill-run.service';
import { toPublicWorkflowExecution, toPublicWorkflowExecutionLog } from '../workflow/workflow-execution.service';
import { toPublicSocietySyncJob } from '../../modules/registry/society/society-sync.service';

const RAW =
  'connect ECONNREFUSED 10.0.0.5:5432 — duplicate key value violates unique constraint "uq_x" at Object.<anonymous> (/srv/app/dist/x.js:10:5)';

describe('raw error boundary: stable codes instead of raw provider/database text', () => {
  it('classifyFailureCode maps raw text to a stable code and never echoes the text', () => {
    expect(classifyFailureCode('Spotify API responded 429')).toBe('PROVIDER_RATE_LIMITED');
    expect(classifyFailureCode('YouTube API 403 forbidden')).toBe('PROVIDER_UNAUTHORIZED');
    expect(classifyFailureCode('Identity diverges (IDENTITY_MISMATCH)')).toBe('IDENTITY_MISMATCH');
    expect(classifyFailureCode('PROFILE_NOT_FOUND')).toBe('PROFILE_NOT_FOUND');
    expect(classifyFailureCode(RAW)).toBe('SYNC_FAILED');
    expect(classifyFailureCode(RAW, 'PUBLICATION_FAILED')).toBe('PUBLICATION_FAILED');
    expect(classifyFailureCode(null)).toBe('SYNC_FAILED');
    expect(isApiErrorCode(classifyFailureCode(RAW))).toBe(true);
  });

  it('shared list: every code has PT-BR copy and the list is derived from one table', () => {
    expect(API_ERROR_CODES.length).toBe(Object.keys(API_ERROR_CODE_COPY_PT_BR).length);
    for (const code of API_ERROR_CODES) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(API_ERROR_CODE_COPY_PT_BR[code].length).toBeGreaterThan(0);
    }
    expect(isApiErrorCode('constructor')).toBe(false);
  });

  it('platform profile DTO: last_error_code only, raw text never serialized', () => {
    const dto = toPublicSocialPlatformProfile({ sync_status: 'failed', last_error: RAW } as never);
    expect(dto.last_error_code).toBe('SYNC_FAILED');
    expect(dto.last_error).toBe('SYNC_FAILED');
    expect(JSON.stringify(dto)).not.toMatch(/ECONNREFUSED|duplicate key|10\.0\.0\.5|dist\/x\.js/);
    expect(toPublicSocialPlatformProfile({ last_error: null } as never).last_error_code).toBeNull();
  });

  it('skill run DTO: error_message removed, error_code exposed', () => {
    const dto = toPublicSkillRun({ id: 'r', status: 'failed', error_message: RAW } as never);
    expect(dto).not.toHaveProperty('error_message');
    expect(dto.error_code).toBe('SKILL_RUN_FAILED');
    expect(JSON.stringify(dto)).not.toContain('ECONNREFUSED');
    expect(toPublicSkillRun({ id: 'r', status: 'success', error_message: null } as never).error_code).toBeNull();
  });

  it('workflow execution DTO: error_message removed, error_code exposed, failed log text replaced', () => {
    const dto = toPublicWorkflowExecution({ id: 'w', status: 'failed', error_message: RAW } as never);
    expect(dto).not.toHaveProperty('error_message');
    expect(dto.error_code).toBe('WORKFLOW_EXECUTION_FAILED');
    expect(JSON.stringify(dto)).not.toMatch(/ECONNREFUSED|duplicate key|10\.0\.0\.5|dist\/x\.js/);
    expect(toPublicWorkflowExecution({ id: 'w', status: 'success', error_message: null } as never).error_code).toBeNull();
    const log = toPublicWorkflowExecutionLog({ id: 'l', status: 'failed', message: RAW, payload: { a: RAW } } as never);
    expect(log.message).toBe('WORKFLOW_EXECUTION_FAILED');
    expect(JSON.stringify(log)).not.toContain('ECONNREFUSED');
  });

  it('society sync job DTO: error_message removed, error_code exposed', () => {
    const dto = toPublicSocietySyncJob({ id: 'j', error_message: RAW } as never);
    expect(dto).not.toHaveProperty('error_message');
    expect(dto.error_code).toBe('INTEGRATION_CALL_FAILED');
    expect(JSON.stringify(dto)).not.toContain('ECONNREFUSED');
  });
});
