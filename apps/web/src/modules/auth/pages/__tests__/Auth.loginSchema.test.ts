import { describe, expect, it } from "vitest";
import { loginSchema } from "../login-schema";

describe("loginSchema (Part 77) — the password is never transformed", () => {
  it("preserves leading and trailing spaces in the password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "  Senha123!  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe("  Senha123!  ");
  });

  it("preserves case exactly as typed", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "MiXeD-CaSe-Pass1!" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe("MiXeD-CaSe-Pass1!");
  });

  it.each([
    "!senha", "senha@", "s#enha", "senha%1", "a&b", "a+b-c_d",
    "(parenteses)", "aa", "!primeiro-e-ultimo!",
  ])("keeps a password with a special symbol: %s", (password) => {
    const result = loginSchema.safeParse({ email: "user@example.com", password });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe(password);
  });

  it("normalizes the email (trim) but NEVER the password", () => {
    const result = loginSchema.safeParse({ email: "  User@Example.com  ", password: "  senha  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("User@Example.com"); // trim, but no lowercase in the schema (the real normalization happens in AuthContext)
      expect(result.data.password).toBe("  senha  "); // untouched
    }
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
