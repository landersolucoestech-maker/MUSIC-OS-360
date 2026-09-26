import { ROLES_KEY } from '../../core/decorators/roles.decorator';
import { BillingController } from './billing.controller';

/**
 * find-340abf0b — GET /billing/admin/stripe-mode é rota do Painel Admin SaaS:
 * precisa exigir super_admin como as demais rotas admin/*. Sem essa
 * metadata, RolesGuard trataria a rota GET como aberta a qualquer usuário
 * autenticado do tenant.
 */
describe('BillingController.getAdminStripeMode — authorization', () => {
  it('exige exatamente super_admin', () => {
    const handler = BillingController.prototype.getAdminStripeMode;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['super_admin']);
  });

  it('delega ao BillingService.getStripeMode sem transformar a resposta', () => {
    const billing = { getStripeMode: jest.fn().mockReturnValue({ environment: 'sandbox', keyState: 'VALID_TEST_KEY' }) };
    const ctrl = Object.create(BillingController.prototype) as BillingController;
    (ctrl as unknown as { billing: unknown }).billing = billing;
    expect(ctrl.getAdminStripeMode()).toEqual({ environment: 'sandbox', keyState: 'VALID_TEST_KEY' });
  });
});
