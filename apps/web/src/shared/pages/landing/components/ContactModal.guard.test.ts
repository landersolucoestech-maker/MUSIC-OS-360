/**
 * ContactModal.guard.test.ts
 *
 * Guarda permanente (decisão de produto 2026-08-22): o contato institucional
 * da landing (Platform Commercial Contact) é arquiteturalmente separado do
 * tenant operacional — nunca deve criar Support Ticket, conversation do
 * MusicChat, lead, ou usar CurrentTenant/tenant_id. Deve chamar
 * exclusivamente /public/platform-contact via publicApi (não api, que anexa
 * auth de tenant).
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
