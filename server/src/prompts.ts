import type { Toggles } from "@trellis/shared";

// ── System prompt ──

const SYSTEM_PROMPT = `You are an educational assistant that helps adapt worksheets for students with learning disabilities (Grades 4-7). You will receive a photo of a worksheet and must:

1. Identify logical text sections in the image (title, paragraphs, questions, instructions, etc.)
2. For each section, extract the original text exactly as it appears
3. If simplification is requested, rewrite each section at the specified reading level
4. If summarization is requested, provide a concise summary of the entire worksheet content

IMPORTANT RULES:
- Preserve the meaning and key concepts of the original text
- Do not add information that is not in the original
- Do not skip any text sections visible in the image
- Each block must have a short descriptive label (e.g. "Title", "Paragraph 1", "Question 3")
- Assign each block a unique blockId like "b1", "b2", etc.
- For each block, estimate its position as percentages of the full image dimensions: top (% from top edge), left (% from left edge), width (% of image width), height (% of image height). Values should be between 0 and 100.`;

// ── Grade-level descriptions ──

const SIMPLIFY_INSTRUCTIONS: Record<string, string> = {
  G1: "Rewrite at a Grade 1 reading level. Use only common single-syllable words where possible. Keep sentences to 5-7 words. Use simple subject-verb-object structure.",
  G2: "Rewrite at a Grade 2 reading level. Use common words with up to 2 syllables. Keep sentences to 8-12 words. Simple compound sentences allowed.",
};

// ── Build user message from toggles ──

export function buildProcessUserMessage(
  toggles: Toggles,
  summaryMaxSentences: number
): string {
  const parts: string[] = ["Analyze this worksheet photo."];

  if (toggles.simplifyLevel) {
    parts.push(SIMPLIFY_INSTRUCTIONS[toggles.simplifyLevel]);
  }

  if (toggles.summarize) {
    parts.push(
      `Also provide a summary of the entire content in at most ${summaryMaxSentences} sentences.`
    );
  }

  if (toggles.visualSupport) {
    parts.push(`For each text block, set "visualHint" to a short, caption-style description for image generation (DALL·E 3), not a bare keyword list.

Requirements for each visualHint:
- Write one or two sentences (roughly 25–90 words) that could serve as the main caption for an educational illustration.
- Use the block's meaning in context: if a word could mean more than one thing (e.g. "cell", "current", "plate"), rely on the surrounding worksheet content so the intended curriculum sense is obvious.
- Name concrete, drawable elements: setting, objects, relationships, and a simple visual convention when helpful (e.g. "simple cross-section", "cutaway diagram style", "map-like overview")—aligned with grades 4–7 science or social studies.
- Do not include instructions to the student; describe only what should appear in the picture.`);
  }

  // Clarify null fields based on toggles
  const nullGuidance: string[] = [];
  if (!toggles.simplifyLevel) {
    nullGuidance.push('Set "simplifiedText" to null for every block.');
  }
  if (!toggles.visualSupport) {
    nullGuidance.push('Set "visualHint" to null for every block.');
  }
  if (!toggles.summarize) {
    nullGuidance.push('Set "summary" to null.');
  }
  if (nullGuidance.length > 0) {
    parts.push(nullGuidance.join(" "));
  }

  parts.push("Output as JSON matching the provided schema.");

  return parts.join("\n\n");
}

// ── Build regenerate prompt ──

export function buildRegenerateBlockMessage(
  originalText: string,
  simplifyLevel: string
): string {
  const levelInstruction =
    SIMPLIFY_INSTRUCTIONS[simplifyLevel] ?? SIMPLIFY_INSTRUCTIONS.G2;

  return `Rewrite the following text. ${levelInstruction}
Provide a different version from a previous attempt — keep the same meaning but use different words and sentence structures.

Also set "visualHint" to a short caption-style description (about 25–90 words) for DALL·E 3: one or two sentences naming concrete, drawable content for this block only, using the original meaning in context so ambiguous curriculum words are clearly disambiguated. No student-facing instructions—only what should appear in the illustration.

Original text: "${originalText}"

Output as JSON matching the provided schema.`;
}

/** Truncate worksheet text for DALL·E 3 disambiguation (prompt budget). */
const IMAGE_CONTEXT_MAX_CHARS = 500;

/**
 * Build a layered, caption-enhanced prompt for DALL·E 3 (Betker-style descriptive captions + instructional context).
 */
export function buildDalle3ImagePrompt(
  visualHint: string,
  options?: { label?: string; instructionalContext?: string }
): string {
  const styleBlock = `Educational illustration for grades 4–7 (science or social studies). Purpose: help a student understand the worksheet content. Visual style: clean, colorful, simple composition, friendly cartoon-like clarity; no text, letters, numbers, watermarks, or labels drawn in the image.`;

  const parts: string[] = [styleBlock];

  const label = options?.label?.trim();
  if (label) {
    parts.push(`Worksheet section label: ${label}`);
  }

  const raw = options?.instructionalContext?.trim();
  if (raw) {
    const truncated =
      raw.length > IMAGE_CONTEXT_MAX_CHARS
        ? raw.slice(0, IMAGE_CONTEXT_MAX_CHARS - 1) + "…"
        : raw;
    parts.push(
      `Instructional context (use to pick the correct curriculum meaning and avoid unrelated senses of the same words):\n${truncated}`
    );
  }

  parts.push(`Primary image caption (what to draw):\n${visualHint.trim()}`);

  return parts.join("\n\n");
}

export function buildRegenerateSummaryMessage(
  originalText: string,
  maxSentences: number
): string {
  return `Summarize the following text in at most ${maxSentences} sentences.
Provide a different version from a previous attempt — keep the same key points but use different wording.

Original text: "${originalText}"

Output as JSON matching the provided schema.`;
}

// ── JSON schema for Structured Outputs ──

export const PROCESS_JSON_SCHEMA = {
  name: "worksheet_adaptation",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      blocks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            blockId: { type: "string" as const },
            label: { type: "string" as const },
            originalText: { type: "string" as const },
            simplifiedText: { type: ["string", "null"] as const },
            keywords: { type: "array" as const, items: { type: "string" as const } },
            visualHint: { type: ["string", "null"] as const },
            rect: {
              type: "object" as const,
              properties: {
                top: { type: "number" as const },
                left: { type: "number" as const },
                width: { type: "number" as const },
                height: { type: "number" as const },
              },
              required: ["top", "left", "width", "height"],
              additionalProperties: false,
            },
          },
          required: ["blockId", "label", "originalText", "simplifiedText", "keywords", "visualHint", "rect"],
          additionalProperties: false,
        },
      },
      summary: {
        type: ["object", "null"] as const,
        properties: {
          sentences: { type: "array" as const, items: { type: "string" as const } },
          warnings: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["sentences", "warnings"],
        additionalProperties: false,
      },
    },
    required: ["blocks", "summary"],
    additionalProperties: false,
  },
};

export const REGENERATE_BLOCK_JSON_SCHEMA = {
  name: "regenerate_block",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      simplifiedText: { type: "string" as const },
      keywords: { type: "array" as const, items: { type: "string" as const } },
      visualHint: { type: ["string", "null"] as const },
    },
    required: ["simplifiedText", "keywords", "visualHint"],
    additionalProperties: false,
  },
};

export const REGENERATE_SUMMARY_JSON_SCHEMA = {
  name: "regenerate_summary",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      sentences: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["sentences"],
    additionalProperties: false,
  },
};

export { SYSTEM_PROMPT };
