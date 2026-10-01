import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { stripeClient } from '@/modules/integrations/clients/stripe.client';
import { AUTH_DISABLED } from '@/shared/lib/env';
import { canonicalFeatureKeys } from '@/shared/lib/feature-flags';

export interface PlanFeatures {
  moduleArtists:     boolean;
  moduleCatalog:     boolean;
  moduleContracts:   boolean;
  moduleCrm:         boolean;
  moduleMarketing:   boolean;
  moduleAccounting:  boolean;
  moduleMonitoring:  boolean;
  moduleHr:          boolean;
  moduleEvents:      boolean;
  moduleInventory:   boolean;
  moduleLicensing:   boolean;
  aiFeatures:        boolean;
  multiTenantAdmin:  boolean;
  analyticsAdvanced: boolean;
}

const STARTER_FEATURES: PlanFeatures = {
  moduleArtists:     true,
  moduleCatalog:     true,
  moduleContracts:   true,
  moduleCrm:         true,
  moduleMarketing:   false,
  moduleAccounting:  false,
  moduleMonitoring:  false,
  moduleHr:          false,
  moduleEvents:      false,
  moduleInventory:   false,
  moduleLicensing:   false,
  aiFeatures:        false,
  multiTenantAdmin:  false,
  analyticsAdvanced: false,
};

const ALL_ENABLED = Object.fromEntries(
  Object.keys(STARTER_FEATURES).map((k) => [k, true]),
) as unknown as PlanFeatures;

export function usePlanFeatures() {
  const queryClient = useQueryClient();
  // Local-only convenience. Both flags are forced false by env.ts in a
  // production bundle, so billing can never be bypassed in production.
  const bypassBilling = AUTH_DISABLED;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn:  () => (bypassBilling ? Promise.resolve(null) : stripeClient.getSubscription()),
    enabled:  !bypassBilling,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    };
    window.addEventListener('billing:plan_upgraded', handler);
    return () => window.removeEventListener('billing:plan_upgraded', handler);
  }, [queryClient]);

  if (bypassBilling) {
    return { features: ALL_ENABLED, plan: 'enterprise' as const, status: 'active', isLoading: false, isTrialing: false, isCancelled: false };
  }

  // Missing billing state must fail closed in a real environment. Local mock
  // mode is handled above and may still expose the complete product surface.
  if (!subscription && !isLoading) {
    return { features: STARTER_FEATURES, plan: 'starter' as const, status: 'inactive', isLoading: false, isTrialing: false, isCancelled: false };
  }

  const rawFeatures = (subscription as any)?.features ?? {};
  const features: PlanFeatures = { ...STARTER_FEATURES, ...canonicalFeatureKeys(rawFeatures) };

  return {
    features,
    plan:        (subscription?.plan ?? 'enterprise') as string,
    status:      subscription?.status ?? 'active',
    isLoading,
    isTrialing:  subscription?.status === 'trial',
    isCancelled: subscription?.status === 'cancelled',
  };
}

