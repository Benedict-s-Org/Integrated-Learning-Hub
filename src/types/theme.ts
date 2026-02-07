/**
 * Theme System Types
 * 
 * Defines the structure for customizable themes
 */

// HSL color format: "H S% L%" (e.g., "15 85% 65%")
export type HSLColor = string;

// All customizable color variables
export interface ThemeColors {
    primary: HSLColor;
    primaryForeground: HSLColor;
    secondary: HSLColor;
    secondaryForeground: HSLColor;
    accent: HSLColor;
    accentForeground: HSLColor;
    background: HSLColor;
    foreground: HSLColor;
    card: HSLColor;
    cardForeground: HSLColor;
    muted: HSLColor;
    mutedForeground: HSLColor;
    border: HSLColor;
    input: HSLColor;
    ring: HSLColor;
    destructive: HSLColor;
    destructiveForeground: HSLColor;
}

// Style settings beyond colors
export interface ThemeStyles {
    borderRadius: string;      // e.g., "1rem"
    fontFamily: string;        // e.g., "Outfit"
}

// Complete theme definition
export interface Theme {
    id: string;
    name: string;
    description?: string;
    colors: ThemeColors;
    styles: ThemeStyles;
    isDark?: boolean;
    isSystem?: boolean;        // Built-in presets
    isDefault?: boolean;
    createdAt?: string;
    createdBy?: string;
}

// Partial theme for updates
export type ThemeUpdate = Partial<ThemeColors> & Partial<ThemeStyles>;

// Theme preset identifier
export type ThemePresetId =
    | 'peach'
    | 'ocean'
    | 'forest'
    | 'sakura'
    | 'midnight'
    | 'custom';

// Context value type
export interface ThemeContextValue {
    currentTheme: Theme;
    setTheme: (theme: Theme) => void;
    updateColors: (colors: Partial<ThemeColors>) => void;
    updateStyles: (styles: Partial<ThemeStyles>) => void;
    applyPreset: (presetId: ThemePresetId) => void;
    resetToDefault: () => void;
    saveTheme: (name: string) => Promise<void>;
    loadTheme: (id: string) => Promise<void>;
    savedThemes: Theme[];
    isLoading: boolean;
}
