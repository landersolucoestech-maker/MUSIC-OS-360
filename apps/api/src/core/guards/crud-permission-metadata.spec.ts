import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ArtistGoalsController } from '../../modules/artist-goals/artist-goals.controller';
import { WorksController } from '../../modules/works/works.controller';
import { PhonogramsController } from '../../modules/phonograms/phonograms.controller';
import { SharesController } from '../../modules/shares/shares.controller';
import { ClientsController } from '../../modules/clients/clients.controller';
import { ContactsController } from '../../modules/contacts/contacts.controller';
import { LeadsController } from '../../modules/leads/leads.controller';
import { LeadInteractionsController } from '../../modules/lead-interactions/lead-interactions.controller';
import { ProjectsController } from '../../modules/projects/projects.controller';
import { EventsController } from '../../modules/events/events.controller';
import { InventoryController } from '../../modules/inventory/inventory.controller';
import { LicensingController } from '../../modules/licensing/licensing.controller';
import { FinancialCategoriesController } from '../../modules/financial-categories/financial-categories.controller';
import { FinancialRulesController } from '../../modules/financial-rules/financial-rules.controller';
import { FinanceCategoryRulesController } from '../../modules/finance-category-rules/finance-category-rules.controller';
import { TransactionsController } from '../../modules/transactions/transactions.controller';
import { InvoicesController } from '../../modules/invoices/invoices.controller';
import { ContractsController } from '../../modules/contracts/contracts.controller';
import { ContractTemplatesController } from '../../modules/contract-templates/contract-templates.controller';

type ControllerClass = abstract new (...args: never[]) => object;

type ExpectedRoute = {
  controller: ControllerClass;
  methodName: string;
  httpMethod: RequestMethod;
  path: string;
  role: string;
  permission: string;
};

const normalizePath = (path: unknown) => {
  if (path === undefined || path === '' || path === '/') return '';
  return String(path);
};

const getHandler = (controller: ControllerClass, methodName: string) =>
  (controller.prototype as Record<string, object>)[methodName];

