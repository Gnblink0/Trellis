import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import type {
  ProcessResponse,
  RegenerateResponse,
  ApiError,
} from "@trellis/shared";
import {
  processRequestSchema,
  regenerateRequestSchema,
  gptProcessResponseSchema,
  gptRegenerateBlockSchema,
  gptRegenerateSummarySchema,
  gptSnippetVisualSchema,
} from "../schemas";
import {
  SYSTEM_PROMPT,
  buildProcessUserMessage,
  buildRegenerateBlockMessage,
  buildRegenerateSummaryMessage,
  buildSnippetSimplifyMessage,
  buildSnippetVisualOnlyMessage,
  buildSnippetSummaryMessage,
  buildDalle3ImagePrompt,
  PROCESS_JSON_SCHEMA,
  REGENERATE_BLOCK_JSON_SCHEMA,
  REGENERATE_SUMMARY_JSON_SCHEMA,
  REGENERATE_SNIPPET_VISUAL_JSON_SCHEMA,
} from "../prompts";

export const adaptRouter = Router();

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Copy server/.env.example to server/.env and add your key."
      );
    }
    _openai = new OpenAI({ apiKey, timeout: 60_000 });
  }
  return _openai;
}

// ── Helpers ──

function sendError(res: Response, status: number, error: ApiError) {
  return res.status(status).json(error);
}

function httpStatusForCode(code: ApiError["code"]): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "AI_TIMEOUT":
      return 504;
    case "AI_RATE_LIMIT":
      return 429;
    case "AI_PARSE_ERROR":
      return 502;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

function classifyOpenAIError(err: unknown): ApiError {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return { code: "AI_RATE_LIMIT", message: "AI service rate limit reached. Please wait and try again." };
    }
    if (err.status === 408 || err.message?.includes("timeout")) {
      return { code: "AI_TIMEOUT", message: "Processing took too long. Please try again." };
    }
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return { code: "AI_TIMEOUT", message: "Processing took too long. Please try again." };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred." };
}

type ImageGenContext = {
  /** e.g. "Title", "Question 2" — helps section-level framing. */
  label?: string;
  /** Truncated in buildDalle3ImagePrompt; worksheet excerpt for caption disambiguation. */
  instructionalContext?: string;
};

/**
 * Generate an image from a caption-style visual hint using DALL·E 3 (caption-enhanced prompt + optional instructional context).
 * Returns the URL on success, null on failure (graceful degradation).
 */
