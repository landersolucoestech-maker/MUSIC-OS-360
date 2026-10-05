/**
 * billing/billing.controller.ts
 *
 * Stripe Billing controller — 4 routes:
 *   POST /api/v1/billing/checkout         — create a checkout session
 *   POST /api/v1/billing/portal           — open the management portal
 *   GET  /api/v1/billing/subscription     — current subscription
 *   POST /api/v1/billing/webhooks/stripe  — HMAC-validated webhook (public)
 *
 * JwtAuthGuard + TenantGuard run globally (APP_GUARD).
 * checkout/portal/subscription require role owner+ (critical financial management).
 * The webhook is marked @Public() — HMAC verification is done in BillingService.
 */

import {
  Controller, Post, Patch, Get, Body, Headers, Param, Query,
  Req, RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant }   from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }     from '../../core/decorators/current-user.decorator';
import { RequireRole }     from '../../core/decorators/roles.decorator';
import { Public }          from '../../core/decorators/public.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { BillingService }  from './billing.service';
import { BillingEnforcementService, TenantBillingStatus } from './billing-enforcement.service';
import { BillingPlansService } from './billing-plans.service';
import { CreateCheckoutDto, CreatePortalDto } from './dto/billing.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/billing-plans.dto';
import { AdminListQueryDto, UpdateAdminTenantDto } from './dto/admin-billing.dto';
import type { Request }    from 'express';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly enforcement: BillingEnforcementService,
    private readonly plans: BillingPlansService,
  ) {}

  // ── Plan management (primary source = database/admin; Stripe is synced) ──

  // Public route BEFORE plans/:id — otherwise ':id' would capture 'public'.
  @Get('plans/public')
  @Public()
  @ApiOperation({ summary: 'List active plans publicly (landing page) — no authentication' })
  listPublicPlans() {
    return this.plans.listPublic();
  }

  @Get('plans')
  @RequireRole('admin')
  @ApiOperation({ summary: 'List plans (admin+)' })
  listPlans(@Query('includeInactive') includeInactive?: string) {
    return this.plans.list({ includeInactive: includeInactive === 'true' });
  }

  @Get('plans/:id')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Get a plan by id (admin+)' })
  getPlan(@Param('id') id: string) {
    return this.plans.get(id);
  }

  @Post('plans')
  @RequireRole('super_admin')
  @Audit('billing.plan_created')
  @ApiOperation({ summary: 'Create a plan + sync with Stripe (super_admin)' })
  createPlan(@Body() body: CreatePlanDto) {
    return this.plans.create(body);
  }

  @Patch('plans/:id')
  @RequireRole('super_admin')
  @Audit('billing.plan_updated')
  @ApiOperation({ summary: 'Edit a plan + re-sync with Stripe (super_admin)' })
  updatePlan(@Param('id') id: string, @Body() body: UpdatePlanDto) {
    return this.plans.update(id, body);
  }

  @Post('plans/:id/sync-stripe')
  @RequireRole('super_admin')
  @Audit('billing.plan_synced')
  @ApiOperation({ summary: 'Re-sync plan with Stripe (super_admin)' })
  syncPlan(@Param('id') id: string) {
    return this.plans.syncStripe(id);
  }

  @Post('checkout')
  @RequireRole('owner')
  @Audit('billing.checkout_started')
  @ApiOperation({ summary: 'Create a Stripe checkout session (owner+)' })
  checkout(
    @CurrentTenant() tenant: any,
    @Body() body: CreateCheckoutDto,
  ) {
    return this.billing.createCheckoutSession({
      orgId:      tenant.org_id,
      tenantId:   tenant.id,
      planRef:    body.planId ?? body.planSlug ?? body.plan,
      successUrl: body.successUrl,
      cancelUrl:  body.cancelUrl,
    });
  }

  @Post('portal')
  @RequireRole('owner')
  @Audit('billing.portal_opened')
  @ApiOperation({ summary: 'Create a Stripe billing portal session (owner+)' })
  portal(
    @CurrentTenant() tenant: any,
    @Body() body: CreatePortalDto,
  ) {
    return this.billing.createPortalSession(tenant.org_id, body.returnUrl);
  }

  @Get('subscription')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Get the current subscription (admin+)' })
  getSubscription(@CurrentTenant() tenant: any) {
    return this.billing.getSubscription(tenant.org_id);
  }

  @Get('usage')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Current usage vs plan limits (admin+)' })
  getUsage(@CurrentTenant() tenant: any) {
    return this.billing.getUsage(tenant.id, tenant.org_id);
  }

  @Get('metrics/saas')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'SaaS metrics — MRR, ARR, churn, LTV (super_admin only)' })
  getSaasMetrics() {
    return this.billing.getSaasMetrics();
  }

  @Get('admin/tenants')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'List real tenants for the SaaS Admin panel' })
  listAdminTenants(@Query() query: AdminListQueryDto) {
    return this.billing.listAdminTenants(query);
  }

  @Patch('admin/tenants/:tenantId')
  @RequireRole('super_admin')
  @Audit('tenant.admin_updated')
  @ApiOperation({ summary: 'Edit a tenant from the SaaS Admin panel' })
  updateAdminTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateAdminTenantDto,
  ) {
    return this.billing.updateAdminTenant(tenantId, body);
  }

  @Get('admin/stripe-mode')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'Stripe mode in this environment (sandbox = TEST MODE, disabled) — never exposes the key' })
  getAdminStripeMode() {
    return this.billing.getStripeMode();
  }

  @Get('admin/subscriptions')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'List real subscriptions for the SaaS Admin panel' })
  listAdminSubscriptions(@Query() query: AdminListQueryDto) {
    return this.billing.listAdminSubscriptions(query);
  }

  @Get('admin/tenants/:tenantId/billing-state')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'Get a tenant\'s persisted financial state' })
  getAdminTenantBillingState(@Param('tenantId') tenantId: string) {
    return this.enforcement.getState(tenantId);
  }

  @Get('admin/invoices')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'List real billing/admin invoices' })
  listAdminInvoices(@Query() query: AdminListQueryDto & { tenantId?: string }) {
    return this.billing.listAdminInvoices(query);
  }

  @Post('admin/tenants/:tenantId/suspend')
  @RequireRole('super_admin')
  @Audit('tenant.suspended')
  suspendTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.enforcement.suspendTenant(tenantId, body.reason ?? 'manual admin suspension');
  }

  @Post('admin/tenants/:tenantId/reactivate')
  @RequireRole('super_admin')
  @Audit('tenant.reactivated')
  reactivateTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.enforcement.activateTenant(tenantId, body.reason ?? 'manual admin reactivation');
  }

  @Post('admin/tenants/:tenantId/override')
  @RequireRole('super_admin')
  @Audit('billing.override_enabled')
  applyOverride(
    @Param('tenantId') tenantId: string,
    @Body() body: { status: TenantBillingStatus; reason: string; until: string },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.enforcement.applyManualOverride({
      tenantId,
      status: body.status,
      reason: body.reason,
      until: new Date(body.until),
      userId: user?.id ?? user?.userId ?? null,
      ip: req.ip,
    });
  }

  @Post('admin/tenants/:tenantId/override/remove')
  @RequireRole('super_admin')
  @Audit('billing.override_disabled')
  removeOverride(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.enforcement.removeManualOverride(
      tenantId,
      body.reason ?? 'manual override removed',
      user?.id ?? user?.userId ?? null,
    );
  }

  // No @Audit(): there is no user actor on this path (Stripe is the author), the
  // real record of the event already exists in payment_events/webhook_events, and
  // body.id here is the Stripe event id (evt_...), not a
  // billing_subscriptions id — the AuditInterceptor's generic before-snapshot
  // (SELECT ... WHERE id = $1) broke with "invalid input syntax for type
  // uuid", poisoning the transaction opened by BillingService.handleWebhook()
  // and bringing the whole webhook down with a 500 even with a valid signature.
  @Post('webhooks/stripe')
  @Public()
  @ApiOperation({ summary: 'Stripe webhook (HMAC validated, unauthenticated)' })
  webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.billing.handleWebhook(signature, req.rawBody as Buffer);
  }
}
