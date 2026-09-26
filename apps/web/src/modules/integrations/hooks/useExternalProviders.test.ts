import { describe, expect, it } from "vitest";
import {
  ExternalProviderStatus,
  IntegrationClassification,
  IntegrationPublicationState,
  IntegrationTechnicalState,
  IntegrationReasonCode,
} from "@music-os-360/types";
import {
  INTEGRATION_PRESENTATION,
  findProviderState,
  canOfferConnection,
  type ClientIntegration,
} from "./useExternalProviders";

/**
 * The tenant's commercial catalog: the frontend branches on the enum resolved in the
 * backend, never on human text. These tests lock in the UX contract.
 */

function integration(over: Partial<ClientIntegration> = {}): ClientIntegration {
  return {
    slug: "docusign", name: "DocuSign", category: "signing",
    classification: IntegrationClassification.COMMERCIAL,
    publicationState: IntegrationPublicationState.AVAILABLE,
    technicalState: IntegrationTechnicalState.READY,
    connectionKind: "oauth",
    entitled: true, canConnect: true, canUse: false,
    connectionState: ExternalProviderStatus.AVAILABLE_NOT_CONNECTED,
    reasonCode: IntegrationReasonCode.NOT_CONNECTED,
    eligiblePlans: [],
    ...over,
  };
}

describe("Tenant commercial catalog — state contract", () => {
  it("has a presentation for EVERY reason code (none falls into an empty render)", () => {
    for (const code of Object.values(IntegrationReasonCode)) {
      const p = INTEGRATION_PRESENTATION[code];
      expect(p, `sem apresentação para ${code}`).toBeDefined();
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("PLAN_NOT_INCLUDED and COMING_SOON are DIFFERENT states", () => {
    const locked = INTEGRATION_PRESENTATION[IntegrationReasonCode.PLAN_NOT_INCLUDED];
    const soon = INTEGRATION_PRESENTATION[IntegrationReasonCode.COMING_SOON];

    expect(locked.label).not.toBe(soon.label);
    // A plan block is a sale: it offers an upgrade. "Coming soon" offers nothing.
    expect(locked.action).toBe("upgrade");
    expect(soon.action).toBe("none");
  });

  it("NOT_CONNECTED (entitled) oferece conectar; CONNECTED oferece gerir", () => {
    expect(INTEGRATION_PRESENTATION[IntegrationReasonCode.NOT_CONNECTED].action).toBe("connect");
    expect(INTEGRATION_PRESENTATION[IntegrationReasonCode.CONNECTED].action).toBe("manage");
  });

  it("REQUIRES_REAUTH and PROVIDER_ERROR are not 'not connected'", () => {
    const reauth = INTEGRATION_PRESENTATION[IntegrationReasonCode.REQUIRES_REAUTH];
    const err = INTEGRATION_PRESENTATION[IntegrationReasonCode.PROVIDER_ERROR];
    const notConn = INTEGRATION_PRESENTATION[IntegrationReasonCode.NOT_CONNECTED];

    expect(new Set([reauth.label, err.label, notConn.label]).size).toBe(3);
    expect(err.tone).toBe("danger");
    expect(reauth.action).toBe("reconnect");
  });

  it("COMING_SOON never offers a connection, even when entitled", () => {
    const soon = integration({
      entitled: true, canConnect: false,
      publicationState: IntegrationPublicationState.COMING_SOON,
      technicalState: IntegrationTechnicalState.PLANNED,
      reasonCode: IntegrationReasonCode.COMING_SOON,
    });
    expect(canOfferConnection(soon)).toBe(false);
  });

  it("without entitlement never offers a connection (but stays visible)", () => {
    const locked = integration({
      entitled: false, canConnect: false,
      reasonCode: IntegrationReasonCode.PLAN_NOT_INCLUDED,
      eligiblePlans: ["professional"],
    });
    expect(canOfferConnection(locked)).toBe(false);
    expect(locked.eligiblePlans).toEqual(["professional"]);
  });

  it("platform_credentials never offers the customer a connect button", () => {
    const p = integration({ connectionKind: "platform_credentials", canConnect: true });
    expect(canOfferConnection(p)).toBe(false);
  });

  it("findProviderState returns undefined for what the backend did not resolve", () => {
    const list = [integration()];
    expect(findProviderState(list, "docusign")?.slug).toBe("docusign");
    // Internal ones never reach the customer's catalog.
    for (const internal of ["soundcharts", "acrcloud", "resend", "stripe"]) {
      expect(findProviderState(list, internal)).toBeUndefined();
    }
  });
});
