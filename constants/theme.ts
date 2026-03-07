/**
 * Tikona Capital — Design System
 * Clean, trustworthy financial app palette.
 * Deep navy for authority. Warm neutrals for comfort. Strategic accent colors.
 * Every value is intentional — no decorative clutter.
 */

export const Colors = {
    brand: {
        primary: '#1B2B4B',      // Deep navy — authority, trust
        secondary: '#2563EB',    // Confident blue — CTAs, links
        accent: '#10B981',       // Clean green — success, verified
        gold: '#F59E0B',         // Premium gold — upgrade CTA
    },

    light: {
        background: '#F7F8FA',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        text: '#111827',
        textSecondary: '#6B7280',
        textTertiary: '#9CA3AF',
        border: '#E5E7EB',
        borderLight: '#F3F4F6',
        tint: '#1B2B4B',
        icon: '#6B7280',
        tabIconDefault: '#9CA3AF',
        tabIconSelected: '#1B2B4B',
        // Semantic
        success: '#059669',
        successBg: '#ECFDF5',
        danger: '#DC2626',
        dangerBg: '#FEF2F2',
        warning: '#D97706',
        warningBg: '#FFFBEB',
        info: '#2563EB',
        infoBg: '#EFF6FF',
        // Cards
        cardBg: '#FFFFFF',
        cardBorder: '#E5E7EB',
        cardShadow: 'rgba(0,0,0,0.04)',
        // Input
        inputBg: '#F9FAFB',
        inputBorder: '#D1D5DB',
        inputFocusBorder: '#2563EB',
        // Tab bar
        tabBarBg: '#FFFFFF',
        tabBarBorder: '#E5E7EB',
    },

    dark: {
        background: '#0C0F14',
        surface: '#151921',
        surfaceElevated: '#1C2230',
        text: '#F0F1F3',
        textSecondary: '#9CA3AF',
        textTertiary: '#6B7280',
        border: '#1F2937',
        borderLight: '#151921',
        tint: '#60A5FA',
        icon: '#9CA3AF',
        tabIconDefault: '#6B7280',
        tabIconSelected: '#60A5FA',
        // Semantic
        success: '#34D399',
        successBg: 'rgba(52,211,153,0.1)',
        danger: '#F87171',
        dangerBg: 'rgba(248,113,113,0.1)',
        warning: '#FBBF24',
        warningBg: 'rgba(251,191,36,0.1)',
        info: '#60A5FA',
        infoBg: 'rgba(96,165,250,0.1)',
        // Cards
        cardBg: '#151921',
        cardBorder: '#1F2937',
        cardShadow: 'rgba(0,0,0,0.2)',
        // Input
        inputBg: '#1C2230',
        inputBorder: '#2D3748',
        inputFocusBorder: '#60A5FA',
        // Tab bar
        tabBarBg: '#0C0F14',
        tabBarBorder: '#1F2937',
    },
} as const;

// 4px base grid
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
} as const;

export const BorderRadius = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    '2xl': 24,
    full: 999,
} as const;

// Typographic scale — clear hierarchy
export const FontSize = {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
    '4xl': 38,
} as const;

export type ThemeMode = 'light' | 'dark';
