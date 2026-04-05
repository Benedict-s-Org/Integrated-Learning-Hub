import { supabase } from '@/integrations/supabase/client';

export interface HolidayConfig {
    holidayMode: boolean;
    manualHolidays: string[];
}

export const holidayService = {
    /**
     * Fetch the current holiday configuration from system_config.
     */
    async getHolidayConfig(): Promise<HolidayConfig> {
        try {
            const { data, error } = await supabase
                .from('system_config' as any)
                .select('key, value')
                .in('key', ['holiday_mode', 'manual_holiday_dates']);

            if (error) throw error;

            const config: HolidayConfig = {
                holidayMode: false,
                manualHolidays: []
            };

            data?.forEach((item: any) => {
                if (item.key === 'holiday_mode') {
                    config.holidayMode = item.value === 'true';
                } else if (item.key === 'manual_holiday_dates') {
                    try {
                        config.manualHolidays = JSON.parse(item.value);
                    } catch (e) {
                        config.manualHolidays = [];
                    }
                }
            });

            return config;
        } catch (err) {
            console.error('Failed to fetch holiday config:', err);
            return { holidayMode: false, manualHolidays: [] };
        }
    },

    /**
     * Toggle holiday mode for a specific date or globally.
     */
    async updateHolidayConfig(updates: Partial<HolidayConfig>): Promise<{ success: boolean; error?: any }> {
        try {
            const promises = [];

            if (updates.holidayMode !== undefined) {
                promises.push(
                    supabase
                        .from('system_config' as any)
                        .update({ value: updates.holidayMode ? 'true' : 'false' })
                        .eq('key', 'holiday_mode')
                );
            }

            if (updates.manualHolidays !== undefined) {
                promises.push(
                    supabase
                        .from('system_config' as any)
                        .update({ value: JSON.stringify(updates.manualHolidays) })
                        .eq('key', 'manual_holiday_dates')
                );
            }

            const results = await Promise.all(promises);
            const error = results.find(r => r.error)?.error;

            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('Failed to update holiday config:', err);
            return { success: false, error: err };
        }
    },

    /**
     * Toggle holiday status for a specific date string (YYYY-MM-DD).
     */
    async toggleDateHoliday(date: string): Promise<{ success: boolean; error?: any }> {
        try {
            const config = await this.getHolidayConfig();
            const holidays = new Set(config.manualHolidays);
            
            if (holidays.has(date)) {
                holidays.delete(date);
            } else {
                holidays.add(date);
            }

            return await this.updateHolidayConfig({ manualHolidays: Array.from(holidays) });
        } catch (err) {
            console.error('Failed to toggle holiday date:', err);
            return { success: false, error: err };
        }
    },

    /**
     * Toggle the global holiday mode boolean.
     */
    async toggleGlobalHoliday(): Promise<{ success: boolean; error?: any }> {
        try {
            const config = await this.getHolidayConfig();
            return await this.updateHolidayConfig({ holidayMode: !config.holidayMode });
        } catch (err) {
            console.error('Failed to toggle global holiday mode:', err);
            return { success: false, error: err };
        }
    }
};
