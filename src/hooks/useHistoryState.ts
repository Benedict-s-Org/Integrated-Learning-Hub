// History state hook for undo/redo functionality
import { useState, useCallback, useRef, useEffect } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryStateOptions {
  maxHistory?: number;
}

export function useHistoryState<T>(
  initialState: T,
  options: UseHistoryStateOptions = {}
) {
  const { maxHistory = 50 } = options;
  
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Track if we should skip adding to history (for internal updates)
  const skipHistoryRef = useRef(false);

  // Update the present state and push to history
  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setState(current => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(current.present)
        : newState;

      // Don't add to history if value is the same
      if (JSON.stringify(nextState) === JSON.stringify(current.present)) {
        return current;
      }

      // Skip adding to history if flagged
      if (skipHistoryRef.current) {
        skipHistoryRef.current = false;
        return {
          ...current,
          present: nextState,
        };
      }

      // Limit history size
      const newPast = [...current.past, current.present].slice(-maxHistory);

      return {
        past: newPast,
        present: nextState,
        future: [], // Clear future on new change
      };
    });
  }, [maxHistory]);

  // Undo - go back one step
  const undo = useCallback(() => {
    setState(current => {
      if (current.past.length === 0) return current;

      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  // Redo - go forward one step
  const redo = useCallback(() => {
    setState(current => {
      if (current.future.length === 0) return current;

      const next = current.future[0];
      const newFuture = current.future.slice(1);

      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Reset to initial state
  const reset = useCallback((newInitial?: T) => {
    setState({
      past: [],
      present: newInitial ?? initialState,
      future: [],
    });
  }, [initialState]);

  // Clear history but keep current state
  const clearHistory = useCallback(() => {
    setState(current => ({
      past: [],
      present: current.present,
      future: [],
    }));
  }, []);

  // Check capabilities
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const historyLength = state.past.length + state.future.length;

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    clearHistory,
    canUndo,
    canRedo,
    historyLength,
    pastLength: state.past.length,
    futureLength: state.future.length,
  };
}

export default useHistoryState;
