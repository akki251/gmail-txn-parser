export const COLORS = {
  // Base backgrounds (Clean Modern Light Fintech)
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#F1F5F9',
  bgSubtle: '#F1F5F9',
  
  // Borders & Dividers
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderFocus: '#4F46E5',

  // Typography
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // Primary & Accents
  primary: '#4F46E5', // Vibrant Indigo
  primaryLight: '#6366F1',
  primaryDark: '#3730A3',
  primaryGlow: 'rgba(79, 70, 229, 0.12)',

  // Semantic
  income: '#059669', // Emerald
  incomeBg: 'rgba(5, 150, 105, 0.1)',
  expense: '#DC2626', // Crimson
  expenseBg: 'rgba(220, 38, 38, 0.1)',
  warning: '#D97706', // Amber
  warningBg: 'rgba(217, 119, 6, 0.1)',
  info: '#0284C7', // Sky
  infoBg: 'rgba(2, 132, 199, 0.1)',
  purple: '#7C3AED',
  purpleBg: 'rgba(124, 58, 237, 0.1)',

  // Bank Badges (Clean Light Badges)
  banks: {
    'HDFC Bank': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', short: 'HDFC' },
    'ICICI Bank': { bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8', short: 'ICICI' },
    'SBI Card': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', short: 'SBI' },
    'State Bank of India': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', short: 'SBI' },
    'Axis Bank': { bg: '#FAF5FF', text: '#86198F', border: '#F5D0FE', short: 'AXIS' },
    'IndusInd Bank': { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', short: 'INDUS' },
    'OneCard': { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE', short: 'ONE' },
    'Default': { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', short: 'BANK' },
  },

  // Category Colors
  categories: {
    'Food & Dining': '#EA580C',
    'Groceries': '#059669',
    'Shopping': '#DB2777',
    'Travel & Commute': '#0891B2',
    'Bills & Utilities': '#7C3AED',
    'Entertainment': '#D97706',
    'Health & Fitness': '#0D9488',
    'Investments': '#2563EB',
    'Transfers': '#64748B',
    'General': '#64748B',
    'Other': '#64748B',
  },
};

// Professional Multi-Layer Elevation & Shadow System
export const SHADOWS = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
  },
  glow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
};

// Liquid Multi-Stop Gradients
export const GRADIENTS = {
  primary: ['#4F46E5', '#6366F1', '#818CF8'],
  hero: ['#EEF2FF', '#F5F3FF', '#F8FAFC'],
  cardGlow: ['#FFFFFF', '#F8FAFC'],
  income: ['#059669', '#10B981'],
  expense: ['#DC2626', '#F43F5E'],
  aurora: ['#4F46E5', '#7C3AED', '#EC4899', '#06B6D4'],
};

export const getBankMeta = (bankName) => {
  if (!bankName) return COLORS.banks.Default;
  for (const key of Object.keys(COLORS.banks)) {
    if (bankName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(bankName.toLowerCase())) {
      return COLORS.banks[key];
    }
  }
  return {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
    short: bankName.slice(0, 4).toUpperCase()
  };
};

export const getCategoryColor = (category) => {
  return COLORS.categories[category] || COLORS.categories.Other;
};
