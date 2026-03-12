export type AdaptationSummary = {
  zoneId: string;
  zoneLabel: string;
  action: 'simplify' | 'visuals' | 'summarize';
  original: string;
  result: string;
};

export type RootStackParamList = {
  Home: undefined;
  WorksheetView: undefined;
  Export: { title: string; adaptations: AdaptationSummary[] } | undefined;
};
