/**
 * integrations/adapters/error-monitor.adapter.ts
 *
 * Error monitoring adapter — REAL implementation via @sentry/react.
 * Init happens in main.tsx (VITE_SENTRY_DSN, public browser DSN);
 * without a configured DSN, the SDK discards events — there is never simulated data.
 *
 * RULE: components NEVER import @sentry/react directly.
 * They use hooks/services that delegate to this adapter.
 *
 * Usage:
 *   import { errorMonitorAdapter } from "@/modules/integrations/adapters/error-monitor.adapter";
 *   errorMonitorAdapter.captureError(error, { module: "accounting", action: "create" });
 */

import * as Sentry from "@sentry/react";
import type { IErrorMonitorProvider, PerformanceTransaction } from "@/modules/integrations/dto";

export const errorMonitorAdapter: IErrorMonitorProvider = {
  captureError(error, context, severity) {
    return Sentry.captureException(error, {
      level: severity,
      extra: context as Record<string, unknown> | undefined,
    });
  },
  captureMessage(message, severity, context) {
    return Sentry.captureMessage(message, {
      level: severity,
      extra: context as Record<string, unknown> | undefined,
    });
  },
  setUser(user) {
    Sentry.setUser(user ? { id: user.id, email: user.email } : null);
    if (user?.tenant_id) Sentry.setTag("tenant_id", user.tenant_id);
  },
  addBreadcrumb(entry) {
    Sentry.addBreadcrumb({
      category: entry.category,
      message: entry.message,
      level: entry.level,
      data: entry.data,
    });
  },
  startTransaction(name, op): PerformanceTransaction {
    const span = Sentry.startInactiveSpan({ name, op });
    return {
      name,
      op,
      finish: () => span?.end(),
      setTag: (key, value) => span?.setAttribute(key, value),
      setData: (key, value) => span?.setAttribute(key, value as string | number | boolean),
    };
  },
  setTag(key, value) {
    Sentry.setTag(key, value);
  },
  setContext(key, context) {
    Sentry.setContext(key, context);
  },
};
