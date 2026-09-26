/**
 * auth-password.service.ts  (Part 73, redone in Part 74)
 *
 * Part 73 had two competing sources of truth: the frontend changed the
 * password directly in Supabase (client-side, updateUser({password})) and THEN
 * called a separate endpoint only to clear `must_change_password` — without
 * any proof that the change actually happened. That is not atomic: the
 * frontend never got to implement that second call (Part 74,
 * Block 2), and even if it had, a malicious client could call only
 * the "clear" without ever actually changing the password.
 *
 * Part 74: a single atomic operation. `changeRequiredPassword()` validates the
 * new password, physically changes it in Supabase Auth via the Admin API AND clears
 * `must_change_password` IN THE SAME CALL (`updateUserById({ password,
 * app_metadata })`) — if GoTrue rejects it (weak password by its own rule,
 * rate limit, etc.), nothing changes: the flag stays true, no audit record is
 * written. Only after success is confirmed do we record
 * `user.password_changed`.
 */
import { BadRequestException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { AuditService } from '../../core/audit/audit.service';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { strongPasswordViolations } from '../../core/security/password-policy';
import type { ChangeRequiredPasswordDto } from './dto/change-required-password.dto';

@Injectable()
export class AuthPasswordService {
  constructor(
    @Optional() private readonly config: ConfigService | undefined,
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly audit: AuditService,
  ) {}

  private env(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  private supabaseAdmin() {
    const url = this.env('SUPABASE_URL');
    const key = this.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new ServiceUnavailableException('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas — não é possível trocar a senha.');
    }
    return createClient(url, key);
  }

  /**
   * Attempt to block reuse of the current temporary password, "when
   * technically verifiable" (Part 74, Block 5): the only way to prove
   * that `candidate` equals the current password without the hash is to try to log in with
   * it. Best-effort — if SUPABASE_ANON_KEY or the e-mail are not
   * available, or the call fails for any network reason, it simply
   * skips the check (never blocks the real change because of it).
   */
  private async isSameAsCurrentPassword(email: string | undefined, candidate: string): Promise<boolean> {
    const url = this.env('SUPABASE_URL');
    const anonKey = this.env('SUPABASE_ANON_KEY');
    if (!url || !anonKey || !email) return false;
    try {
      const anon = createClient(url, anonKey);
      const { data, error } = await anon.auth.signInWithPassword({ email, password: candidate });
      if (data?.session) {
        // We do not need (nor want) to keep this test session alive.
        await anon.auth.signOut().catch(() => {});
      }
      return !error && !!data?.session;
    } catch {
      return false;
    }
  }

  async changeRequiredPassword(
    auth: JwtAuth,
    tenantId: string | null,
    dto: ChangeRequiredPasswordDto,
    accessToken: string | null,
  ): Promise<{ passwordChanged: true; mustRefreshSession: true }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('As senhas não coincidem.');
    }

    const violations = strongPasswordViolations(dto.newPassword);
    if (violations.length > 0) {
      throw new BadRequestException(`Senha fraca — requisitos pendentes: ${violations.join(', ')}.`);
    }

    const email = auth.claims['email'] as string | undefined;
    if (await this.isSameAsCurrentPassword(email, dto.newPassword)) {
      throw new BadRequestException('A nova senha não pode ser igual à senha provisória atual.');
    }

    const currentAppMetadata = (auth.claims['app_metadata'] as Record<string, unknown> | undefined) ?? {};
    const supabase = this.supabaseAdmin();

    // Atomic: password and app_metadata change in the SAME Admin API call. If
    // GoTrue rejects it, neither the password nor the flag change — the catch below ensures
    // nothing is audited in that case.
    const { error } = await supabase.auth.admin.updateUserById(auth.userId, {
      password: dto.newPassword,
      app_metadata: { ...currentAppMetadata, must_change_password: false },
    });
    if (error) {
      throw new ServiceUnavailableException(`Falha ao trocar a senha: ${error.message}`);
    }

    // Best-effort: revokes this account's sessions other than the current one (e.g.
    // someone else using the compromised temporary password elsewhere).
    // Must never undo the already confirmed success of the password change.
    if (accessToken) {
      await supabase.auth.admin.signOut(accessToken, 'others').catch(() => {});
    }

    await this.audit.log({
      tenantId,
      orgId: auth.orgId,
      userId: auth.userId,
      actorRole: auth.orgRole,
      action: 'user.password_changed',
      entity: 'user',
      entityId: auth.userId,
    });

    return { passwordChanged: true, mustRefreshSession: true };
  }
}
