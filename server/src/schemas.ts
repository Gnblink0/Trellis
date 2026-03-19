import { z } from "zod/v4";

// ── Request validation ──

export const togglesSchema = z.object({
  visualSupport: z.boolean(),
  simplifyLevel: z.union([z.literal("G1"), z.literal("G2"), z.null()]),
  summarize: z.boolean(),
});

export const processRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(1, "imageBase64 is required")
    .refine(
      (s) => s.startsWith("data:image/"),
      "imageBase64 must be a data URI (data:image/...)"
    ),
  toggles: togglesSchema.refine(
    (t) => t.visualSupport || t.simplifyLevel !== null || t.summarize,
    "At least one toggle must be enabled"
  ),
  options: z
    .object({
      summaryMaxSentences: z.number().int().min(1).max(10).optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export const regenerateRequestSchema = z.object({
  target: z.union([
    z.object({ type: z.literal("block"), blockId: z.string().min(1) }),
    z.object({ type: z.literal("summary") }),
  ]),
  context: z.object({
    originalText: z.string().min(1, "originalText is required"),
    simplifyLevel: z.union([z.literal("G1"), z.literal("G2")]).optional(),
    summaryMaxSentences: z.number().int().min(1).max(10).optional(),
    language: z.string().optional(),
  }),
});

// ── GPT-4o response validation ──

const adaptedBlockSchema = z.object({
  blockId: z.string(),
  label: z.string(),
  originalText: z.string(),
  simplifiedText: z.union([z.string(), z.null()]),
  keywords: z.array(z.string()),
  visualHint: z.union([z.string(), z.null()]),
  rect: z.object({
    top: z.number(),
    left: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const summaryResultSchema = z.object({
  sentences: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const gptProcessResponseSchema = z.object({
  blocks: z.array(adaptedBlockSchema),
  summary: z.union([summaryResultSchema, z.null()]),
});

export const gptRegenerateBlockSchema = z.object({
  simplifiedText: z.string(),
  keywords: z.array(z.string()),
  visualHint: z.union([z.string(), z.null()]).optional(),
});

export const gptRegenerateSummarySchema = z.object({
  sentences: z.array(z.string()),
});
