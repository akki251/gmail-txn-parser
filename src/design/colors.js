export const colors = {
  background: '#F5F5F2', // Primary background (paper-like)
  surface: '#FFFFFF', // Surfaces (cards, sheets)

  textPrimary: '#111111', // Deep ink text
  textSecondary: '#6F6F6A',
  textMuted: '#A1A19B',

  border: '#E4E4DF',

  primary: '#4338CA', // Indigo
  primaryStrong: '#2B20D9', // Strong primary
  
  // Semantic Colors
  income: '#15966F',
  incomeBackground: '#E7F6F0',
  
  expense: '#D94A5B', // Use sparingly; normal expenses are usually textPrimary
  expenseBackground: '#FBECEF',
  
  warning: '#D58A18',
  warningSoft: '#FFF4DC', // Warning background
  
  // Base
  white: '#FFFFFF',
  black: '#111111',
};

// Avatar palette utilizing new tokens
export const AvatarPalette = [
  { bg: colors.primary, fg: colors.white },
  { bg: '#E8E7FF', fg: colors.primary }, // Soft indigo
  { bg: colors.warningSoft, fg: colors.warning },
  { bg: colors.incomeBackground, fg: colors.income },
  { bg: '#F0F0F0', fg: colors.black },
];

export function avatarColorFor(label = '') {
  const str = String(label || '?');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AvatarPalette[hash % AvatarPalette.length];
}
