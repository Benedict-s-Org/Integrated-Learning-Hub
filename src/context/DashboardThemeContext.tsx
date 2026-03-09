import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface DashboardTheme {
    cardBg: string;
    cardText: string;
    coinBg: string;
    coinText: string;
    coinBorder: string;
    dailyEarnedBg: string;
    dailyEarnedText: string;
    dailyEarnedBorder: string;
    numberTagBg: string;
    numberTagText: string;
}

const DEFAULT_THEME: DashboardTheme = {
    cardBg: '#ffffff',
    cardText: '#374151', // text-gray-700
    coinBg: '#f0fdf4', // bg-green-50
    coinText: '#15803d', // text-green-700
    coinBorder: '#dcfce3', // border-green-100
    dailyEarnedBg: '#ffedd5', // bg-orange-100
    dailyEarnedText: '#9a3412', // text-orange-800
    dailyEarnedBorder: '#fed7aa', // border-orange-200
    numberTagBg: '#1e293b', // bg-slate-800
    numberTagText: '#ffffff', // text-white
};

interface ThemeContextType {
    theme: DashboardTheme;
    updateTheme: (updates: Partial<DashboardTheme>) => void;
    saveTheme: () => Promise<void>;
    resetTheme: () => Promise<void>;
}

const DashboardThemeContext = createContext<ThemeContextType>({
    theme: DEFAULT_THEME,
    updateTheme: () => { },
    saveTheme: async () => { },
    resetTheme: async () => { },
});

export const useDashboardTheme = () => useContext(DashboardThemeContext);

export const DashboardThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<DashboardTheme>(DEFAULT_THEME);
    const { isAdmin } = useAuth();

    // Fetch initial theme
    useEffect(() => {
        const fetchTheme = async () => {
            try {
                const { data, error } = await (supabase
                    .from('system_config' as any)
                    .select('value')
                    .eq('key', 'dashboard_theme') as any)
                    .single();

                if (error) {
                    if (error.code !== 'PGRST116') { // Ignore "no rows returned"
                        console.error('Error fetching dashboard theme:', error);
                    }
                    return;
                }

                if (data && (data as any).value) {
                    try {
                        const parsed = JSON.parse((data as any).value);
                        setTheme((prev) => ({ ...prev, ...parsed }));
                    } catch (e) {
                        console.error('Error parsing theme JSON:', e);
                    }
                }
            } catch (err) {
                console.error('Error in fetchTheme:', err);
            }
        };

        fetchTheme();
    }, []);

    // Subscribe to real-time changes
    useEffect(() => {
        const subscription = supabase
            .channel('public:system_config')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'system_config',
                    filter: "key=eq.dashboard_theme",
                },
                (payload: any) => {
                    const newValue = payload.new.value;
                    if (newValue) {
                        try {
                            const parsed = JSON.parse(newValue);
                            setTheme((prev) => ({ ...prev, ...parsed }));
                        } catch (e) {
                            console.error('Error parsing theme update:', e);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    // Local state update (immediate UI feedback)
    const updateTheme = useCallback((updates: Partial<DashboardTheme>) => {
        setTheme((prev) => ({ ...prev, ...updates }));
    }, []);

    // Database sync (called by save button or debounced)
    const saveTheme = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const { error } = await (supabase
                .from('system_config' as any)
                .update({ value: JSON.stringify(theme) }) as any)
                .eq('key', 'dashboard_theme');

            if (error) throw error;
        } catch (err) {
            console.error('Error saving dashboard theme:', err);
            alert('Failed to save theme to database.');
        }
    }, [theme, isAdmin]);

    const resetTheme = useCallback(async () => {
        if (!isAdmin) return;
        setTheme(DEFAULT_THEME);
        try {
            const { error } = await (supabase
                .from('system_config' as any)
                .update({ value: JSON.stringify(DEFAULT_THEME) }) as any)
                .eq('key', 'dashboard_theme');

            if (error) throw error;
        } catch (err) {
            console.error('Error resetting dashboard theme:', err);
        }
    }, [isAdmin]);

    return (
        <DashboardThemeContext.Provider value={{ theme, updateTheme, saveTheme, resetTheme }}>
            {children}
        </DashboardThemeContext.Provider>
    );
};