const expectedRoutes: ExpectedRoute[] = [
  { controller: ArtistGoalsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'artist_goal:read' },
  { controller: ArtistGoalsController, methodName: 'findOne', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'artist_goal:read' },
  { controller: ArtistGoalsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'artist_goal:create' },
  { controller: ArtistGoalsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'artist_goal:update' },
  { controller: ArtistGoalsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'artist_goal:delete' },

  { controller: WorksController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'work:read' },
  { controller: WorksController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'work:read' },
  { controller: WorksController, methodName: 'distinctGeneros', httpMethod: RequestMethod.GET, path: 'stats/generos', role: 'viewer', permission: 'work:read' },
  { controller: WorksController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'work:read' },
  { controller: WorksController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'work:create' },
  { controller: WorksController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'work:update' },
  { controller: WorksController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'work:delete' },

  { controller: PhonogramsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'phonogram:read' },
  { controller: PhonogramsController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'phonogram:read' },
  { controller: PhonogramsController, methodName: 'distinctGeneros', httpMethod: RequestMethod.GET, path: 'stats/generos', role: 'viewer', permission: 'phonogram:read' },
  { controller: PhonogramsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'phonogram:read' },
  { controller: PhonogramsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'phonogram:create' },
  { controller: PhonogramsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'phonogram:update' },
  { controller: PhonogramsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'phonogram:delete' },

  { controller: SharesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'share:read' },
  { controller: SharesController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'share:read' },
  { controller: SharesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'share:read' },
  { controller: SharesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'share:create' },
  { controller: SharesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'share:update' },
  { controller: SharesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'share:delete' },

  { controller: ClientsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'client:create' },
  { controller: ClientsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'client:update' },
  { controller: ClientsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'client:delete' },
  // Parte 80 — timeline, contratos vinculados e anexos (sub-rotas de clients).
  { controller: ClientsController, methodName: 'getTimeline', httpMethod: RequestMethod.GET, path: ':id/timeline', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'addTimelineEntry', httpMethod: RequestMethod.POST, path: ':id/timeline', role: 'editor', permission: 'client:update' },
  { controller: ClientsController, methodName: 'getContracts', httpMethod: RequestMethod.GET, path: ':id/contracts', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'runDealsCrm', httpMethod: RequestMethod.POST, path: ':id/ai/deals-crm', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'listAttachments', httpMethod: RequestMethod.GET, path: ':id/attachments', role: 'viewer', permission: 'client:read' },
  { controller: ClientsController, methodName: 'presignAttachment', httpMethod: RequestMethod.POST, path: ':id/attachments/presign', role: 'editor', permission: 'client:update' },
  { controller: ClientsController, methodName: 'confirmAttachment', httpMethod: RequestMethod.POST, path: ':id/attachments', role: 'editor', permission: 'client:update' },
  { controller: ClientsController, methodName: 'removeAttachment', httpMethod: RequestMethod.DELETE, path: ':id/attachments/:attachmentId', role: 'editor', permission: 'client:update' },

  { controller: ContactsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'contact:read' },
  { controller: ContactsController, methodName: 'getById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'contact:read' },
  { controller: ContactsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'contact:create' },
  { controller: ContactsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'contact:update' },
  { controller: ContactsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'contact:delete' },

  { controller: LeadsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'lead:read' },
  { controller: LeadsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'lead:read' },
  { controller: LeadsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'lead:create' },
  { controller: LeadsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'lead:update' },
  { controller: LeadsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'lead:delete' },

  { controller: LeadInteractionsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'lead_interaction:read' },
  { controller: LeadInteractionsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'lead_interaction:create' },
  { controller: LeadInteractionsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'lead_interaction:delete' },

  { controller: ProjectsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'project:read' },
  { controller: ProjectsController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'project:read' },
  { controller: ProjectsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'project:read' },
  { controller: ProjectsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'project:create' },
  { controller: ProjectsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'project:update' },
  { controller: ProjectsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'project:delete' },

  { controller: EventsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'event:read' },
  { controller: EventsController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'event:read' },
  { controller: EventsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'event:read' },
  { controller: EventsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'event:create' },
  { controller: EventsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'event:update' },
  { controller: EventsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'event:delete' },

  { controller: InventoryController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'inventory:read' },
  { controller: InventoryController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'inventory:read' },
  { controller: InventoryController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'inventory:read' },
  { controller: InventoryController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'inventory:create' },
  { controller: InventoryController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'inventory:update' },
  { controller: InventoryController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'inventory:delete' },

  { controller: LicensingController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'license:read' },
  // Task H: contagem + soma de valor por status sobre o tenant inteiro (KPIs exatos).
  { controller: LicensingController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'license:read' },
  { controller: LicensingController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'license:read' },
  { controller: LicensingController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'license:create' },
  { controller: LicensingController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'license:update' },
  { controller: LicensingController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'license:delete' },

  { controller: FinancialCategoriesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'tree', httpMethod: RequestMethod.GET, path: 'tree', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'search', httpMethod: RequestMethod.GET, path: 'search', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'descendants', httpMethod: RequestMethod.GET, path: ':id/descendants', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'ancestors', httpMethod: RequestMethod.GET, path: ':id/ancestors', role: 'viewer', permission: 'financial_category:read' },
  { controller: FinancialCategoriesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'financial', permission: 'financial_category:create' },
  { controller: FinancialCategoriesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'financial', permission: 'financial_category:update' },
  { controller: FinancialCategoriesController, methodName: 'move', httpMethod: RequestMethod.PATCH, path: ':id/move', role: 'financial', permission: 'financial_category:update' },
  { controller: FinancialCategoriesController, methodName: 'reorder', httpMethod: RequestMethod.PATCH, path: ':id/reorder', role: 'financial', permission: 'financial_category:reorder' },
  { controller: FinancialCategoriesController, methodName: 'archive', httpMethod: RequestMethod.PATCH, path: ':id/archive', role: 'financial', permission: 'financial_category:update' },
  { controller: FinancialCategoriesController, methodName: 'restore', httpMethod: RequestMethod.PATCH, path: ':id/restore', role: 'manager', permission: 'financial_category:update' },
  { controller: FinancialCategoriesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'financial_category:delete' },

  { controller: FinancialRulesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'financial_rule:read' },
  { controller: FinancialRulesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'financial_rule:read' },
  { controller: FinancialRulesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'manager', permission: 'financial_rule:create' },
  { controller: FinancialRulesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'manager', permission: 'financial_rule:update' },
  { controller: FinancialRulesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'admin', permission: 'financial_rule:delete' },

  { controller: FinanceCategoryRulesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'financial_category_rule:read' },
  { controller: FinanceCategoryRulesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'financial_category_rule:read' },
  { controller: FinanceCategoryRulesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'financial', permission: 'financial_category_rule:create' },
  { controller: FinanceCategoryRulesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'financial', permission: 'financial_category_rule:update' },
  { controller: FinanceCategoryRulesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'financial_category_rule:delete' },

  { controller: TransactionsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'transaction:read' },
  { controller: TransactionsController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'transaction:read' },
  { controller: TransactionsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'transaction:read' },
  { controller: TransactionsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'financial', permission: 'transaction:create' },
  { controller: TransactionsController, methodName: 'replace', httpMethod: RequestMethod.PUT, path: ':id', role: 'financial', permission: 'transaction:update' },
  { controller: TransactionsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'financial', permission: 'transaction:update' },
  { controller: TransactionsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'transaction:cancel' },

  { controller: InvoicesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'invoice:read' },
  { controller: InvoicesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'invoice:read' },
  { controller: InvoicesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'financial', permission: 'invoice:create' },
  { controller: InvoicesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'financial', permission: 'invoice:update' },
  { controller: InvoicesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'invoice:cancel' },

  // FASE 6.6 — Contracts (DELETE tem semântica de cancelamento → contract:cancel, não delete).
  { controller: ContractsController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'contract:read' },
  // Task H: contagem + soma de valor por status sobre o tenant inteiro (KPIs exatos).
  { controller: ContractsController, methodName: 'stats', httpMethod: RequestMethod.GET, path: 'stats', role: 'viewer', permission: 'contract:read' },
  { controller: ContractsController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'contract:read' },
  { controller: ContractsController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'contract:create' },
  { controller: ContractsController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'contract:update' },
  { controller: ContractsController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'contract:cancel' },

  // FASE 6.6 — Contract Templates (DELETE tem semântica de arquivamento → contract_template:archive).
  { controller: ContractTemplatesController, methodName: 'list', httpMethod: RequestMethod.GET, path: '', role: 'viewer', permission: 'contract_template:read' },
  { controller: ContractTemplatesController, methodName: 'findById', httpMethod: RequestMethod.GET, path: ':id', role: 'viewer', permission: 'contract_template:read' },
  { controller: ContractTemplatesController, methodName: 'create', httpMethod: RequestMethod.POST, path: '', role: 'editor', permission: 'contract_template:create' },
  { controller: ContractTemplatesController, methodName: 'update', httpMethod: RequestMethod.PATCH, path: ':id', role: 'editor', permission: 'contract_template:update' },
  { controller: ContractTemplatesController, methodName: 'remove', httpMethod: RequestMethod.DELETE, path: ':id', role: 'manager', permission: 'contract_template:archive' },
];

describe('FASE 6.1 CRUD controller permission metadata', () => {
  it.each(expectedRoutes)(
    '$controller.name.$methodName keeps @RequireRole and adds the expected @RequirePermission',
    ({ controller, methodName, httpMethod, path, role, permission }) => {
      const handler = getHandler(controller, methodName);

      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(httpMethod);
      expect(normalizePath(Reflect.getMetadata(PATH_METADATA, handler))).toBe(path);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([role]);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([permission]);
    },
  );

  it.each([...new Set(expectedRoutes.map((route) => route.controller))])(
    '%s has no @RequirePermission on routes outside the expected CRUD set',
    (controller) => {
      const expectedMethodNames = new Set(
        expectedRoutes
          .filter((route) => route.controller === controller)
          .map((route) => route.methodName),
      );

      const permissionDecoratedMethods = Object.getOwnPropertyNames(controller.prototype)
        .filter((methodName) => methodName !== 'constructor')
        .filter((methodName) => Reflect.getMetadata(PERMISSIONS_KEY, getHandler(controller, methodName)));

      expect(permissionDecoratedMethods.sort()).toEqual([...expectedMethodNames].sort());
    },
  );

  it('keeps RBAC permission enforcement off unless explicitly enabled', () => {
    expect(process.env['RBAC_PERSISTED_AUTHORITY']).not.toBe('ON');
  });

  it('uses a specific permission for financial category reorder', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, FinancialCategoriesController.prototype.reorder)).toEqual([
      'financial_category:reorder',
    ]);
  });

  it('uses cancel permissions for financial delete routes that cancel records', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, TransactionsController.prototype.remove)).toEqual([
      'transaction:cancel',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, InvoicesController.prototype.remove)).toEqual([
      'invoice:cancel',
    ]);
  });

  it('FASE 6.6: contract/template delete routes use cancel/archive (não delete nem update)', () => {
    // contracts DELETE = "Cancelar contrato (soft delete auditável)" → contract:cancel
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.remove)).toEqual([
      'contract:cancel',
    ]);
    // contract-templates DELETE = "Arquivar template" → contract_template:archive
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractTemplatesController.prototype.remove)).toEqual([
      'contract_template:archive',
    ]);
    // garante que NÃO mascaram a semântica como update/delete
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.remove)).not.toContain('contract:update');
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.remove)).not.toContain('contract:delete');
  });
});
