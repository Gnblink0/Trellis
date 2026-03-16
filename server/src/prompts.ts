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
- Assign each block a unique blockId like "b1", "b2", etc.`;

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
    parts.push(
      "For each text block, suggest a short visual description (2-5 words) that could be used to generate a supporting image."
    );
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

Original text: "${originalText}"

Output as JSON matching the provided schema.`;
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
          },
          required: ["blockId", "label", "originalText", "simplifiedText", "keywords", "visualHint"],
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
