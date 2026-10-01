import { z } from "zod";

import {
  PUBLISH_PLATFORM_VALUES,
  getFormatViolation,
  isValidPlatformType,
} from "../config/social-formats";

/** A single media file attached to a content (image or video). */
export const mediaItemSchema = z.object({
  url: z.string().min(1, "Mídia inválida."),
  name: z.string().default(""),
  kind: z.string().default(""),
});

export type MediaItemInput = z.infer<typeof mediaItemSchema>;

export const contentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Informe um título com pelo menos 2 caracteres.")
      .max(100, "Máximo de 100 caracteres."),
    targetType: z.enum(["music_project", "artist", "company"], {
      required_error: "Selecione o contexto.",
    }),
    targetName: z.string().trim().min(2, "Informe o projeto musical, artista ou empresa."),
    channel: z.enum(PUBLISH_PLATFORM_VALUES as [string, ...string[]], {
      required_error: "Selecione uma plataforma.",
    }),
    channels: z
      .array(z.enum(PUBLISH_PLATFORM_VALUES as [string, ...string[]]))
      .min(1, "Selecione ao menos uma plataforma."),
    type: z.string().min(1, "Selecione o tipo de conteúdo."),
    publishDate: z
      .string()
      .min(1, "Selecione uma data válida.")
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00`)), {
        message: "Selecione uma data válida.",
      }),
    publishTime: z.string().regex(/^\d{2}:\d{2}$/, "Informe a hora no formato HH:mm."),
    copy: z.string().trim().min(1, "Escreva a legenda/copy.").max(2200, "Máximo de 2200 caracteres."),
    campaignId: z.string().optional(),
    releaseId: z.string().optional(),
    notes: z.string().optional(),
    hashtags: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    media: z.array(mediaItemSchema).default([]),
  })
  .superRefine((value, ctx) => {
    // All format rules live in ONE place (social-formats) so the schema and the
    // data service never diverge. The combination check drives the `type` path;
    // media constraints drive the `media` path.
    if (!isValidPlatformType(value.channel, value.type)) {
      ctx.addIssue({
        path: ["type"],
        code: z.ZodIssueCode.custom,
        message: "Este tipo de conteúdo não está disponível para a plataforma selecionada.",
      });
      return;
    }

    const violation = getFormatViolation(value.channel, value.type, value.media);
    if (violation) {
      ctx.addIssue({ path: ["media"], code: z.ZodIssueCode.custom, message: violation });
    }
  });

export type ContentSchemaInput = z.infer<typeof contentSchema>;
