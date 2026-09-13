/**
 * projects.workflow.ts
 *
 * Workflow de ciclo de vida para Projetos musicais.
 * Conforme spec: planning → in_progress → review → completed / cancelled
 */

import { ProjectStatus } from '@music-os-360/types';
import { WorkflowDefinition } from '../workflow.types';

export const PROJECTS_WORKFLOW: WorkflowDefinition<string> = {
  name:         'projects',
  entityType:   'project',
  initialState: ProjectStatus.PLANNING,
  states: Object.values(ProjectStatus),
  transitions: [
    {
      from:  ProjectStatus.PLANNING,
      to:    ProjectStatus.IN_PROGRESS,
      label: 'Iniciar Projeto',
      roles: ['super_admin','tenant_owner','owner','admin','manager','produtor'],
    },
    {
      from:  ProjectStatus.IN_PROGRESS,
      to:    ProjectStatus.REVIEW,
      label: 'Enviar para Revisão',
      roles: ['super_admin','tenant_owner','owner','admin','manager','produtor'],
    },
    {
      from:  ProjectStatus.REVIEW,
      to:    ProjectStatus.IN_PROGRESS,
      label: 'Solicitar Alterações',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  ProjectStatus.REVIEW,
      to:    ProjectStatus.COMPLETED,
      label: 'Concluir Projeto',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
    {
      from:  [
        ProjectStatus.PLANNING,
        ProjectStatus.IN_PROGRESS,
        ProjectStatus.REVIEW,
      ],
      to:    ProjectStatus.CANCELLED,
      label: 'Cancelar Projeto',
      roles: ['super_admin','tenant_owner','owner','admin','manager'],
    },
  ],
};
