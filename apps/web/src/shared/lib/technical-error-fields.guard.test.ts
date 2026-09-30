/**
 * Guard: fields that hold technical error text persisted by the API
 * (`last_error`, `delivery_error`, `error_message`, `publication_error`,
 * `provider_error`, `failure_reason`, a raw `err.message`, and camelCase forms) are diagnostics, never end-user copy. No component may render them
 * in JSX; UI copy comes from a code → PT-BR mapping or a fixed message.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const RENDERED_TECHNICAL_FIELD =
  /\{[^{}]*\.(last_error|lastError|delivery_error|deliveryError|error_message|errorMessage|publication_error|publicationError|provider_error|providerError|failure_reason|failureReason)\b[^{}]*\}|\{\s*(err|error|e)\??\.message\s*\}/;

/** The single place that decides which API body text may become user copy (resolveApiUserMessage). */
const BODY_MESSAGE_POLICY_FILES = new Set(["shared/lib/api-client.ts"]);

/** Developer-only diagnostics (rendered behind IS_DEV). */
const DEV_ONLY_FILES = new Set(["shared/infrastructure/ErrorFallback.tsx"]);

const TECHNICAL_FIELDS =
  "last_error|lastError|delivery_error|deliveryError|error_message|errorMessage|publication_error|publicationError|provider_error|providerError|failure_reason|failureReason";
/** `(err as { message?: string }).message` or a plain `err.message` / `error?.message` / `e.message`. */
const RAW_MESSAGE = String.raw`(?:\(\s*\w+\s+as\s+\{[^}]*\}\s*\)\??|\b(?:err|error|e)\??)\.message\b`;

