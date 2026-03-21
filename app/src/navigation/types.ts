import type { AdaptedBlock, ProcessResponse, ProcessMeta } from '@trellis/shared';

// ── Legacy types (used by WorksheetViewScreen, StudentViewScreen, ExportScreen) ──

export type AdaptationSummary = {
  zoneId: string;
  zoneLabel: string;
  action: 'simplify' | 'visuals' | 'summarize';
  original: string;
  result: string;
};

export type AdaptedZone = {
  zoneId: string;
  zoneLabel: string;
  action: 'simplify' | 'visuals' | 'summarize';
  original: string;
  result: string;
  keywords?: string[];
  bullets?: string[];
  visuals?: string[];
  visualUrl?: string;
  rect?: { top: number; left: number; width: number; height: number };
};

// ── Navigation param list ──

export type RootStackParamList = {
  Home: undefined;
  WorksheetCapture: undefined;
  WorksheetView: undefined;
  Process: { imageUri: string };
  Review: { response: ProcessResponse; imageUri: string };
  /** Select phrases from extracted text (scan view); uses worksheet image + OCR-style text from blocks. */
  ScanWorksheet: { blocks: AdaptedBlock[]; meta: ProcessMeta; imageUri: string };
  /** Tesseract OCR on each page photo, Live Text–style word boxes + snippet actions. */
  /** When opened from Home recents, pass `worksheetId` so the sheet can be renamed and stays in sync. */
  OcrLiveText: { pageUris: string[]; worksheetId?: string };
  StudentView: { title: string; adaptations: AdaptedZone[]; imageUri?: string } | undefined;
  Export: { title: string; adaptations: AdaptationSummary[] } | undefined;
};

// Re-export shared types for convenience
export type { AdaptedBlock, ProcessResponse } from '@trellis/shared';
