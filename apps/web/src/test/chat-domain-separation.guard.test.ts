/**
 * chat-domain-separation.guard.test.ts
 *
 * Guarda permanente: Chat Interno (equipe <-> equipe) e Central de
 * Atendimento (equipe <-> público externo) devem permanecer domínios
 * arquiteturalmente independentes — árvore de componentes, serviços e
 * entidades próprios — mesmo vivendo sob a mesma rota (/chat) com dois
 * tabs. Nunca podem ser montados simultaneamente.
 *
 * Contexto: a implementação anterior usava `<TabsContent forceMount>` na
 * aba de Central de Atendimento, o que a mantinha renderizando mesmo com
 * "Chat Interno" ativo (mistura visual/funcional/de dados). Este guard
 * prova que a causa raiz não volta a existir, sem exigir duas rotas
 * separadas (que não é o formato desejado do produto).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(SRC_ROOT, rel), "utf8");
/** Strips /* *\/ and // comments so prose explaining "we removed forceMount" doesn't
 *  false-positive against a check for actual forceMount usage. */
const readCode = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CHAT_INTERNO_VIEW = "modules/musicchat-interno/components/ChatInternoView.tsx";
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
  it("ChatInternoView.tsx and SupportCenterView.tsx exist as isolated components", () => {
    expect(fs.existsSync(path.resolve(SRC_ROOT, CHAT_INTERNO_VIEW))).toBe(true);
    expect(fs.existsSync(path.resolve(SRC_ROOT, SUPPORT_CENTER_VIEW))).toBe(true);
  });

  it("ChatInternoView.tsx imports nothing from modules/musicchat/ (support center)", () => {
    const content = read(CHAT_INTERNO_VIEW);
    expect(content).not.toMatch(/from ["']@\/modules\/musicchat\//);
  });

  it("ChatInternoView.tsx references no external-channel/support term", () => {
    const content = read(CHAT_INTERNO_VIEW);
    const hits = EXTERNAL_CHANNEL_TERMS.filter((pattern) => pattern.test(content)).map(String);
    expect(hits).toEqual([]);
  });

  it("SupportCenterView.tsx imports nothing from modules/musicchat-interno/ (internal chat)", () => {
    const content = read(SUPPORT_CENTER_VIEW);
    expect(content).not.toMatch(/from ["']@\/modules\/musicchat-interno\//);
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
    expect(content).toMatch(/<ChatInternoView\s*\/>/);
    expect(content).toMatch(/<SupportCenterView/);
  });

  it("chat.routes.tsx exposes a single /chat route (not two routes split by domain)", () => {
    const content = read(CHAT_ROUTES);
    expect(content).toMatch(/path="\/chat"/);
    expect(content).not.toMatch(/path="\/chat\/interno"/);
    expect(content).not.toMatch(/path="\/chat\/atendimento"/);
  });
});
