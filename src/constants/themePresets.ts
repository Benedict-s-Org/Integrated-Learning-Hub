/**
 * Theme Presets
 * 
 * Built-in theme presets that users can apply instantly
 */

import { Theme, ThemeColors, ThemeStyles } from '@/types/theme';

// Default styles shared across presets
const defaultStyles: ThemeStyles = {
    borderRadius: '1rem',
    fontFamily: 'Outfit',
};

// Base colors that are shared or derived
const baseColors = {
    white: '0 0% 100%',
    black: '0 0% 0%',
};

// 🍑 Peach - Current default (warm, cute)
export const peachTheme: Theme = {
    id: 'preset-peach',
    name: '🍑 蜜桃暖色',
    description: '溫暖可愛的橙粉色調',
    isSystem: true,
    isDefault: true,
    colors: {
        primary: '15 85% 65%',
        primaryForeground: baseColors.white,
        secondary: '35 70% 94%',
        secondaryForeground: '15 40% 25%',
        accent: '335 85% 75%',
        accentForeground: baseColors.white,
        background: '35 100% 99%',
        foreground: '220 20% 10%',
        card: baseColors.white,
        cardForeground: '220 20% 10%',
        muted: '35 40% 95%',
        mutedForeground: '15 15% 45%',
        border: '15 20% 90%',
        input: '15 20% 90%',
        ring: '15 85% 65%',
        destructive: '0 85% 65%',
        destructiveForeground: baseColors.white,
        panelBg: '35 100% 97%',
        panelBorder: '15 30% 88%',
    },
    styles: defaultStyles,
};

// 🌊 Ocean - Cool blues and teals
export const oceanTheme: Theme = {
    id: 'preset-ocean',
    name: '🌊 海洋藍調',
    description: '清涼舒適的藍綠色調',
    isSystem: true,
    colors: {
        primary: '200 80% 50%',
        primaryForeground: baseColors.white,
        secondary: '190 60% 92%',
        secondaryForeground: '200 50% 25%',
        accent: '170 70% 45%',
        accentForeground: baseColors.white,
        background: '200 30% 98%',
        foreground: '210 30% 15%',
        card: baseColors.white,
        cardForeground: '210 30% 15%',
        muted: '200 25% 94%',
        mutedForeground: '200 15% 45%',
        border: '200 20% 88%',
        input: '200 20% 88%',
        ring: '200 80% 50%',
        destructive: '0 75% 55%',
        destructiveForeground: baseColors.white,
        panelBg: '200 40% 96%',
        panelBorder: '200 30% 90%',
    },
    styles: defaultStyles,
};

// 🌲 Forest - Earthy greens and browns
export const forestTheme: Theme = {
    id: 'preset-forest',
    name: '🌲 森林綠意',
    description: '自然清新的綠棕色調',
    isSystem: true,
    colors: {
        primary: '140 45% 45%',
        primaryForeground: baseColors.white,
        secondary: '80 35% 92%',
        secondaryForeground: '140 30% 25%',
        accent: '35 60% 50%',
        accentForeground: baseColors.white,
        background: '80 25% 98%',
        foreground: '140 20% 15%',
        card: baseColors.white,
        cardForeground: '140 20% 15%',
        muted: '80 20% 94%',
        mutedForeground: '140 10% 45%',
        border: '80 15% 88%',
        input: '80 15% 88%',
        ring: '140 45% 45%',
        destructive: '0 70% 55%',
        destructiveForeground: baseColors.white,
        panelBg: '80 30% 96%',
        panelBorder: '80 20% 90%',
    },
    styles: defaultStyles,
};

// 🌸 Sakura - Soft pinks and whites
export const sakuraTheme: Theme = {
    id: 'preset-sakura',
    name: '🌸 櫻花粉嫩',
    description: '柔和夢幻的粉白色調',
    isSystem: true,
    colors: {
        primary: '340 70% 75%',
        primaryForeground: baseColors.white,
        secondary: '350 50% 95%',
        secondaryForeground: '340 40% 30%',
        accent: '320 60% 65%',
        accentForeground: baseColors.white,
        background: '350 100% 99%',
        foreground: '340 20% 15%',
        card: baseColors.white,
        cardForeground: '340 20% 15%',
        muted: '350 30% 95%',
        mutedForeground: '340 15% 50%',
        border: '350 25% 90%',
        input: '350 25% 90%',
        ring: '340 70% 75%',
        destructive: '0 80% 60%',
        destructiveForeground: baseColors.white,
        panelBg: '350 40% 97%',
        panelBorder: '350 30% 93%',
    },
    styles: defaultStyles,
};

// 🌙 Midnight - Dark mode with purple accents
export const midnightTheme: Theme = {
    id: 'preset-midnight',
    name: '🌙 午夜星空',
    description: '深邃優雅的暗色主題',
    isSystem: true,
    isDark: true,
    colors: {
        primary: '260 70% 65%',
        primaryForeground: baseColors.white,
        secondary: '250 30% 20%',
        secondaryForeground: '260 20% 90%',
        accent: '280 80% 70%',
        accentForeground: baseColors.white,
        background: '240 20% 8%',
        foreground: '0 0% 95%',
        card: '240 20% 12%',
        cardForeground: '0 0% 95%',
        muted: '240 15% 18%',
        mutedForeground: '240 10% 60%',
        border: '240 15% 22%',
        input: '240 15% 22%',
        ring: '260 70% 65%',
        destructive: '0 70% 50%',
        destructiveForeground: baseColors.white,
        panelBg: '240 20% 6%',
        panelBorder: '240 15% 15%',
    },
    styles: defaultStyles,
};

// All presets as a map
export const THEME_PRESETS: Record<string, Theme> = {
    peach: peachTheme,
    ocean: oceanTheme,
    forest: forestTheme,
    sakura: sakuraTheme,
    midnight: midnightTheme,
};

// Get preset by ID
export function getPreset(id: string): Theme | undefined {
    return THEME_PRESETS[id];
}

// Get all presets as array
export function getAllPresets(): Theme[] {
    return Object.values(THEME_PRESETS);
}

// Default theme
export const DEFAULT_THEME = peachTheme;
