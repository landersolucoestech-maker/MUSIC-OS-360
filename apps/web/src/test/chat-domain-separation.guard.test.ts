/**
 * chat-domain-separation.guard.test.ts
 *
 * Permanent guard: Internal Chat (team <-> team) and the Service
 * Center (team <-> external public) must remain architecturally
 * independent domains — their own component tree, services and
 * entities — even living under the same route (/chat) with two
 * tabs. They can never be mounted simultaneously.
 *
 * Context: the previous implementation used `<TabsContent forceMount>` on the
 * Service Center tab, which kept it rendering even with
 * Internal Chat active (a visual/functional/data mix). This guard
 * proves the root cause does not come back, without requiring two separate
 * routes (which is not the desired product format).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(SRC_ROOT, rel), "utf8");
/** Strips /* *\/ and // comments so prose explaining "we removed forceMount" doesn't
 *  false-positive against a check for actual forceMount usage. */
const readCode = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CHAT_INTERNO_VIEW = "modules/musicchat-internal/components/InternalChatView.tsx";
const SUPPORT_CENTER_VIEW = "modules/musicchat/components/SupportCenterView.tsx";
const MUSICCHAT_PAGE = "modules/musicchat/pages/MusicChat.tsx";
const CHAT_ROUTES = "app/routes/chat.routes.tsx";

const EXTERNAL_CHANNEL_TERMS = [
  /whatsapp/i, /instagram/i, /facebook/i, /tiktok/i,
  /\bticket\b/i, /\bprotocolo\b/i, /\bfila\b/i, /\bSLA\b/,
  /musicChatConversationsService/,
];

const INTERNAL_TEAM_TERMS = [
  /internalChatService/, /useInternalConversations/, /useInternalMessages/,
];

describe("Permanent guard: internal chat and the support center never mix", () => {
  it("InternalChatView.tsx and SupportCenterView.tsx exist as isolated components", () => {
    expect(fs.existsSync(path.resolve(SRC_ROOT, CHAT_INTERNO_VIEW))).toBe(true);
    expect(fs.existsSync(path.resolve(SRC_ROOT, SUPPORT_CENTER_VIEW))).toBe(true);
  });

  it("InternalChatView.tsx imports nothing from modules/musicchat/ (support center)", () => {
    const content = read(CHAT_INTERNO_VIEW);
    expect(content).not.toMatch(/from ["']@\/modules\/musicchat\//);
  });

  it("InternalChatView.tsx references no external-channel/support term", () => {
    const content = read(CHAT_INTERNO_VIEW);
    const hits = EXTERNAL_CHANNEL_TERMS.filter((pattern) => pattern.test(content)).map(String);
    expect(hits).toEqual([]);
  });

  it("SupportCenterView.tsx imports nothing from modules/musicchat-internal/ (internal chat)", () => {
    const content = read(SUPPORT_CENTER_VIEW);
    expect(content).not.toMatch(/from ["']@\/modules\/musicchat-internal\//);
  });

  it("SupportCenterView.tsx references none of the internal chat hooks/service", () => {
    const content = read(SUPPORT_CENTER_VIEW);
    const hits = INTERNAL_TEAM_TERMS.filter((pattern) => pattern.test(content)).map(String);
    expect(hits).toEqual([]);
  });

  it("neither component uses Radix Tabs forceMount (root cause of the original bug)", () => {
    expect(readCode(CHAT_INTERNO_VIEW)).not.toMatch(/forceMount/);
    expect(readCode(SUPPORT_CENTER_VIEW)).not.toMatch(/forceMount/);
  });

  it("MusicChat.tsx (aggregator page) uses forceMount on no TabsContent", () => {
    expect(readCode(MUSICCHAT_PAGE)).not.toMatch(/forceMount/);
  });

  it("MusicChat.tsx mounts both tabs from the correct isolated components", () => {
    const content = read(MUSICCHAT_PAGE);
    expect(content).toMatch(/<InternalChatView\s*\/>/);
    expect(content).toMatch(/<SupportCenterView/);
  });

  it("chat.routes.tsx exposes a single /chat route (not two routes split by domain)", () => {
    const content = read(CHAT_ROUTES);
    expect(content).toMatch(/path="\/chat"/);
    expect(content).not.toMatch(/path="\/chat\/interno"/);
    expect(content).not.toMatch(/path="\/chat\/atendimento"/);
  });
});
