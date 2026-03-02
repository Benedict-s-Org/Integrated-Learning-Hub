/**
 * Utility for consistent date handling across the application.
 * All daily resets and comparisons should use Asia/Hong_Kong time.
 */

/**
 * Returns the current date in YYYY-MM-DD format (Asia/Hong_Kong).
 * Used for storing and comparing 'daily' records.
 */
export const getHKTodayString = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
};

/**
 * Format a DB timestamp (ISO) to a user-friendly HK date string.
 */
export const formatHKDate = (isoString: string): string => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

/**
 * Returns a full ISO string for the start of today in HK time.
 */
export const getHKTodayStartISO = (): string => {
    const todayStr = getHKTodayString();
    return `${todayStr}T00:00:00Z`;
};