async function generateImage(
  openai: OpenAI,
  visualHint: string,
  context?: ImageGenContext
): Promise<string | null> {
  try {
    const prompt = buildDalle3ImagePrompt(visualHint, {
      label: context?.label,
      instructionalContext: context?.instructionalContext,
    });
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    const url = response.data?.[0]?.url;
    if (!url) return null;

    // Fetch the image and convert to base64 data URL to avoid expiring Azure links
    const imgResponse = await fetch(url);
    if (!imgResponse.ok) return null;
    const arrayBuffer = await imgResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = imgResponse.headers.get("content-type") ?? "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(
      `[adapt] DALL·E 3 failed for hint "${visualHint.slice(0, 80)}${visualHint.length > 80 ? "…" : ""}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ── POST /api/adapt/process ──

adaptRouter.post("/process", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. Validate request
  const parsed = processRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const { imageBase64, toggles, options } = parsed.data;
  const summaryMaxSentences = options?.summaryMaxSentences ?? 5;

  // 2. Build prompt
  const userMessage = buildProcessUserMessage(toggles, summaryMaxSentences);

  // Strip the data URI prefix for OpenAI — extract media type and base64 data
  const mediaTypeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mediaType = (mediaTypeMatch?.[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const rawBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  // 3. Call GPT-4o (with retry on parse failure)
  let gptResult: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${rawBase64}`, detail: "high" },
              },
              { type: "text", text: userMessage },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: PROCESS_JSON_SCHEMA,
        },
        temperature: 0.3,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from GPT-4o");

      gptResult = JSON.parse(raw);
      break;
    } catch (err) {
      if (attempt === 1) {
        // Check if it's an OpenAI API error vs parse error
        if (err instanceof OpenAI.APIError || err instanceof OpenAI.APIConnectionTimeoutError) {
          const apiErr = classifyOpenAIError(err);
          return sendError(res, httpStatusForCode(apiErr.code), apiErr);
        }
        return sendError(res, 502, {
          code: "AI_PARSE_ERROR",
          message: "Failed to parse AI response after retry.",
        });
      }
      // First attempt failed — retry
      console.log(`[adapt/process] Attempt ${attempt + 1} failed, retrying...`);
    }
  }

  // 4. Validate GPT output
  const gptParsed = gptProcessResponseSchema.safeParse(gptResult);
  if (!gptParsed.success) {
    return sendError(res, 502, {
      code: "AI_PARSE_ERROR",
      message: "AI response did not match expected schema.",
    });
  }

  const { blocks, summary } = gptParsed.data;

  // 4b. Generate images for blocks with visual hints (parallel, fault-tolerant)
  const blocksWithImages = await Promise.all(
    blocks.map(async (block) => {
      if (!block.visualHint || !toggles.visualSupport) {
        return { ...block, visualUrl: null };
      }
      const visualUrl = await generateImage(getOpenAI(), block.visualHint, {
        label: block.label,
        instructionalContext: block.originalText,
      });
      return { ...block, visualUrl };
    })
  );

  // 5. Post-processing: enforce summary sentence limit
  if (summary && summary.sentences.length > summaryMaxSentences) {
    summary.sentences = summary.sentences.slice(0, summaryMaxSentences);
    summary.warnings.push(
      `Summary truncated from ${summary.sentences.length} to ${summaryMaxSentences} sentences.`
    );
  }

  // 6. Build response
  const totalMs = Date.now() - startTime;

  const response: ProcessResponse = {
    blocks: blocksWithImages,
    summary: toggles.summarize ? summary : null,
    meta: {
      simplifyLevel: toggles.simplifyLevel,
      toggles,
      latencyMs: { total: totalMs },
    },
  };

  console.log(`[adapt/process] Completed in ${totalMs}ms — ${blocksWithImages.length} blocks`);
  return res.json(response);
});

// ── POST /api/adapt/regenerate ──

