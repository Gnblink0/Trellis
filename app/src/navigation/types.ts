import type { AdaptedBlock, ProcessResponse } from '@trellis/shared';

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
};

// ── Navigation param list ──

export type RootStackParamList = {
  Home: undefined;
  WorksheetView: undefined;
  Process: { imageUri: string };
  Review: { response: ProcessResponse; imageUri: string };
  StudentView: { title: string; adaptations: AdaptedZone[]; imageUri?: string } | undefined;
  Export: { title: string; adaptations: AdaptationSummary[] } | undefined;
};

// Re-export shared types for convenience
export type { AdaptedBlock, ProcessResponse } from '@trellis/shared';
