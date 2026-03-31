import { Router, type Request, type Response } from "express";
import * as vision from "@google-cloud/vision";
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

// ── Google Cloud Vision client (shared with adapt router) ──

let _visionClient: vision.ImageAnnotatorClient | null = null;

function getVisionClient(): vision.ImageAnnotatorClient {
  if (!_visionClient) {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (apiKey) {
      _visionClient = new vision.ImageAnnotatorClient({ apiKey });
    } else {
      _visionClient = new vision.ImageAnnotatorClient();
    }
  }
  return _visionClient;
}

interface Vertex {
  x?: number | null;
  y?: number | null;
}

/** POST /api/ocr/scan — Live Text–style word boxes (normalized bbox) via Google Cloud Vision. */
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

  try {
    const client = getVisionClient();
    const [result] = await client.documentTextDetection({
      image: { content: rawBase64 },
    });

    const annotation = result.fullTextAnnotation;
    if (!annotation || !annotation.pages?.length) {
      const response: OcrScanResponse = { imageWidth: 1, imageHeight: 1, words: [] };
      return res.json(response);
    }

    const page = annotation.pages[0];
    const pageW = page.width ?? 1;
    const pageH = page.height ?? 1;

    const words: OcrWordBox[] = [];

    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          // Build word text from symbols
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
          if (!text.trim()) continue;

          const confidence = word.confidence ?? 0;
          if (confidence < 0.35 && text.length > 1) continue;

          // Compute bounding rect from vertices
          const vertices: Vertex[] =
            (word.boundingBox?.vertices as Vertex[]) ?? [];
          if (vertices.length < 4) continue;

          const xs = vertices.map((v) => v.x ?? 0);
          const ys = vertices.map((v) => v.y ?? 0);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          words.push({
            text: text.trim(),
            confidence: Math.round(confidence * 100),
            bbox: {
              left: minX / pageW,
              top: minY / pageH,
              width: (maxX - minX) / pageW,
              height: (maxY - minY) / pageH,
            },
          });
        }
      }
    }

    const response: OcrScanResponse = {
      imageWidth: pageW,
      imageHeight: pageH,
      words,
    };

    console.log(`[ocr/scan] Google Vision: ${words.length} words detected (${pageW}x${pageH})`);
    return res.json(response);
  } catch (err) {
    console.error("[ocr/scan] Google Vision error:", err);
    return sendError(res, 500, {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "OCR failed.",
    });
  }
});