adaptRouter.post("/regenerate", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. Validate request
  const parsed = regenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const { target, context } = parsed.data;

  try {
    if (target.type === "snippet") {
      const mode = context.mode;
      if (!mode) {
        return sendError(res, 400, {
          code: "VALIDATION_ERROR",
          message: "context.mode is required for snippet target.",
        });
      }

      const excerpt = context.originalText.trim();
      if (excerpt.length === 0) {
        return sendError(res, 400, {
          code: "VALIDATION_ERROR",
          message: "Empty selection.",
        });
      }
      if (excerpt.length > 4000) {
        return sendError(res, 400, {
          code: "VALIDATION_ERROR",
          message: "Selection is too long (max 4000 characters).",
        });
      }

      if (mode === "simplify") {
        const level = context.simplifyLevel ?? "G2";
        const userMessage = buildSnippetSimplifyMessage(excerpt, level);

        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: REGENERATE_BLOCK_JSON_SCHEMA,
          },
          temperature: 0.5,
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) throw new Error("Empty response from GPT-4o");

        const gptParsed = gptRegenerateBlockSchema.safeParse(JSON.parse(raw));
        if (!gptParsed.success) {
          return sendError(res, 502, {
            code: "AI_PARSE_ERROR",
            message: "AI response did not match expected schema.",
          });
        }

        let visualUrl: string | undefined;
        if (gptParsed.data.visualHint) {
          const url = await generateImage(getOpenAI(), gptParsed.data.visualHint, {
            label: "Selected excerpt",
            instructionalContext: excerpt,
          });
          if (url) visualUrl = url;
        }

        const response: RegenerateResponse = {
          target,
          result: {
            ...gptParsed.data,
            visualHint: gptParsed.data.visualHint ?? undefined,
            visualUrl,
          },
          latencyMs: Date.now() - startTime,
        };

        console.log(`[adapt/regenerate] Snippet simplify in ${response.latencyMs}ms`);
        return res.json(response);
      }

      if (mode === "visual") {
        const userMessage = buildSnippetVisualOnlyMessage(excerpt);

        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: REGENERATE_SNIPPET_VISUAL_JSON_SCHEMA,
          },
          temperature: 0.5,
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) throw new Error("Empty response from GPT-4o");

        const gptParsed = gptSnippetVisualSchema.safeParse(JSON.parse(raw));
        if (!gptParsed.success) {
          return sendError(res, 502, {
            code: "AI_PARSE_ERROR",
            message: "AI response did not match expected schema.",
          });
        }

        const url = await generateImage(getOpenAI(), gptParsed.data.visualHint, {
          label: "Selected excerpt",
          instructionalContext: excerpt,
        });

        const response: RegenerateResponse = {
          target,
          result: {
            visualHint: gptParsed.data.visualHint,
            visualUrl: url ?? undefined,
          },
          latencyMs: Date.now() - startTime,
        };

        console.log(`[adapt/regenerate] Snippet visual in ${response.latencyMs}ms`);
        return res.json(response);
      }

      // mode === "summary"
      const maxSentences = Math.min(context.summaryMaxSentences ?? 3, 5);
      const userMessage = buildSnippetSummaryMessage(excerpt, maxSentences);

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: REGENERATE_SUMMARY_JSON_SCHEMA,
        },
        temperature: 0.5,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from GPT-4o");

      const gptParsed = gptRegenerateSummarySchema.safeParse(JSON.parse(raw));
      if (!gptParsed.success) {
        return sendError(res, 502, {
          code: "AI_PARSE_ERROR",
          message: "AI response did not match expected schema.",
        });
      }

      let { sentences } = gptParsed.data;
      if (sentences.length > maxSentences) {
        sentences = sentences.slice(0, maxSentences);
      }

      const response: RegenerateResponse = {
        target,
        result: { sentences },
        latencyMs: Date.now() - startTime,
      };

      console.log(`[adapt/regenerate] Snippet summary in ${response.latencyMs}ms`);
      return res.json(response);
    }

    if (target.type === "block") {
      // Regenerate a single block
      const level = context.simplifyLevel ?? "G2";
      const userMessage = buildRegenerateBlockMessage(context.originalText, level);

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: REGENERATE_BLOCK_JSON_SCHEMA,
        },
        temperature: 0.7, // Higher temp for variety on regeneration
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from GPT-4o");

      const gptParsed = gptRegenerateBlockSchema.safeParse(JSON.parse(raw));
      if (!gptParsed.success) {
        return sendError(res, 502, {
          code: "AI_PARSE_ERROR",
          message: "AI response did not match expected schema.",
        });
      }

      // Generate image for the new visual hint
      let visualUrl: string | undefined;
      if (gptParsed.data.visualHint) {
        const url = await generateImage(getOpenAI(), gptParsed.data.visualHint, {
          label: `Block ${target.blockId}`,
          instructionalContext: context.originalText,
        });
        if (url) visualUrl = url;
      }

      const response: RegenerateResponse = {
        target,
        result: {
          ...gptParsed.data,
          visualHint: gptParsed.data.visualHint ?? undefined,
          visualUrl,
        },
        latencyMs: Date.now() - startTime,
      };

      console.log(`[adapt/regenerate] Block ${target.blockId} in ${response.latencyMs}ms`);
      return res.json(response);
    } else {
      // Regenerate summary
      const maxSentences = context.summaryMaxSentences ?? 5;
      const userMessage = buildRegenerateSummaryMessage(context.originalText, maxSentences);

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: REGENERATE_SUMMARY_JSON_SCHEMA,
        },
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from GPT-4o");

      const gptParsed = gptRegenerateSummarySchema.safeParse(JSON.parse(raw));
      if (!gptParsed.success) {
        return sendError(res, 502, {
          code: "AI_PARSE_ERROR",
          message: "AI response did not match expected schema.",
        });
      }

      // Enforce sentence limit
      let { sentences } = gptParsed.data;
      if (sentences.length > maxSentences) {
        sentences = sentences.slice(0, maxSentences);
      }

      const response: RegenerateResponse = {
        target,
        result: { sentences },
        latencyMs: Date.now() - startTime,
      };

      console.log(`[adapt/regenerate] Summary in ${response.latencyMs}ms`);
      return res.json(response);
    }
  } catch (err) {
    const apiErr = classifyOpenAIError(err);
    return sendError(res, httpStatusForCode(apiErr.code), apiErr);
  }
});
