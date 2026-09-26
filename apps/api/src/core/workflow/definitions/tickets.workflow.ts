/**
 * tickets.workflow.ts
 *
 * Lifecycle workflow for Support Tickets.
 * States: open → in_progress → pending_user → resolved → closed / cancelled
 */

import { SupportTicketStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const TICKETS_WORKFLOW: WorkflowDefinition<string> = {
  name:         'tickets',
  entityType:   'ticket',
  initialState: SupportTicketStatus.OPEN,
  states: Object.values(SupportTicketStatus),
  transitions: [
    {
      from:  SupportTicketStatus.OPEN,
      to:    SupportTicketStatus.IN_PROGRESS,
      label: 'Iniciar Atendimento',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  SupportTicketStatus.IN_PROGRESS,
      to:    SupportTicketStatus.PENDING_USER,
      label: 'Aguardar Resposta do Usuário',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  SupportTicketStatus.PENDING_USER,
      to:    SupportTicketStatus.IN_PROGRESS,
      label: 'Retomar Atendimento',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.PENDING_USER],
      to:    SupportTicketStatus.RESOLVED,
      label: 'Resolver Ticket',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  SupportTicketStatus.RESOLVED,
      to:    SupportTicketStatus.CLOSED,
      label: 'Fechar Ticket',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  SupportTicketStatus.RESOLVED,
      to:    SupportTicketStatus.IN_PROGRESS,
      label: 'Reabrir Ticket',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [
        SupportTicketStatus.OPEN,
        SupportTicketStatus.IN_PROGRESS,
        SupportTicketStatus.PENDING_USER,
      ],
      to:    SupportTicketStatus.CANCELLED,
      label: 'Cancelar Ticket',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
  ],
};
