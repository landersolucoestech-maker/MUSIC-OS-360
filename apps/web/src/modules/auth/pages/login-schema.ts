import { z } from "zod";

/**
 * Part 77 — in its own module (without depending on Auth.tsx, which pulls the whole
 * UI/env tree) so it can be tested in isolation. The password NEVER gets
 * trim/lowercase/normalization — only the e-mail is normalized (trim here;
 * lowercase happens later, in AuthContext.signIn via normalizeEmail()).
 */
export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const forgotSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

export type LoginData = z.infer<typeof loginSchema>;
export type ForgotData = z.infer<typeof forgotSchema>;
