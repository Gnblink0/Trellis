// ===== Request Types =====

export interface DetectRequest {
  imageBase64: string;
}

export interface DetectedBlock {
  blockId: string;
  label: string;
  originalText: string;
  rect: { top: number; left: number; width: number; height: number };
}

export interface DetectResponse {
  blocks: DetectedBlock[];
  meta: { latencyMs: number };
}

export interface ProcessRequest {
  imageBase64: string;
  toggles: Toggles;
  options?: ProcessOptions;
  selectedBlockIds?: string[];
  /** Map of blockId → originalText, used for zone-by-zone processing to avoid re-detection mismatch */
  selectedBlockTexts?: Record<string, string>;
}

export interface Toggles {
  visualSupport: boolean;
  simplifyLevel: SimplifyLevel;
  summarize: boolean;
}

export type SimplifyLevel = 'G1' | 'G2' | null;

export interface ProcessOptions {
  summaryMaxSentences?: number; // default 5
  language?: string;            // default "en"
}

export interface RegenerateRequest {
  target: RegenerateTarget;
  context: RegenerateContext;
}

export type RegenerateTarget =
  | { type: 'block'; blockId: string }
  | { type: 'summary' }
  /** Free-form selection from extracted worksheet text (not tied to a single block). */
  | { type: 'snippet' };

/** What to compute for a user-selected phrase (snippet target). */
export type SnippetMode = 'simplify' | 'visual' | 'summary';

export interface RegenerateContext {
  originalText: string;
  simplifyLevel?: 'G1' | 'G2';
  summaryMaxSentences?: number;
  language?: string;
  /** Required when target.type === 'snippet'. */
  mode?: SnippetMode;
}

// ===== Response Types =====

export interface AdaptedBlock {
  blockId: string;
  label: string;
  originalText: string;
  simplifiedText: string | null;
  keywords: string[];
  visualHint: string | null;
  visualUrl: string | null;
  rect?: { top: number; left: number; width: number; height: number };
}

export interface SummaryResult {
  sentences: string[];
  warnings: string[];
}

export interface ProcessResponse {
  blocks: AdaptedBlock[];
  summary: SummaryResult | null;
  meta: ProcessMeta;
}

export interface ProcessMeta {
  simplifyLevel: 'G1' | 'G2' | null;
  toggles: Toggles;
  latencyMs: { total: number };
}

export interface RegenerateResponse {
  target: RegenerateTarget;
  result: RegenerateResult;
  latencyMs: number;
}

export interface RegenerateResult {
  simplifiedText?: string;
  keywords?: string[];
  visualHint?: string;
  visualUrl?: string;
  sentences?: string[];
}

// ===== Error Response =====

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_PARSE_ERROR'
  | 'AI_RATE_LIMIT'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

// ── OCR (Live Text–style word boxes, normalized to image 0–1) ──

export interface OcrWordBox {
  text: string;
  confidence: number;
  bbox: { left: number; top: number; width: number; height: number };
}

export interface OcrScanResponse {
  imageWidth: number;
  imageHeight: number;
  words: OcrWordBox[];
}
