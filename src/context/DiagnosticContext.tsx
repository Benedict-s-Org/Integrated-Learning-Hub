import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { DiagnosticCheck, ErrorDetails } from '../utils/diagnosticUtils';

export type PageType =
  | 'new'
  | 'saved'
  | 'admin'
  | 'database'
  | 'proofreading-input'
  | 'proofreading-answerSetting'
  | 'proofreading-preview'
  | 'proofreading-practice'
  | 'proofreading-saved'
  | 'proofreading-assignment'
  | 'spelling-input'
  | 'spelling-preview'
  | 'spelling-practice'
  | 'spelling-saved'
  | 'progress'
  | 'assignments'
  | 'assignmentManagement'
  | 'proofreadingAssignments'
  | 'memorization-assignment'
  | 'practice'
  | 'assignedPractice';

interface DiagnosticContextType {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  checks: DiagnosticCheck[];
  setChecks: (checks: DiagnosticCheck[]) => void;
  errorDetails: ErrorDetails | null;
  setErrorDetails: (error: ErrorDetails | null) => void;
  isRunningChecks: boolean;
  setIsRunningChecks: (running: boolean) => void;
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  runChecks: () => Promise<void>;
  registerCheckRunner: (runner: () => Promise<DiagnosticCheck[]>) => void;
  captureError: (error: unknown, context: string, payload?: Record<string, unknown>) => void;
}

const DiagnosticContext = createContext<DiagnosticContextType | null>(null);

const STORAGE_KEY = 'diagnostic_mode_enabled';

export const DiagnosticProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isEnabled, setIsEnabledState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'true';
  });
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType>('new');
  const [checkRunner, setCheckRunner] = useState<(() => Promise<DiagnosticCheck[]>) | null>(null);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const registerCheckRunner = useCallback((runner: () => Promise<DiagnosticCheck[]>) => {
    setCheckRunner(() => runner);
  }, []);

  const runChecks = useCallback(async () => {
    if (!checkRunner || !isEnabled) return;

    setIsRunningChecks(true);
    try {
      const results = await checkRunner();
      setChecks(results);
    } catch (err) {
      console.error('Error running diagnostic checks:', err);
    } finally {
      setIsRunningChecks(false);
    }
  }, [checkRunner, isEnabled]);

  useEffect(() => {
    if (isEnabled && checkRunner) {
      runChecks();
    }
  }, [currentPage, isEnabled]);

  const captureError = useCallback((error: unknown, context: string, payload?: Record<string, unknown>) => {
    const { translateError } = require('../utils/diagnosticUtils');
    const details = translateError(error, context, payload);
    setErrorDetails(details);
    if (isEnabled) {
      runChecks();
    }
  }, [isEnabled, runChecks]);

  return (
    <DiagnosticContext.Provider
      value={{
        isEnabled,
        setEnabled,
        checks,
        setChecks,
        errorDetails,
        setErrorDetails,
        isRunningChecks,
        setIsRunningChecks,
        currentPage,
        setCurrentPage,
        runChecks,
        registerCheckRunner,
        captureError,
      }}
    >
      {children}
    </DiagnosticContext.Provider>
  );
};

export const useDiagnostics = () => {
  const context = useContext(DiagnosticContext);
  if (!context) {
    throw new Error('useDiagnostics must be used within a DiagnosticProvider');
  }
  return context;
};
