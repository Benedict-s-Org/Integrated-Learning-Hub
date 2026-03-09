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
/**
 * Returns the current day of the week (e.g., "Monday") in Asia/Hong_Kong.
 */
export const getHKDayOfWeek = (): string => {
    return new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Hong_Kong', weekday: 'long' });
};

/**
 * Checks if the current HK time is within the allowed Toilet/Break usage periods.
 */
export const isWithinToiletAllowanceTime = (): boolean => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Hong_Kong',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // This gives something like "08:15" or "14:30"
        // In some environments, it might be "08:15 AM", so we parse digits
        const hkTimeStr = formatter.format(now);
        const timeMatch = hkTimeStr.match(/(\d{2}):(\d{2})/);

        if (!timeMatch) return false;

        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);

        // Convert to a comparable number e.g. 8:15 -> 815, 14:30 -> 1430
        const currentTimeVal = hour * 100 + minute;

        const dayOfWeek = getHKDayOfWeek();

        // Exclude weekends completely
        if (['Saturday', 'Sunday'].includes(dayOfWeek)) {
            return false;
        }

        // Morning Valid Times (All Weekdays)
        // 08:10 - 09:45
        if (currentTimeVal >= 810 && currentTimeVal <= 945) return true;
        // 10:05 - 11:05
        if (currentTimeVal >= 1005 && currentTimeVal <= 1105) return true;
        // 11:15 - 12:45
        if (currentTimeVal >= 1115 && currentTimeVal <= 1245) return true;

        // Afternoon Valid Times based on Day
        if (dayOfWeek === 'Monday') {
            // 13:45 ─ 14:45
            return (currentTimeVal >= 1345 && currentTimeVal <= 1445);
        } else if (['Tuesday', 'Wednesday', 'Thursday'].includes(dayOfWeek)) {
            // 13:45 ─ 14:50
            return (currentTimeVal >= 1345 && currentTimeVal <= 1450);
        } else if (dayOfWeek === 'Friday') {
            // No time after lunch on Friday
            return false;
        }

        return false;
    } catch (e) {
        console.error('Error checking HK toilet time bounds:', e);
        return false; // Fallback to restrictive
    }
};
