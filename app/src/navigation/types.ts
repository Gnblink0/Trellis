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
};

export type RootStackParamList = {
  Home: undefined;
  WorksheetView: undefined;
  StudentView: { title: string; adaptations: AdaptedZone[] } | undefined;
  Export: { title: string; adaptations: AdaptationSummary[] } | undefined;
};
