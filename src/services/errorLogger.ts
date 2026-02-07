import { supabase } from '@/integrations/supabase/client';

/**
 * Error Logger Service
 * 
 * Automatically logs development errors to the database while
 * sanitizing sensitive information for security.
 */

// Patterns that indicate sensitive data - these will be redacted
const SENSITIVE_PATTERNS = [
    // API Keys and Tokens
    /(?:api[_-]?key|apikey|token|bearer|auth|secret|password|pwd|pass|credential)[=:\s]["']?[\w\-._~:/?#\[\]@!$&'()*+,;=%]{8,}/gi,
    /(?:sk|pk|rk)[-_][a-zA-Z0-9]{20,}/g, // Stripe-style keys
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
    /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, // JWT tokens

    // Supabase specific
    /supabase[_-]?(key|url|anon|service)[=:\s]["']?[^\s"']+/gi,
    /sbp_[a-zA-Z0-9]{40,}/g, // Supabase tokens

    // Email addresses
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // File paths with usernames (macOS/Linux/Windows)
    /\/Users\/[^\/\s]+/g,
    /\/home\/[^\/\s]+/g,
    /C:\\Users\\[^\\s]+/gi,

    // IP addresses
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // Connection strings
    /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,

    // Environment variables with sensitive names
    /(?:DATABASE_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY|OPENAI_API_KEY|FLOWITH_API_KEY)[=:\s]["']?[^\s"']+/gi,
];

// Words that suggest the entire message might be sensitive
const SENSITIVE_KEYWORDS = [
    'password', 'secret', 'credential', 'private_key', 'privatekey',
    'access_token', 'refresh_token', 'session_id', 'sessionid',
    'credit_card', 'creditcard', 'ssn', 'social_security',
];

/**
 * Sanitize a string by removing sensitive information
 */
function sanitizeString(input: string | null | undefined): string {
    if (!input) return '';

    let sanitized = input;

    // Replace sensitive patterns with [REDACTED]
    for (const pattern of SENSITIVE_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Normalize file paths (remove user-specific parts)
    sanitized = sanitized
        .replace(/\/Users\/[^\/]+/g, '/Users/[USER]')
        .replace(/\/home\/[^\/]+/g, '/home/[USER]')
        .replace(/C:\\Users\\[^\\]+/gi, 'C:\\Users\\[USER]');

    return sanitized;
}

/**
 * Check if the error message contains too much sensitive content
 */
function isTooSensitive(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return SENSITIVE_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Sanitize file path for storage
 */
function sanitizeFilePath(filePath: string | null | undefined): string | null {
    if (!filePath) return null;

    // Extract just the relative path from src/ or similar
    const srcMatch = filePath.match(/src\/.*$/);
    if (srcMatch) return srcMatch[0];

    const pagesMatch = filePath.match(/pages\/.*$/);
    if (pagesMatch) return pagesMatch[0];

    const componentsMatch = filePath.match(/components\/.*$/);
    if (componentsMatch) return componentsMatch[0];

    // If no match, just get the filename
    const parts = filePath.split(/[\/\\]/);
    return parts[parts.length - 1] || null;
}

export type ErrorCategory =
    | 'file_edit'
    | 'import_missing'
    | 'type_mismatch'
    | 'lint_error'
    | 'build_failure'
    | 'runtime_error'
    | 'database'
    | 'git'
    | 'deployment'
    | 'other';

export interface ErrorLogEntry {
    category: ErrorCategory;
    error_code?: string;
    error_message: string;
    file_path?: string;
    line_number?: number;
    trigger_action?: string;
    solution: string;
    prevention?: string;
    tags?: string[];
}

/**
 * Log an error to the database with automatic sanitization
 */
export async function logError(entry: ErrorLogEntry): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        // Sanitize all text fields
        const sanitizedEntry = {
            category: entry.category,
            error_code: entry.error_code?.slice(0, 50), // Limit length
            error_message: sanitizeString(entry.error_message),
            file_path: sanitizeFilePath(entry.file_path),
            line_number: entry.line_number,
            trigger_action: sanitizeString(entry.trigger_action),
            solution: sanitizeString(entry.solution),
            prevention: sanitizeString(entry.prevention),
            tags: entry.tags?.map(t => t.toLowerCase().slice(0, 30)), // Normalize tags
        };

        // Skip if the message is too sensitive
        if (isTooSensitive(entry.error_message)) {
            console.warn('Skipping error log: message contains sensitive keywords');
            return { success: false, error: 'Message contains sensitive content' };
        }

        // Check if similar error already exists (avoid duplicates)
        // Using 'as any' because dev_error_log types are generated after running migration
        const { data: existing } = await (supabase as any)
            .from('dev_error_log')
            .select('id, occurrence_count')
            .eq('error_message', sanitizedEntry.error_message)
            .eq('category', sanitizedEntry.category)
            .maybeSingle();

        if (existing) {
            // Update occurrence count instead of creating duplicate
            const { error: updateError } = await (supabase as any)
                .from('dev_error_log')
                .update({
                    occurrence_count: (existing.occurrence_count || 1) + 1,
                    last_occurred_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;
            return { success: true, id: existing.id };
        }

        // Insert new error
        const { data, error } = await (supabase as any)
            .from('dev_error_log')
            .insert(sanitizedEntry)
            .select('id')
            .single();

        if (error) throw error;
        return { success: true, id: data?.id };

    } catch (err) {
        console.error('Failed to log error:', err);
        return { success: false, error: String(err) };
    }
}

/**
 * Batch log multiple errors
 */
export async function logErrors(entries: ErrorLogEntry[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const entry of entries) {
        const result = await logError(entry);
        if (result.success) {
            success++;
        } else {
            failed++;
        }
    }

    return { success, failed };
}

/**
 * Quick helper to log a lint error
 */
export async function logLintError(
    message: string,
    filePath?: string,
    lineNumber?: number,
    solution?: string
) {
    return logError({
        category: 'lint_error',
        error_message: message,
        file_path: filePath,
        line_number: lineNumber,
        solution: solution || 'Review and fix the lint warning',
        tags: ['lint', 'auto-logged'],
    });
}

/**
 * Quick helper to log a build error
 */
export async function logBuildError(
    message: string,
    errorCode?: string,
    solution?: string
) {
    return logError({
        category: 'build_failure',
        error_code: errorCode,
        error_message: message,
        solution: solution || 'Review build output and fix the error',
        tags: ['build', 'auto-logged'],
    });
}

/**
 * Quick helper to log a type error
 */
export async function logTypeError(
    message: string,
    filePath?: string,
    solution?: string
) {
    return logError({
        category: 'type_mismatch',
        error_code: 'TS',
        error_message: message,
        file_path: filePath,
        solution: solution || 'Check type definitions and fix the mismatch',
        tags: ['typescript', 'type', 'auto-logged'],
    });
}
