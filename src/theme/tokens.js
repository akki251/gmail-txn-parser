/**
 * Centralized Design System Tokens for GmailTxnParserAndroid.
 * Theme: Editorial Financial Aesthetic (Apple × Monocle × Linear × Revolut).
 */
export const Colors = {
  // Light Mode Primary Palette
  background: '#f2f7f4',        // Soft mint-tinted off-white background
  surface: '#ffffff',           // Pure white container surface
  surfaceElevated: '#ffffff',   // Elevated card surface (same in light mode, relies on shadow)
  surfaceHover: '#f8f9fa',      // Active/pressed surface
  border: '#ebecef',            // Thin, subtle divider lines
  borderLight: '#f1f2f5',       // Even lighter divider

  // Semantic Typography
  textPrimary: '#1a1a1c',       // High contrast almost-black
  textSecondary: '#8a8d9a',     // Muted secondary text
  textMuted: '#a0a3b1',         // Subtle metadata text
  textDisabled: '#c4c6cf',      // Disabled text state

  // Financial Semantics
  positive: '#2e7d32',          // Green for income/credits
  positiveMuted: '#e8f5e9',     // Light green container background
  negative: '#d32f2f',          // Red for debits/spends
  negativeMuted: '#ffebee',     // Light red container background
  warning: '#ed6c02',           // Amber/Orange for alerts
  warningMuted: '#fff3e0',      // Light amber container background

  // Accent & Brand Colors (Deep Indigo — premium, less garish than pure electric blue)
  accent: '#4338ca',             // Deep indigo
  accentLight: '#6d28d9',        // Violet-leaning highlight
  accentMuted: '#eeecfb',        // Very light indigo for icon backgrounds
  accentSoft: '#f4f3fc',         // Barely-there indigo tint for inactive chrome

  // Dark Hero Card
  heroBg: '#111417',             // Near-black base for hero/summary card
  heroBgAlt: '#1a1e23',          // Slightly lighter near-black for gradient stop
  heroBlobA: 'rgba(58,51,255,0.35)',  // Drifting blob tint A (accent)
  heroBlobB: 'rgba(47,191,113,0.22)', // Drifting blob tint B (positive/mint)
  heroBlobC: 'rgba(255,255,255,0.06)', // Drifting blob tint C (soft highlight)
  heroText: '#f5f6f8',            // Primary text on dark hero
  heroTextMuted: 'rgba(245,246,248,0.56)', // Secondary text on dark hero
  heroLine: 'rgba(245,246,248,0.85)',      // Sparkline stroke on dark hero
  heroDivider: 'rgba(245,246,248,0.08)',   // Faint divider on dark hero

  // Warm hero variant (amber/orange glow, Revolut-card-style bleed)
  heroGlowA: 'rgba(249,115,22,0.45)',  // Warm orange blob
  heroGlowB: 'rgba(217,70,20,0.30)',   // Deeper burnt-orange blob
  heroGlowC: 'rgba(255,255,255,0.06)', // Soft highlight blob
  heroBleed: '#c2410c',                // Outer bleed/glow color behind the card
  spend: '#ea580c',                    // Warm orange for debit/spend amounts (replaces flat red on hero)

  // Mint/off-white body background
  backgroundMint: '#f2f7f4',
};

// Deterministic avatar palette — merchants get a stable, varied color instead of
// every row using the same flat accent tint (which read as "one gray template").
export const AvatarPalette = [
  { bg: '#eeecfb', fg: '#4338ca' }, // indigo
  { bg: '#e6f4ea', fg: '#1e7d4f' }, // green
  { bg: '#fdeee3', fg: '#c05621' }, // amber/orange
  { bg: '#fde8ef', fg: '#be185d' }, // rose
  { bg: '#e3f2fd', fg: '#0f6ab0' }, // blue
  { bg: '#f1ecfd', fg: '#7c3aed' }, // violet
  { bg: '#e6f7f5', fg: '#0f8577' }, // teal
];

export function avatarColorFor(label = '') {
  const str = String(label || '?');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AvatarPalette[hash % AvatarPalette.length];
}

// Type hierarchy: Merriweather (serif) carries editorial weight — display numbers,
// section headings, anything meant to feel like a statement. Asap (sans) handles
// everything functional — body copy, labels, buttons, captions. Standard two-family
// pairing: serif for emphasis/hierarchy, grotesque sans for UI legibility at small sizes.
export const Typography = {
  display: {
    fontFamily: 'Merriweather_900Black',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  h3: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 17,
    lineHeight: 23,
  },
  numeric: {
    fontFamily: 'Merriweather_900Black',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  numericSmall: {
    fontFamily: 'Merriweather_700Bold',
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'Asap_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: 'Asap_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: 'Asap_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: 'Asap_500Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: 'Asap_600SemiBold',
    fontSize: 14,
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
  large: 24,
  xlarge: 32,
  pill: 999,
};

export const Shadows = {
  subtle: {
    shadowColor: '#0c0d10',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    shadowColor: '#0c0d10',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 28,
    elevation: 6,
  },
  floating: {
    shadowColor: '#0c0d10',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 10,
  },
};

export const Animation = {
  micro: 150,      // 120-160ms for hover, micro-interactions
  standard: 200,   // 180-240ms for standard transitions
  emphasis: 300,   // 280-350ms for larger spatial changes
};
