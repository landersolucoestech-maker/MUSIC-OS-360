import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GENERIC_INVALID_VALUE, REQUIRED_FIELD } from "./zod-pt-br";

/** The global map is installed by src/test/setup.ts, exactly as main.tsx does. */
const messages = (schema: z.ZodTypeAny, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

const ENGLISH_DEFAULT = /Required|Expected|Invalid|must|should|String must|Number must|Array must/;

describe("zod → PT-BR end-user messages", () => {
  it("required / type errors", () => {
    expect(messages(z.object({ name: z.string() }), {})).toEqual([REQUIRED_FIELD]);
    expect(messages(z.string(), 42)).toEqual([GENERIC_INVALID_VALUE]);
  });

  it("sizes, formats and options", () => {
    expect(messages(z.string().min(1), "")).toEqual([REQUIRED_FIELD]);
    expect(messages(z.string().min(3), "a")).toEqual(["Informe pelo menos 3 caracteres."]);
    expect(messages(z.number().positive(), 0)).toEqual(["O valor deve ser maior que 0."]);
    expect(messages(z.string().email(), "x")).toEqual(["Informe um e-mail válido."]);
    expect(messages(z.enum(["a", "b"]), "c")).toEqual(["Selecione uma opção válida."]);
    expect(messages(z.array(z.string()).min(1), [])).toEqual(["Selecione pelo menos um item."]);
  });

  it("never produces zod's English defaults", () => {
    const all = [
      ...messages(z.object({ a: z.string(), b: z.number(), c: z.date(), d: z.string().url() }), { b: "x", d: "y" }),
      ...messages(z.string().refine(() => false), "x"),
    ];
    for (const m of all) expect(m).not.toMatch(ENGLISH_DEFAULT);
  });

  it("keeps a message written on the schema", () => {
    expect(messages(z.string().min(1, "Informe o nome do artista."), "")).toEqual(["Informe o nome do artista."]);
  });
});
