// ============================================================
// Handwriting Assessment System — useSession Hook
// ============================================================
// Custom React hook for managing assessment sessions via
// Supabase Realtime. Used by both GripStation (iPhone) and
// WritingStation (iPad) to stay in sync.
//
// isPaired logic: only flips to true when data arrives from
// the OTHER device (e.g., iPad sees grip data from iPhone),
// not when the current device submits its own result.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AssessmentSession,
  SessionStatus,
  GripResult,
  PressureResult,
  HandwritingResult,
  DeviceRole,
  DbSessionRow,
} from './types';
import {
  createSession as svcCreateSession,
  findSessionByCode as svcFindSessionByCode,
  updateSessionStatus as svcUpdateSessionStatus,
  updateGripResult as svcUpdateGripResult,
  updatePressureResult as svcUpdatePressureResult,
  updateHandwritingResult as svcUpdateHandwritingResult,
  mapRowToSession,
} from '@/services/supabase/assessmentService';

// ─── Types ───────────────────────────────────────────────────

interface UseSessionOptions {
  /**
   * Which device this hook instance represents:
   * - 'grip'    → iPhone (creates sessions, submits grip results)
   * - 'writing' → iPad   (joins sessions, submits writing results)
   */
  deviceRole: DeviceRole;
}

interface UseSessionReturn {
  /** Current session data, null if not yet created/joined */
  session: AssessmentSession | null;
  /** Whether a session operation is in progress */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Whether the OTHER device has submitted its results.
   *  - On iPhone (grip): true when iPad's pressure data arrives
   *  - On iPad (writing): true when iPhone's grip data arrives */
  isPaired: boolean;

  // ─── Actions ─────────────────────────────────────────────
  /** Create a new session (iPhone only). Returns session code on success. */
  createSession: (studentName: string) => Promise<string | null>;
  /** Join an existing session by code (iPad only). Returns true on success. */
  joinSession: (code: string) => Promise<boolean>;
  /** Update the session status */
  updateStatus: (status: SessionStatus) => Promise<void>;
  /** Submit grip analysis results (iPhone) */
  submitGripResult: (result: GripResult) => Promise<void>;
  /** Submit pressure analysis results (iPad) */
  submitPressureResult: (result: PressureResult) => Promise<void>;
  /** Submit handwriting analysis results (iPad) */
  submitHandwritingResult: (result: HandwritingResult) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * Hook to manage a real-time assessment session between two devices.
 *
 * Usage (iPhone — grip station):
 * ```tsx
 * const { session, createSession, isPaired } = useSession({ deviceRole: 'grip' });
 * ```
 *
 * Usage (iPad — writing station):
 * ```tsx
 * const { session, joinSession, isPaired } = useSession({ deviceRole: 'writing' });
 * ```
 */
export function useSession({ deviceRole }: UseSessionOptions): UseSessionReturn {
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(false);

  // Ref to track current session ID for cleanup without stale closures
  const sessionIdRef = useRef<string | null>(null);
  // Ref to track the Supabase channel for cleanup
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Realtime Subscription ───────────────────────────────

  /**
   * Subscribe to Realtime changes on the current session row.
   * Automatically called after createSession() or joinSession().
   */
  const subscribeToSession = useCallback(
    (sessionId: string) => {
      // Clean up any existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      sessionIdRef.current = sessionId;

      const channel = supabase
        .channel(`assessment:${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'assessment_sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as DbSessionRow;
            const updatedSession = mapRowToSession(row);
            setSession(updatedSession);

            // isPaired logic: detect data from the OTHER device
            if (deviceRole === 'grip') {
              // iPhone: paired when iPad's pressure data arrives
              if (row.avg_pressure != null || row.writing_completed_at != null) {
                setIsPaired(true);
              }
            } else {
              // iPad: paired when iPhone's grip data arrives
              if (row.grip_type != null || row.grip_completed_at != null) {
                setIsPaired(true);
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error(`[useSession] Realtime channel error for session ${sessionId}`);
            // Supabase JS client v2 auto-reconnects on channel errors,
            // so we just log here. If manual retry is needed in future,
            // we can add exponential backoff.
          }
        });

      channelRef.current = channel;
    },
    [deviceRole]
  );

  // ─── Cleanup on Unmount ──────────────────────────────────

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // ─── Actions ─────────────────────────────────────────────

  const createSession = useCallback(
    async (studentName: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const newSession = await svcCreateSession(studentName);
        setSession(newSession);
        subscribeToSession(newSession.id);
        return newSession.sessionCode;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create session';
        setError(msg);
        console.error('[useSession] createSession error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [subscribeToSession]
  );

  const joinSession = useCallback(
    async (code: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const found = await svcFindSessionByCode(code);
        if (!found) {
          setError('Session not found. Check the code and try again.');
          return false;
        }
        if (found.status === SessionStatus.COMPLETE) {
          setError('This session has already been completed.');
          return false;
        }
        setSession(found);
        subscribeToSession(found.id);

        // Check if the other device already submitted data before we joined
        // (e.g., iPhone finished grip before iPad entered the code)
        if (deviceRole === 'writing' && found.gripCompletedAt) {
          setIsPaired(true);
        }

        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to join session';
        setError(msg);
        console.error('[useSession] joinSession error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [subscribeToSession, deviceRole]
  );

  const updateStatus = useCallback(
    async (status: SessionStatus): Promise<void> => {
      if (!session) return;
      try {
        await svcUpdateSessionStatus(session.id, status);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update status';
        setError(msg);
        console.error('[useSession] updateStatus error:', err);
      }
    },
    [session]
  );

  const submitGripResult = useCallback(
    async (result: GripResult): Promise<void> => {
      if (!session) return;
      setError(null);
      try {
        await svcUpdateGripResult(session.id, result);
        // Don't set isPaired here — that's only for the OTHER device
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit grip result';
        setError(msg);
        console.error('[useSession] submitGripResult error:', err);
      }
    },
    [session]
  );

  const submitPressureResult = useCallback(
    async (result: PressureResult): Promise<void> => {
      if (!session) return;
      setError(null);
      try {
        await svcUpdatePressureResult(session.id, result);
        // Don't set isPaired here — that's only for the OTHER device
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit pressure result';
        setError(msg);
        console.error('[useSession] submitPressureResult error:', err);
      }
    },
    [session]
  );

  const submitHandwritingResult = useCallback(
    async (result: HandwritingResult): Promise<void> => {
      if (!session) return;
      setError(null);
      try {
        await svcUpdateHandwritingResult(session.id, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit handwriting result';
        setError(msg);
        console.error('[useSession] submitHandwritingResult error:', err);
      }
    },
    [session]
  );

  return {
    session,
    isLoading,
    error,
    isPaired,
    createSession,
    joinSession,
    updateStatus,
    submitGripResult,
    submitPressureResult,
    submitHandwritingResult,
  };
}
