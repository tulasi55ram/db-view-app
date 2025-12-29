/**
 * Color Tokens - TablePlus Inspired Palette
 */

export const colors = {
  // Neutral scale
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    750: "#363636",
    800: "#262626",
    850: "#1f1f1f",
    900: "#171717",
    950: "#0a0a0a",
  },

  // Accent colors
  accent: {
    primary: "#3b82f6",
    primaryHover: "#2563eb",
    secondary: "#8b5cf6",
    secondaryHover: "#7c3aed",
  },

  // Semantic colors
  success: "#22c55e",
  successMuted: "#16a34a",
  warning: "#f59e0b",
  warningMuted: "#d97706",
  error: "#ef4444",
  errorMuted: "#dc2626",
  info: "#06b6d4",
  infoMuted: "#0891b2",
} as const;

export const darkTheme = {
  bg: {
    primary: colors.neutral[850],
    secondary: colors.neutral[900],
    tertiary: colors.neutral[800],
    hover: "#2a2a2a",
    active: "#333333",
  },
  text: {
    primary: colors.neutral[50],
    secondary: colors.neutral[400],
    tertiary: colors.neutral[500],
  },
  border: {
    default: "#303030",
    subtle: colors.neutral[800],
    focus: colors.accent.primary,
  },
} as const;

export const lightTheme = {
  bg: {
    primary: "#ffffff",
    secondary: colors.neutral[50],
    tertiary: colors.neutral[100],
    hover: "#f0f0f0",
    active: colors.neutral[200],
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    tertiary: colors.neutral[500],
  },
  border: {
    default: colors.neutral[200],
    subtle: colors.neutral[100],
    focus: colors.accent.primary,
  },
} as const;

// Data type colors for cell rendering
export const dataTypeColors = {
  null: "#737373",
  string: "#22c55e",
  number: "#3b82f6",
  boolean: "#f59e0b",
  date: "#8b5cf6",
  json: "#06b6d4",
} as const;
