/**
 * ContactModal.guard.test.ts
 *
 * Permanent guard (product decision 2026-08-22): the landing's institutional
 * contact (Platform Commercial Contact) is architecturally separate from the
 * operational tenant — it must never create a Support Ticket, a MusicChat
 * conversation, a lead, or use CurrentTenant/tenant_id. It must call
 * only /public/platform-contact via publicApi (not api, which attaches
 * tenant auth).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ContactModal.tsx"), "utf8");

describe("ContactModal — architectural separation from the operational tenant", () => {
  it("uses publicApi (not the authenticated tenant api)", () => {
    expect(SOURCE).toMatch(/publicApi\.post/);
    expect(SOURCE).not.toMatch(/(?<!public)Api\.post\("\/(support-tickets|conversations|leads)/);
  });

  it("chama exclusivamente /public/platform-contact", () => {
    expect(SOURCE).toMatch(/"\/public\/platform-contact"/);
  });

  it("never references a tenant, support ticket, or MusicChat conversation", () => {
    expect(SOURCE).not.toMatch(/CurrentTenant|tenant_id|tenantId|support-ticket|conversation/i);
  });

  it("inclui campo honeypot contra abuso", () => {
    expect(SOURCE).toMatch(/website/);
  });
});
