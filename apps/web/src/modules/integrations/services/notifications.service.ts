/**
 * integrations/services/notifications.service.ts
 *
 * Transactional notifications service.
 * Orchestrates: emailAdapter + analyticsAdapter + domain events.
 *
 * Use cases in MUSIC OS 360:
 *  - Inviting a user to the tenant
 *  - Expiring contract alert
 *  - Monthly accounting report
 *  - Release approval / rejection
 *
 * Usage:
 *   import { notificationsService } from "@/modules/integrations/services";
 *   await notificationsService.sendUserInvite({ ...  });
 */

import { emailAdapter }     from "@/modules/integrations/adapters/email.adapter";
import { analyticsAdapter } from "@/modules/integrations/adapters/analytics.adapter";
import { emit }             from "@/shared/domain-events";

/* ──────────────────────────────────────── */
/* Tipos de input                           */
/* ──────────────────────────────────────── */

export interface SendUserInviteInput {
  tenantId:    string;
  tenantName:  string;
  invitedBy:   string;
  to: { name: string; email: string };
  role:        string;
  inviteUrl:   string;
}

export interface SendContratoExpiryAlertInput {
  contratoId:    string;
  contratoTitle: string;
  daysRemaining: number;
  to: { name: string; email: string };
}

export interface SendReleaseStatusInput {
  releaseId:    string;
  releaseTitle: string;
  status:          "approved" | "rejected";
  reason?:         string;
  to: { name: string; email: string };
}

/* ──────────────────────────────────────── */
/* Service                                  */
/* ──────────────────────────────────────── */

export const notificationsService = {
  async sendUserInvite(input: SendUserInviteInput): Promise<void> {
    const { tenantId, tenantName, invitedBy, to, role, inviteUrl } = input;

    await emailAdapter.send({
      to,
      subject:      `Você foi convidado para ${tenantName} no MUSIC OS 360`,
      template_id:  "user-invite",
      template_vars: { tenant_name: tenantName, invited_by: invitedBy, role, invite_url: inviteUrl },
    });

    analyticsAdapter.track("user.invite_sent", {
      tenant_id: tenantId,
      role,
      email:     to.email,
    });

    emit("user.invited", { tenantId, email: to.email, role });
  },

  async sendContratoExpiryAlert(input: SendContratoExpiryAlertInput): Promise<void> {
    const { contratoId, contratoTitle, daysRemaining, to } = input;

    await emailAdapter.send({
      to,
      subject:      `Contrato vence em ${daysRemaining} dias: ${contratoTitle}`,
      template_id:  "contract-expiry-alert",
      template_vars: { contrato_title: contratoTitle, days_remaining: daysRemaining },
    });

    analyticsAdapter.track("contract.expiry_alert_sent", {
      contract_id:    contratoId,
      days_remaining: daysRemaining,
    });
  },

  async sendReleaseStatus(input: SendReleaseStatusInput): Promise<void> {
    const { releaseId, releaseTitle, status, reason, to } = input;

    await emailAdapter.send({
      to,
      subject:      `Lançamento ${status === "approved" ? "aprovado" : "rejeitado"}: ${releaseTitle}`,
      template_id:  status === "approved" ? "release-approved" : "release-rejected",
      template_vars: { lancamento_title: releaseTitle, reason: reason ?? "" },
    });

    analyticsAdapter.track(`release.${status}`, { release_id: releaseId });

    emit(status === "approved" ? "release.approved" : "release.rejected", {
      releaseId,
      reason,
    });
  },
};
