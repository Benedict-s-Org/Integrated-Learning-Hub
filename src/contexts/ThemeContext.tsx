/**
 * Theme Context
 * 
 * Provides theme state and controls to the entire application
 */

import { createContext, useContext, ReactNode } from 'react';
import { useTheme, UseThemeReturn } from '@/hooks/useTheme';

const ThemeContext = createContext<UseThemeReturn | null>(null);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const themeValue = useTheme();

    return (
        <ThemeContext.Provider value={themeValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext(): UseThemeReturn {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}

// Re-export types for convenience
export type { UseThemeReturn } from '@/hooks/useTheme';
