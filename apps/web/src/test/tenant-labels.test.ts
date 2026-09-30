// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/api-client", () => ({
  getAccessToken: vi.fn(() => null),
}));

import {
  PLAN_LABEL,
  INDUSTRY_LABEL,
  BILLING_STATUS_LABEL,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  getPermissionsFromToken,
} from "@/app/providers/tenant-labels";
import { getAccessToken } from "@/shared/lib/api-client";

describe("tenant-labels", () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null);
  });

  describe("PLAN_LABEL", () => {
    it("has labels for all plans", () => {
      expect(PLAN_LABEL.starter).toBe("Starter");
      expect(PLAN_LABEL.professional).toBe("Professional");
      expect(PLAN_LABEL.enterprise).toBe("Enterprise");
    });
  });

  describe("INDUSTRY_LABEL", () => {
    it("has PT-BR label for record_label", () => {
      expect(INDUSTRY_LABEL.record_label).toBe("Gravadora");
    });
    it("has PT-BR label for music_publisher", () => {
      expect(INDUSTRY_LABEL.music_publisher).toBe("Editora Musical");
    });
  });

  describe("BILLING_STATUS_LABEL", () => {
    it("has all billing status labels", () => {
      expect(BILLING_STATUS_LABEL.active).toBe("Ativo");
      expect(BILLING_STATUS_LABEL.trial).toBe("Trial");
      expect(BILLING_STATUS_LABEL.suspended).toBe("Suspenso");
      expect(BILLING_STATUS_LABEL.cancelled).toBe("Cancelado");
    });
  });

  describe("ROLE_LABEL", () => {
    it("has all role labels", () => {
      expect(ROLE_LABEL.owner).toBe("Proprietário");
      expect(ROLE_LABEL.admin).toBe("Administrador");
      expect(ROLE_LABEL.viewer).toBe("Visualizador");
    });
  });

  describe("ROLE_PERMISSIONS", () => {
    it("owner has full access to all modules", () => {
      const ownerPerms = ROLE_PERMISSIONS.owner;
      expect(ownerPerms.artists.read).toBe(true);
      expect(ownerPerms.artists.write).toBe(true);
      expect(ownerPerms.artists.delete).toBe(true);
      expect(ownerPerms.accounting.write).toBe(true);
    });

    it("viewer has read-only access", () => {
      const viewerPerms = ROLE_PERMISSIONS.viewer;
      expect(viewerPerms.artists.read).toBe(true);
      expect(viewerPerms.artists.write).toBe(false);
      expect(viewerPerms.artists.delete).toBe(false);
    });

    it("viewer has no access to audit or settings", () => {
      const viewerPerms = ROLE_PERMISSIONS.viewer;
      expect(viewerPerms.audit.read).toBe(false);
      expect(viewerPerms.settings.read).toBe(false);
    });

    it("editor cannot delete", () => {
      const editorPerms = ROLE_PERMISSIONS.editor;
      expect(editorPerms.artists.write).toBe(true);
      expect(editorPerms.artists.delete).toBe(false);
    });

    it("manager has read-only access to audit and settings", () => {
      const managerPerms = ROLE_PERMISSIONS.manager;
      expect(managerPerms.audit.read).toBe(true);
      expect(managerPerms.audit.write).toBe(false);
      expect(managerPerms.settings.read).toBe(true);
      expect(managerPerms.settings.write).toBe(false);
    });
  });

  describe("getPermissionsFromToken", () => {
    it("returns viewer permissions when no token", () => {
      vi.mocked(getAccessToken).mockReturnValue(null);
      const perms = getPermissionsFromToken();
      expect(perms).toEqual(ROLE_PERMISSIONS.viewer);
    });

    it("returns viewer permissions when token has no valid role", () => {
      const fakePayload = btoa(JSON.stringify({ sub: "user-1" }));
      vi.mocked(getAccessToken).mockReturnValue(`header.${fakePayload}.sig`);
      const perms = getPermissionsFromToken();
      expect(perms).toEqual(ROLE_PERMISSIONS.viewer);
    });

    it("returns correct permissions for admin role in token", () => {
      const fakePayload = btoa(JSON.stringify({ role: "admin" }));
      vi.mocked(getAccessToken).mockReturnValue(`header.${fakePayload}.sig`);
      const perms = getPermissionsFromToken();
      expect(perms).toEqual(ROLE_PERMISSIONS.admin);
    });

    it("returns correct permissions for owner role in token", () => {
      const fakePayload = btoa(JSON.stringify({ role: "owner" }));
      vi.mocked(getAccessToken).mockReturnValue(`header.${fakePayload}.sig`);
      const perms = getPermissionsFromToken();
      expect(perms).toEqual(ROLE_PERMISSIONS.owner);
    });

    it("returns viewer permissions on malformed token", () => {
      vi.mocked(getAccessToken).mockReturnValue("not-a-jwt");
      const perms = getPermissionsFromToken();
      expect(perms).toEqual(ROLE_PERMISSIONS.viewer);
    });

    it("uses getAccessToken (not localStorage) to read token", () => {
      vi.mocked(getAccessToken).mockReturnValue(null);
      getPermissionsFromToken();
      expect(getAccessToken).toHaveBeenCalled();
    });
  });
});