/** `new UserFacingError(`technical ${err.message}`, "PT-BR")`: the interpolation is the internal English diagnostic, not user copy. */
const TECHNICAL_ARG_OF_USER_FACING_ERROR = /UserFacingError\(\s*`/;

/**
 * KNOWN DEBT: raw `body["message"]` toast outside this slice's write scope. Listed so the guard stays
 * green without loosening the pattern; the entry must be removed when the file is fixed (the test
 * below fails if a listed file no longer matches).
 */
const KNOWN_BODY_MESSAGE_DEBT = new Set(["modules/integrations/components/MarketingOAuthDialog.tsx"]);

/**
 * Non-JSX sinks that put text in front of the user (toast, state later rendered).
 * Deliberately narrow: `describeAuthError({ message: err.message })` and
 * `toUserMessage(err)` are safe mappers and must not match.
 */
const TECHNICAL_SINKS: Array<{ name: string; re: RegExp; unless?: RegExp }> = [
  { name: "toast(raw message)", re: new RegExp(String.raw`toast\.\w+\(\s*${RAW_MESSAGE}`) },
  { name: "toast(`...${raw message}`)", re: new RegExp(String.raw`toast\.\w+\(\s*` + "`" + String.raw`[^` + "`" + String.raw`]*\$\{\s*${RAW_MESSAGE}`) },
  { name: "toast(technical field)", re: new RegExp(String.raw`toast\.\w+\(.*\.(?:${TECHNICAL_FIELDS})\b`) },
  { name: "cast message with literal fallback", re: new RegExp(String.raw`\(\s*\w+\s+as\s+\{\s*message\??:\s*string\s*\}\s*\)\??\.message\s*\?\?\s*["'` + "`" + String.raw`][^"'` + "`" + String.raw`]`) },
  { name: "raw server/exception message with literal fallback", re: /\b(?:err|error|body|data|payload)\??\.message\s*\?\?\s*["'`][^"'`]/, unless: TECHNICAL_ARG_OF_USER_FACING_ERROR },
  { name: "raw API body message", re: /\bbody(?:\[\s*["']message["']\s*\]|\??\.message\b)/ },
  { name: "setError(String(err))", re: /\bset\w*Error\(\s*String\(\s*(?:err|error|e)\s*\)\s*\)/ },
];

function sourceFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full, extensions);
    const isTest = /\.(test|spec)\.tsx?$/.test(name);
    return !isTest && extensions.some((ext) => name.endsWith(ext)) ? [full] : [];
  });
}

const tsxFiles = (dir: string) => sourceFiles(dir, [".tsx"]);

describe("technical error fields are never rendered", () => {
  it("no JSX expression renders last_error / delivery_error / error_message", () => {
    const offenders = tsxFiles(SRC).filter((file) => !DEV_ONLY_FILES.has(relative(SRC, file).split("\\").join("/"))).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => RENDERED_TECHNICAL_FIELD.test(line) && !/^\s*(\/\/|\*)/.test(line))
        .map(({ line, n }) => `${relative(SRC, file)}:${n} ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the pattern catches the leaks it replaced", () => {
    expect(RENDERED_TECHNICAL_FIELD.test("Erro na última conexão: {status.last_error}")).toBe(true);
    expect(RENDERED_TECHNICAL_FIELD.test("{message.deliveryError ? `: ${message.deliveryError}` : \"\"}")).toBe(true);
    expect(RENDERED_TECHNICAL_FIELD.test("{message.deliveryFailureCopy}")).toBe(false);
    expect(RENDERED_TECHNICAL_FIELD.test("<p>{err.message}</p>")).toBe(true);
    expect(RENDERED_TECHNICAL_FIELD.test("{release.publication_error}")).toBe(true);
    expect(RENDERED_TECHNICAL_FIELD.test("{state.message}")).toBe(false);
  });

  it("no toast / error state sink forwards a raw exception message or technical field", () => {
    const offenders = sourceFiles(SRC, [".ts", ".tsx"]).filter((file) => {
      const rel = relative(SRC, file).split("\\").join("/");
      return !BODY_MESSAGE_POLICY_FILES.has(rel) && !KNOWN_BODY_MESSAGE_DEBT.has(rel);
    }).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => !/^\s*(\/\/|\*)/.test(line))
        .flatMap(({ line, n }) =>
          TECHNICAL_SINKS.filter(({ re, unless }) => re.test(line) && !unless?.test(line)).map(
            ({ name }) => `${relative(SRC, file)}:${n} [${name}] ${line.trim()}`,
          ),
        ),
    );
    expect(offenders).toEqual([]);
  });

  it("the known-debt allowlist only lists files that still leak", () => {
    for (const rel of KNOWN_BODY_MESSAGE_DEBT) {
      expect(readFileSync(join(SRC, rel), "utf8")).toMatch(/\bbody\[\s*["']message["']\s*\]/);
    }
  });

  it("the sink patterns catch the leak shapes", () => {
    const hit = (line: string) => TECHNICAL_SINKS.some(({ re }) => re.test(line));
    expect(hit('toast.error((err as { message?: string })?.message ?? "Falha ao salvar a logo.");')).toBe(true);
    expect(hit("toast.error(err.message);")).toBe(true);
    expect(hit("toast.error(error?.message)")).toBe(true);
    expect(hit("toast.error(`IA: ${error.message}`);")).toBe(true);
    expect(hit("toast.error(status.last_error)")).toBe(true);
    expect(hit('toast.error("Falha", { description: item.publicationError })')).toBe(true);
    expect(hit("const label = (e as { message?: string }).message ?? 'Erro';")).toBe(true);
    expect(hit("setError(String(err))")).toBe(true);
    expect(hit(".catch((e) => setLoadError(String(e)))")).toBe(true);
    expect(hit('err.message ?? "Não foi possível concluir o reconhecimento."')).toBe(true);
    expect(hit('(typeof body["message"] === "string" ? body["message"] : undefined) ??')).toBe(true);
    expect(hit("setState({ status: 'error', message: body.message })")).toBe(true);
  });

  it("the sink patterns leave the safe mappers alone", () => {
    const hit = (line: string) => TECHNICAL_SINKS.some(({ re }) => re.test(line));
    expect(hit('toast.error(toUserMessage(err, "Falha ao salvar a logo."));')).toBe(false);
    expect(hit('toast.error(describeAuthError({ message: (err as { message?: string })?.message ?? "" }));')).toBe(false);
    expect(hit("toast.error(`IA: ${toUserMessage(error)}`);")).toBe(false);
    expect(hit('setError("Não foi possível carregar as cidades. Tente novamente.")')).toBe(false);
    expect(hit("console.error(err.message)")).toBe(false);
    expect(hit("const msg = resolveApiUserMessage(res.status, body);")).toBe(false);
    expect(hit("toast.error(validation.error ?? \"Arquivo inválido.\");")).toBe(false);
  });

  it("non-JSX props that receive a technical field are caught by the JSX pattern", () => {
    expect(RENDERED_TECHNICAL_FIELD.test("<Alert title={item.last_error} />")).toBe(true);
    expect(RENDERED_TECHNICAL_FIELD.test("<Alert title={PLATFORM_SYNC_FAILED_COPY} />")).toBe(false);
  });
});
