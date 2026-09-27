import { ROLES_KEY } from '../../core/decorators/roles.decorator';
import { BillingController } from './billing.controller';

/**
 * find-340abf0b — GET /billing/admin/stripe-mode is a SaaS admin panel route:
 * it must require super_admin like the other admin/* routes. Without that
 * metadata, RolesGuard would treat the GET route as open to any authenticated
 * user of the tenant.
 */
describe('BillingController.getAdminStripeMode — authorization', () => {
  it('requires exactly super_admin', () => {
    const handler = BillingController.prototype.getAdminStripeMode;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['super_admin']);
  });

  it('delegates to BillingService.getStripeMode without transforming the response', () => {
    const billing = { getStripeMode: jest.fn().mockReturnValue({ environment: 'sandbox', keyState: 'VALID_TEST_KEY' }) };
    const ctrl = Object.create(BillingController.prototype) as BillingController;
    (ctrl as unknown as { billing: unknown }).billing = billing;
    expect(ctrl.getAdminStripeMode()).toEqual({ environment: 'sandbox', keyState: 'VALID_TEST_KEY' });
  });
});
