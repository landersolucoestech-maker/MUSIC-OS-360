import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Everything around <Routes> is stubbed: only the router, the real legacyRoutes() table and the
// location reached after a redirect matter here. Every other route group contributes no route.
const emptyRoutes = vi.hoisted(() => () => () => null);
vi.mock("@/shared/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/shared/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/app/providers/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/app/providers/TenantContext", () => ({
  TenantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenant: () => ({ contextError: null, tenant: { onboarding: { completed: true } } }),
}));
vi.mock("@/app/providers/BillingContext", () => ({
  BillingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBilling: () => ({ isSuspended: false }),
}));
vi.mock("@/shared/infrastructure/BillingNotice", () => ({ BillingNotice: () => null }));
vi.mock("@/shared/infrastructure/RealtimeLayer", () => ({ RealtimeLayer: () => null }));
vi.mock("@/shared/domain-events/consistency", () => ({}));
vi.mock("@/shared/lib/migrations", () => ({ runClientMigrations: () => undefined }));
vi.mock("@/shared/lib/env", () => ({ AUTH_DISABLED: false, DEV_AUTH_BYPASS: false }));
vi.mock("@/app/routes/public.routes", () => ({ publicRoutes: emptyRoutes() }));
vi.mock("@/app/routes/artist.routes", () => ({ artistRoutes: emptyRoutes() }));
vi.mock("@/app/routes/catalog.routes", () => ({ catalogRoutes: emptyRoutes() }));
vi.mock("@/app/routes/accounting.routes", () => ({ accountingRoutes: emptyRoutes() }));
vi.mock("@/app/routes/releases.routes", () => ({ releasesRoutes: emptyRoutes() }));
vi.mock("@/app/routes/crm.routes", () => ({ crmRoutes: emptyRoutes() }));
vi.mock("@/app/routes/marketing.routes", () => ({ marketingRoutes: emptyRoutes() }));
vi.mock("@/app/routes/workspace.routes", () => ({ workspaceRoutes: emptyRoutes() }));
vi.mock("@/app/routes/settings.routes", () => ({ settingsRoutes: emptyRoutes() }));
vi.mock("@/app/routes/operations.routes", () => ({ operationsRoutes: emptyRoutes() }));
vi.mock("@/app/routes/chat.routes", () => ({ chatRoutes: emptyRoutes() }));
vi.mock("@/app/routes/admin.routes", () => ({ adminRoutes: emptyRoutes() }));
vi.mock("@/app/routes/contracts.routes", () => ({ contractsRoutes: emptyRoutes() }));
vi.mock("@/app/routes/reports.routes", () => ({ reportsRoutes: emptyRoutes() }));
vi.mock("@/app/routes/support.routes", () => ({ supportRoutes: emptyRoutes() }));
vi.mock("@/app/routes/audiovisual.routes", () => ({ audiovisualRoutes: emptyRoutes() }));
vi.mock("@/modules/dashboard/pages/Dashboard", () => ({ default: () => null }));
vi.mock("@/shared/pages/Landing", () => ({ default: () => null }));
vi.mock("@/modules/settings/pages/BillingBlockedPage", () => ({ default: () => null }));

import App from "@/App";

const where = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

describe("App mounts the legacy Portuguese-path redirects", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it.each([
    ["/artistas", "/artists"],
    ["/contratos?obra=7#sec", "/contracts?work=7#sec"],
    ["/cadastro/acme", "/apply/acme"],
    ["/marketing/campanhas", "/marketing/campaigns"],
  ])("a bookmark at %s lands on %s", async (legacy, canonical) => {
    window.history.pushState({}, "", legacy);
    render(<App />);
    await waitFor(() => expect(where()).toBe(canonical));
  });

  it("a path that is not a legacy route is left where it is", async () => {
    window.history.pushState({}, "", "/not-a-legacy-path");
    render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(where()).toBe("/not-a-legacy-path");
  });
});
