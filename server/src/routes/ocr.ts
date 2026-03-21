import { Router, type Request, type Response } from "express";
import Tesseract from "tesseract.js";
import { z } from "zod/v4";
import type { ApiError, OcrScanResponse, OcrWordBox } from "@trellis/shared";

export const ocrRouter = Router();

const ocrScanSchema = z.object({
  imageBase64: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("data:image/"), "imageBase64 must be a data URI"),
});

function sendError(res: Response, status: number, error: ApiError) {
  return res.status(status).json(error);
}

/** Normalize Tesseract bbox to 0–1 relative to page dimensions. */
type TessWord = {
  text?: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

function normalizeWord(
  w: TessWord,
  pageW: number,
  pageH: number
): OcrWordBox | null {
  const t = w.text?.trim();
  if (!t) return null;
  const b = w.bbox;
  const conf = w.confidence ?? 0;
  if (conf < 35 && t.length > 1) return null;
  return {
    text: t,
    confidence: conf,
    bbox: {
      left: b.x0 / pageW,
      top: b.y0 / pageH,
      width: (b.x1 - b.x0) / pageW,
      height: (b.y1 - b.y0) / pageH,
    },
  };
}

function inferPageSize(words: TessWord[], data: { width?: number; height?: number }): {
  width: number;
  height: number;
} {
  if (data.width && data.height && data.width > 1 && data.height > 1) {
    return { width: data.width, height: data.height };
  }
  let maxX = 1;
  let maxY = 1;
  for (const w of words) {
    maxX = Math.max(maxX, w.bbox.x1);
    maxY = Math.max(maxY, w.bbox.y1);
  }
  return { width: maxX, height: maxY };
}

function collectWords(data: {
  words?: TessWord[] | null;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{ words?: TessWord[] }>;
    }>;
  }>;
}): TessWord[] {
  if (data.words && data.words.length > 0) {
    return data.words;
  }
  const out: TessWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          out.push(w);
        }
      }
    }
  }
  return out;
}

/** POST /api/ocr/scan — Live Text–style word boxes (normalized bbox). */
ocrRouter.post("/scan", async (req: Request, res: Response) => {
  const parsed = ocrScanSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const { imageBase64 } = parsed.data;
  const rawBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  const buffer = Buffer.from(rawBase64, "base64");

  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | null = null;
  try {
    worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    const ret = await worker.recognize(buffer);
    const data = ret.data as typeof ret.data & {
      width?: number;
      height?: number;
      words?: TessWord[];
      blocks?: unknown[];
    };

    const rawWords = collectWords(data);
    const { width: pageW, height: pageH } = inferPageSize(rawWords, data);

    const words: OcrWordBox[] = [];
    for (const w of rawWords) {
      const box = normalizeWord(w, pageW, pageH);
      if (box) words.push(box);
    }

    const response: OcrScanResponse = {
      imageWidth: pageW,
      imageHeight: pageH,
      words,
    };

    return res.json(response);
  } catch (err) {
    console.error("[ocr/scan]", err);
    return sendError(res, 500, {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "OCR failed.",
    });
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
});
