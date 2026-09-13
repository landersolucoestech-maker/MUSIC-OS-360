/**
 * contracts.workflow.ts
 *
 * Workflow de ciclo de vida para Contratos.
 * Estados: draft → under_review → awaiting_signature → signed → in_force → terminated / cancelled
 */

import { ContractStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const CONTRACTS_WORKFLOW: WorkflowDefinition<string> = {
  name:         'contracts',
  entityType:   'contract',
  initialState: ContractStatus.DRAFT,
  states: Object.values(ContractStatus),
  transitions: [
    {
      from:  ContractStatus.DRAFT,
      to:    ContractStatus.UNDER_REVIEW,
      label: 'Enviar para Análise',
      roles: ['super_admin','tenant_owner','owner','admin','manager','juridico'],
    },
    {
      from:  ContractStatus.UNDER_REVIEW,
      to:    ContractStatus.DRAFT,
      label: 'Retornar para Rascunho',
      roles: ['super_admin','tenant_owner','owner','admin','manager','juridico'],
    },
    {
      from:  ContractStatus.UNDER_REVIEW,
      to:    ContractStatus.AWAITING_SIGNATURE,
      label: 'Aprovar para Assinatura',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  ContractStatus.AWAITING_SIGNATURE,
      to:    ContractStatus.SIGNED,
      label: 'Registrar Assinatura',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
      guard: async (ctx) => {
        const entity = ctx.entity;
        if (!entity['arquivo_url']) {
          return { allowed: false, reason: 'Contrato precisa ter o documento anexado antes de ser assinado' };
        }
        return { allowed: true };
      },
    },
    {
      from:  ContractStatus.SIGNED,
      to:    ContractStatus.IN_FORCE,
      label: 'Ativar Contrato',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  ContractStatus.IN_FORCE,
      to:    ContractStatus.EXPIRING,
      label: 'Marcar como Vencendo',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [ContractStatus.EXPIRING, ContractStatus.IN_FORCE],
      to:    ContractStatus.EXPIRED,
      label: 'Registrar Vencimento',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [ContractStatus.EXPIRED, ContractStatus.IN_FORCE, ContractStatus.SIGNED],
      to:    ContractStatus.TERMINATED,
      label: 'Encerrar Contrato',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [
        ContractStatus.DRAFT,
        ContractStatus.UNDER_REVIEW,
        ContractStatus.AWAITING_SIGNATURE,
        ContractStatus.SIGNED,
        ContractStatus.IN_FORCE,
      ],
      to:    ContractStatus.CANCELLED,
      label: 'Cancelar',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
  ],
};
