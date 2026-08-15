/**
 * Centralized Design System Tokens for GmailTxnParserAndroid.
 * Theme: Editorial Financial Aesthetic (Apple × Monocle × Linear × Revolut).
 */
export const Colors = {
  // Dark Mode Primary Palette
  background: '#090d16',        // Deep editorial dark slate
  surface: '#131b2e',           // Muted container surface
  surfaceElevated: '#1c2842',   // Elevated card surface
  surfaceHover: '#243354',      // Active/pressed surface
  border: '#263554',            // Thin, subtle divider lines
  borderLight: '#33446b',       // High-contrast divider

  // Semantic Typography
  textPrimary: '#f8fafc',       // Crisp primary text
  textSecondary: '#94a3b8',     // Muted secondary text
  textMuted: '#64748b',         // Subtle metadata text
  textDisabled: '#475569',      // Disabled text state

  // Financial Semantics
  positive: '#10b981',          // Emerald green for income/credits
  positiveMuted: '#064e3b',     // Dark green container background
  negative: '#f43f5e',          // Rose red for debits/spends
  negativeMuted: '#881337',     // Dark rose container background
  warning: '#f59e0b',           // Amber for review queue / due alerts
  warningMuted: '#78350f',      // Dark amber container background

  // Accent & Brand Colors
  accent: '#6366f1',            // Indigo accent
  accentLight: '#818cf8',       // Indigo highlight
  accentMuted: '#312e81',       // Dark indigo container
};

export const Typography = {
  display: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 26,
    lineHeight: 30,
  },
  h3: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  tx: 32,
  huge: 48,
};

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  pill: 999,
};

export const Shadows = {
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
};
