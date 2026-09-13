/**
 * leads.workflow.ts
 *
 * Workflow de ciclo de vida para Leads (CRM).
 * Estados: new → contacted → qualified → proposal → closed / lost
 */

import { LeadStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const LEADS_WORKFLOW: WorkflowDefinition<string> = {
  name:         'leads',
  entityType:   'lead',
  initialState: LeadStatus.NEW,
  states: Object.values(LeadStatus),
  transitions: [
    {
      from:  LeadStatus.NEW,
      to:    LeadStatus.CONTACTED,
      label: 'Iniciar Contato',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  [LeadStatus.NEW, LeadStatus.CONTACTED],
      to:    LeadStatus.IN_CONTACT,
      label: 'Em Contato',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  [LeadStatus.CONTACTED, LeadStatus.IN_CONTACT],
      to:    LeadStatus.QUALIFIED,
      label: 'Qualificar Lead',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  LeadStatus.QUALIFIED,
      to:    LeadStatus.PROPOSAL,
      label: 'Enviar Proposta',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  LeadStatus.PROPOSAL,
      to:    LeadStatus.NEGOTIATION,
      label: 'Em Negociação',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  [LeadStatus.PROPOSAL, LeadStatus.NEGOTIATION],
      to:    LeadStatus.CLOSED,
      label: 'Fechar Negócio',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.IN_CONTACT,
        LeadStatus.QUALIFIED,
        LeadStatus.PROPOSAL,
        LeadStatus.NEGOTIATION,
      ],
      to:    LeadStatus.LOST,
      label: 'Marcar como Perdido',
      roles: ['super_admin','tenant_owner','owner','admin','manager','comercial'],
    },
    {
      from:  [LeadStatus.LOST, LeadStatus.INACTIVE],
      to:    LeadStatus.NEW,
      label: 'Reativar Lead',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [LeadStatus.CLOSED, LeadStatus.LOST],
      to:    LeadStatus.INACTIVE,
      label: 'Arquivar',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
  ],
};
