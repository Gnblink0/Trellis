import { z } from "zod/v4";

// ── Request validation ──

export const togglesSchema = z.object({
  visualSupport: z.boolean(),
  simplifyLevel: z.union([z.literal("G1"), z.literal("G2"), z.literal("G3"), z.literal("G4"), z.null()]),
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
  selectedBlockIds: z.array(z.string()).optional(),
  selectedBlockTexts: z.record(z.string(), z.string()).optional(),
});

export const detectRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(1, "imageBase64 is required")
    .refine(
      (s) => s.startsWith("data:image/"),
      "imageBase64 must be a data URI (data:image/...)"
    ),
});

export const snippetModeSchema = z.enum(["simplify", "visual", "summary"]);

export const regenerateRequestSchema = z
  .object({
    target: z.union([
      z.object({ type: z.literal("block"), blockId: z.string().min(1) }),
      z.object({ type: z.literal("summary") }),
      z.object({ type: z.literal("snippet") }),
    ]),
    context: z.object({
      originalText: z.string().min(1, "originalText is required"),
      simplifyLevel: z.union([z.literal("G1"), z.literal("G2"), z.literal("G3"), z.literal("G4")]).optional(),
      summaryMaxSentences: z.number().int().min(1).max(10).optional(),
      language: z.string().optional(),
      mode: snippetModeSchema.optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.target.type === "snippet" && data.context.mode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context.mode is required when target.type is snippet",
        path: ["context", "mode"],
      });
    }
    if (data.target.type !== "snippet" && data.context.mode !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "context.mode is only valid when target.type is snippet",
        path: ["context", "mode"],
      });
    }
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

/** Visual-only adaptation for a user-selected phrase. */
export const gptSnippetVisualSchema = z.object({
  visualHint: z.string(),
});

// ── Detect response validation ──

export const gptDetectResponseSchema = z.object({
  blocks: z.array(
    z.object({
      blockId: z.string(),
      label: z.string(),
      originalText: z.string(),
      rect: z.object({
        top: z.number(),
        left: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
  ),
});
