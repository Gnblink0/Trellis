export const colors = {
  // Core
  background: '#FBF8F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EDEA',

  // Brand
  primary: '#2DB89A',
  primaryLight: '#E8F5F1',

  // Text
  textPrimary: '#2D3436',
  textSecondary: '#7B8794',

  // Semantic
  /** OCR / Live Text selection — highlighter-style yellow (use with opacity in overlays). */
  selectionHighlight: '#EEFF41',
  warning: '#FFF8E1',
  warningText: '#8B7335',
  error: '#F4845F',
  /** Orange-red notification dot for markers needing review. */
  markerNotification: '#F4845F',

  // Adaptation actions
  /** Simplify action — blue for readability. */
  actionSimplify: '#3B82F6',
  /** Visuals action — warm amber for imagery. */
  actionVisuals: '#E67E22',
  /** Summarize action — green for conciseness. */
  actionSummarize: '#10B981',

  // Overlays
  scrim: '#00000059',
  shadow: '#00000026',

  // Toolbar
  toolbarBg: '#2D3436',
} as const;
