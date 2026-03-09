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
    const now = new Date();
    // Get the date string in HK time
    const hkDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    // Create a date object for midnight of that day in HK
    const hkMidnight = new Date(`${hkDateStr}T00:00:00`);

    // We need to get the UTC equivalent of "HK Midnight".
    // 00:00:00 in HK (UTC+8) is 16:00:00 UTC the previous day.
    // toISOString() handles the conversion correctly if we create the local-ish date properly.

    // Alternative: explicitly construct it
    const [year, month, day] = hkDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    // Since HK is UTC+8, midnight HK is 16:00 UTC of previous day
    date.setUTCHours(date.getUTCHours() - 8);

    return date.toISOString();
};
/**
 * Returns true if the current time in Asia/Hong_Kong is between 7:00 and 9:00 AM.
 */
export const isHKMorningTime = (): boolean => {
    try {
        const hkTimeStr = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Hong_Kong',
            hour: 'numeric',
            hour12: false
        });
        const hour = parseInt(hkTimeStr, 10);
        return hour >= 7 && hour < 9;
    } catch (e) {
        console.error('Error checking HK morning time:', e);
        // Fallback to local time if timezone lookup fails (though it shouldn't in modern browsers)
        const hour = new Date().getHours();
        return hour >= 7 && hour < 9;
    }
};
