import type { AdaptedBlock, ProcessMeta, DetectedBlock, Toggles } from '@trellis/shared';

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
  Process: { imageUri: string };
  WorksheetView: {
    blocks: DetectedBlock[];
    imageUri: string;
    imageBase64: string;
    toggles: Toggles;
    worksheetId?: string;
  } | undefined;
  StudentView: undefined;  // data passed via studentViewStore (avoids nav param serialisation crash)
  Export: { title: string; adaptations: AdaptationSummary[] } | undefined;
};

// Re-export shared types for convenience
export type { DetectedBlock, Toggles } from '@trellis/shared';
