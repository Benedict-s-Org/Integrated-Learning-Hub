/**
 * useTheme Hook
 * 
 * Manages theme state and applies CSS variables to the document
 */

import { useState, useCallback, useEffect } from 'react';
import { Theme, ThemeColors, ThemeStyles, ThemePresetId } from '@/types/theme';
import { THEME_PRESETS, DEFAULT_THEME, getPreset } from '@/constants/themePresets';

const STORAGE_KEY = 'app-theme';
const CUSTOM_THEMES_KEY = 'app-custom-themes';

// CSS variable name mapping
const COLOR_VAR_MAP: Record<keyof ThemeColors, string> = {
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    secondary: '--secondary',
    secondaryForeground: '--secondary-foreground',
    accent: '--accent',
    accentForeground: '--accent-foreground',
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    cardForeground: '--card-foreground',
    muted: '--muted',
    mutedForeground: '--muted-foreground',
    border: '--border',
    input: '--input',
    ring: '--ring',
    destructive: '--destructive',
    destructiveForeground: '--destructive-foreground',
};

/**
 * Apply theme colors to CSS variables
 */
function applyColorsToDOM(colors: ThemeColors): void {
    const root = document.documentElement;

    Object.entries(colors).forEach(([key, value]) => {
        const cssVar = COLOR_VAR_MAP[key as keyof ThemeColors];
        if (cssVar && value) {
            root.style.setProperty(cssVar, value);
        }
    });
}

/**
 * Apply theme styles to CSS variables
 */
function applyStylesToDOM(styles: ThemeStyles): void {
    const root = document.documentElement;

    if (styles.borderRadius) {
        root.style.setProperty('--radius', styles.borderRadius);
    }

    if (styles.fontFamily) {
        root.style.setProperty('--font-family', styles.fontFamily);
        document.body.style.fontFamily = `'${styles.fontFamily}', sans-serif`;
    }
}

/**
 * Apply dark mode class
 */
function applyDarkMode(isDark: boolean): void {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/**
 * Load theme from localStorage
 */
function loadStoredTheme(): Theme | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load stored theme:', e);
    }
    return null;
}

/**
 * Save theme to localStorage
 */
function saveThemeToStorage(theme: Theme): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch (e) {
        console.warn('Failed to save theme:', e);
    }
}

/**
 * Load custom themes from localStorage
 */
function loadCustomThemes(): Theme[] {
    try {
        const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load custom themes:', e);
    }
    return [];
}

/**
 * Save custom themes to localStorage
 */
function saveCustomThemes(themes: Theme[]): void {
    try {
        localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
    } catch (e) {
        console.warn('Failed to save custom themes:', e);
    }
}

/**
 * Main theme hook
 */
export function useTheme() {
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
        const stored = loadStoredTheme();
        return stored || DEFAULT_THEME;
    });

    const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
        return loadCustomThemes();
    });

    const [isLoading] = useState(false);

    // Apply theme to DOM whenever it changes
    useEffect(() => {
        applyColorsToDOM(currentTheme.colors);
        applyStylesToDOM(currentTheme.styles);
        applyDarkMode(currentTheme.isDark || false);
        saveThemeToStorage(currentTheme);
    }, [currentTheme]);

    // Set entire theme
    const setTheme = useCallback((theme: Theme) => {
        setCurrentTheme(theme);
    }, []);

    // Update only colors
    const updateColors = useCallback((colors: Partial<ThemeColors>) => {
        setCurrentTheme(prev => ({
            ...prev,
            id: 'custom',
            name: '🎨 自訂主題',
            isSystem: false,
            colors: {
                ...prev.colors,
                ...colors,
            },
        }));
    }, []);

    // Update only styles
    const updateStyles = useCallback((styles: Partial<ThemeStyles>) => {
        setCurrentTheme(prev => ({
            ...prev,
            id: 'custom',
            name: '🎨 自訂主題',
            isSystem: false,
            styles: {
                ...prev.styles,
                ...styles,
            },
        }));
    }, []);

    // Apply a preset theme
    const applyPreset = useCallback((presetId: ThemePresetId) => {
        const preset = getPreset(presetId);
        if (preset) {
            setCurrentTheme(preset);
        }
    }, []);

    // Reset to default theme
    const resetToDefault = useCallback(() => {
        setCurrentTheme(DEFAULT_THEME);
    }, []);

    // Save current theme as custom
    const saveAsCustom = useCallback((name: string, description?: string) => {
        const newTheme: Theme = {
            ...currentTheme,
            id: `custom-${Date.now()}`,
            name,
            description,
            isSystem: false,
            createdAt: new Date().toISOString(),
        };

        const updated = [...customThemes, newTheme];
        setCustomThemes(updated);
        saveCustomThemes(updated);
        setCurrentTheme(newTheme);

        return newTheme;
    }, [currentTheme, customThemes]);

    // Delete a custom theme
    const deleteCustomTheme = useCallback((id: string) => {
        const updated = customThemes.filter(t => t.id !== id);
        setCustomThemes(updated);
        saveCustomThemes(updated);
    }, [customThemes]);

    // Get all available themes (presets + custom)
    const allThemes = [...Object.values(THEME_PRESETS), ...customThemes];

    // Export theme as JSON
    const exportTheme = useCallback(() => {
        const json = JSON.stringify(currentTheme, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theme-${currentTheme.name.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [currentTheme]);

    // Import theme from JSON
    const importTheme = useCallback((jsonString: string) => {
        try {
            const theme = JSON.parse(jsonString) as Theme;
            if (theme.colors && theme.styles) {
                const imported: Theme = {
                    ...theme,
                    id: `imported-${Date.now()}`,
                    isSystem: false,
                    createdAt: new Date().toISOString(),
                };
                setCurrentTheme(imported);
                return { success: true, theme: imported };
            }
            return { success: false, error: 'Invalid theme format' };
        } catch (e) {
            return { success: false, error: 'Failed to parse JSON' };
        }
    }, []);

    return {
        currentTheme,
        setTheme,
        updateColors,
        updateStyles,
        applyPreset,
        resetToDefault,
        saveAsCustom,
        deleteCustomTheme,
        allThemes,
        customThemes,
        presets: THEME_PRESETS,
        isLoading,
        exportTheme,
        importTheme,
    };
}

export type UseThemeReturn = ReturnType<typeof useTheme>;
