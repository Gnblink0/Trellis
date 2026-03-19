// ===== Request Types =====

export interface ProcessRequest {
  imageBase64: string;
  toggles: Toggles;
  options?: ProcessOptions;
}

export interface Toggles {
  visualSupport: boolean;
  simplifyLevel: SimplifyLevel;
  summarize: boolean;
}

export type SimplifyLevel = 'G1' | 'G2' | null;

// Selected-text adaptation (triggered from iOS OCR selection)
export type SelectedSimplifyLevel = 'G4' | 'G5' | 'G6' | 'G7';

export type SelectedProcessAction = 'simplify' | 'summarize' | 'visuals';

export interface ProcessSelectedTextRequest {
  selectedText: string;
  action: SelectedProcessAction;
  simplifyLevel?: SelectedSimplifyLevel; // required when action === 'simplify'
  summaryMaxSentences?: number; // default 5
  language?: string; // default 'en'
}

export interface SimplifySelectedTextResult {
  simplifiedText: string;
  keywords: string[];
}

export interface SummarizeSelectedTextResult {
  sentences: string[];
}

export interface VisualsSelectedTextResult {
  visualHint: string;
  visualUrl: string | null;
}

export type ProcessSelectedTextResponse =
  | { action: 'simplify'; result: SimplifySelectedTextResult }
  | { action: 'summarize'; result: SummarizeSelectedTextResult }
  | { action: 'visuals'; result: VisualsSelectedTextResult };

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
  | { type: 'summary' };

export interface RegenerateContext {
  originalText: string;
  simplifyLevel?: 'G1' | 'G2';
  summaryMaxSentences?: number;
  language?: string;
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
