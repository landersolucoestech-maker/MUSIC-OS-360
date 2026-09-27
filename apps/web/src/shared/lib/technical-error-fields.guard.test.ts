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

/** Developer-only diagnostics (rendered behind IS_DEV). */
const DEV_ONLY_FILES = new Set(["shared/infrastructure/ErrorFallback.tsx"]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith(".tsx") && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
}

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
});
