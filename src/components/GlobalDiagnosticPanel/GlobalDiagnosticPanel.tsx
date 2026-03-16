import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bug, X, ChevronRight, CheckCircle, XCircle, AlertCircle, Loader2, Copy, Check, RefreshCw, Settings, RotateCcw, MapPin, Palette, Save, Undo, MousePointer2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboardTheme } from '../../context/DashboardThemeContext';
import { DiagnosticCheck, ErrorDetails, formatErrorForCopy, runPageChecks } from '../../utils/diagnosticUtils';

interface ButtonPosition {
  x: number;
  y: number;
}

interface GlobalDiagnosticPanelProps {
  currentPage: string;
}

const STORAGE_KEY = 'diagnostic_mode_enabled';
const POSITION_STORAGE_KEY = 'diagnostic_button_position';
const DRAG_THRESHOLD = 5;
const BUTTON_SIZE = { width: 72, height: 44 };

const getDefaultPosition = (): ButtonPosition => ({
  x: window.innerWidth - BUTTON_SIZE.width,
  y: Math.round(window.innerHeight / 2 - BUTTON_SIZE.height / 2)
});

const loadSavedPosition = (): ButtonPosition => {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (saved) {
      const pos = JSON.parse(saved);
      return {
        x: Math.min(Math.max(0, pos.x), window.innerWidth - BUTTON_SIZE.width),
        y: Math.min(Math.max(0, pos.y), window.innerHeight - BUTTON_SIZE.height)
      };
    }
  } catch { }
  return getDefaultPosition();
};

const PAGE_DISPLAY_NAMES: Record<string, string> = {
  'new': 'Memorization - Input',
  'saved': 'Saved Content',
  'admin': 'Admin Panel',
  'database': 'Content Database',
  'proofreading-input': 'Proofreading - Input',
  'proofreading-answerSetting': 'Proofreading - Answers',
  'proofreading-preview': 'Proofreading - Preview',
  'proofreading-practice': 'Proofreading - Practice',
  'proofreading-saved': 'Proofreading - Saved',
  'proofreading-assignment': 'Proofreading - Assignment',
  'spelling-input': 'Spelling - Input',
  'spelling-preview': 'Spelling - Preview',
  'spelling-practice': 'Spelling - Practice',
  'spelling-saved': 'Spelling - Saved',
  'progress': 'Progress',
  'progress-admin': 'Analytics',
  'assignments': 'Assignments',
  'assignmentManagement': 'Assignment Management',
  'proofreadingAssignments': 'Proofreading Assignments',
  'memorization-assignment': 'Memorization Assignment',
  'practice': 'Practice Mode',
  'assignedPractice': 'Assigned Practice',
  'publicPractice': 'Public Practice',
  'quickReward': 'Quick Reward Scanner',
};

export const GlobalDiagnosticPanel: React.FC<GlobalDiagnosticPanelProps> = ({ currentPage }) => {
  const { user, isAdmin } = useAuth();
  const { theme, updateTheme, saveTheme, resetTheme } = useDashboardTheme();

  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'true';
  });
  const [isOpen, setIsOpen] = useState(false);
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<ButtonPosition>(loadSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; buttonX: number; buttonY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const lastPageRef = useRef(currentPage);

  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      await saveTheme();
      alert('Theme saved successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save theme: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingTheme(false);
    }
  };

  useEffect(() => {
    if (!isInspectorMode) {
      setHoveredKey(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const themeKey = target.closest('[data-theme-key]')?.getAttribute('data-theme-key');
      setHoveredKey(themeKey || null);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const themeElement = target.closest('[data-theme-key]') as HTMLElement;
      const themeKey = themeElement?.getAttribute('data-theme-key');

      if (themeKey) {
        e.preventDefault();
        e.stopPropagation();

        const currentVal = (theme as any)[themeKey] || theme.fontSize;
        const newVal = window.prompt(`Enter new font size for ${themeKey.replace('FontSize', '')}:`, String(currentVal));
        
        if (newVal !== null) {
          const fontSize = parseInt(newVal);
          if (!isNaN(fontSize)) {
            updateTheme({ [themeKey]: fontSize });
          }
        }
        setIsInspectorMode(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick, true);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick, true);
    };
  }, [isInspectorMode, theme, updateTheme]);

  useEffect(() => {
    const handleResize = () => {
      setButtonPosition(prev => ({
        x: window.innerWidth - BUTTON_SIZE.width,
        y: Math.min(prev.y, window.innerHeight - BUTTON_SIZE.height)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const constrainPosition = useCallback((_x: number, y: number): ButtonPosition => ({
    x: window.innerWidth - BUTTON_SIZE.width,
    y: Math.min(Math.max(0, y), window.innerHeight - BUTTON_SIZE.height)
  }), []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      buttonX: buttonPosition.x,
      buttonY: buttonPosition.y
    };
    hasDraggedRef.current = false;
    setIsDragging(true);
  }, [buttonPosition]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      hasDraggedRef.current = true;
    }
    const newPos = constrainPosition(
      dragStartRef.current.buttonX + deltaX,
      dragStartRef.current.buttonY + deltaY
    );
    setButtonPosition(newPos);
  }, [constrainPosition]);

  const handleDragEnd = useCallback(() => {
    if (dragStartRef.current) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(buttonPosition));
    }
    dragStartRef.current = null;
    setIsDragging(false);
  }, [buttonPosition]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientX, e.clientY);
    };
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => handleDragEnd();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const runChecks = useCallback(async () => {
    if (!isEnabled) return;

    setIsRunningChecks(true);
    setChecks(prev => prev.map(c => ({ ...c, status: 'running' as const })));

    try {
      const results = await runPageChecks(currentPage, user?.id);
      setChecks(results);
    } catch (err) {
      console.error('Error running diagnostic checks:', err);
    } finally {
      setIsRunningChecks(false);
    }
  }, [isEnabled, currentPage, user?.id]);

  useEffect(() => {
    if (isEnabled && currentPage !== lastPageRef.current) {
      lastPageRef.current = currentPage;
      setErrorDetails(null);
      runChecks();
    }
  }, [currentPage, isEnabled, runChecks]);

  useEffect(() => {
    if (isEnabled) {
      runChecks();
    }
  }, [isEnabled]);

  const handleButtonClick = () => {
    if (!hasDraggedRef.current) {
      setIsOpen(true);
    }
  };

  const handleResetPosition = () => {
    const defaultPos = getDefaultPosition();
    setButtonPosition(defaultPos);
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(defaultPos));
  };

  const handleToggleEnabled = (enabled: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    setIsEnabled(enabled);
    if (enabled) {
      runChecks();
    }
  };

  const handleCopyError = async () => {
    if (!errorDetails) return;
    const text = formatErrorForCopy(errorDetails);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'failed':
        return <XCircle size={18} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={18} className="text-yellow-500" />;
      case 'running':
        return <Loader2 size={18} className="text-blue-500 animate-spin" />;
      default:
        return <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusColor = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'running':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isAdmin) {
    return null;
  }

  const hasFailures = checks.some(c => c.status === 'failed');
  const hasWarnings = checks.some(c => c.status === 'warning');
  const pageDisplayName = PAGE_DISPLAY_NAMES[currentPage] || currentPage;

  if (!isOpen) {
    return (
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          handleDragStart(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onClick={handleButtonClick}
        className={`fixed z-[10000] flex items-center gap-2 px-3 py-3 rounded-l-lg rounded-r-none border-r-0 shadow-lg select-none ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'
          } ${errorDetails
            ? 'bg-red-600 text-white'
            : hasFailures
              ? 'bg-red-500 text-white'
              : hasWarnings
                ? 'bg-yellow-500 text-white'
                : isEnabled
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-white'
          }`}
        style={{
          left: buttonPosition.x,
          top: buttonPosition.y,
          touchAction: 'none',
          transition: isDragging ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease'
        }}
        title="Drag to move, click to open Diagnostic Panel"
      >
        <Bug size={20} />
        <ChevronRight size={16} className="rotate-180" />
        {isEnabled && (
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        )}
        {errorDetails && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full z-50 flex">
      <div
        className="w-[380px] h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col overflow-hidden"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Bug size={20} className="text-gray-700" />
            <h2 className="font-semibold text-gray-800">Diagnostics</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleResetPosition}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Reset button position"
            >
              <RotateCcw size={18} className="text-gray-500" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-blue-600" />
              <span className="text-gray-600">Current Page:</span>
              <span className="font-medium text-blue-700">{pageDisplayName}</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Error Detection Mode</span>
              </div>
              <button
                onClick={() => handleToggleEnabled(!isEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
            {!isEnabled && (
              <p className="text-xs text-gray-500 mt-2">
                Enable to run pre-flight checks and capture detailed errors
              </p>
            )}
          </div>

          {isEnabled && (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Pre-Flight Checks</h3>
                  <button
                    onClick={runChecks}
                    disabled={isRunningChecks}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isRunningChecks ? 'animate-spin' : ''} />
                    {isRunningChecks ? 'Running...' : 'Run Checks'}
                  </button>
                </div>

                <div className="space-y-2">
                  {checks.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Click "Run Checks" to diagnose this page
                    </div>
                  ) : (
                    checks.map((check) => (
                      <div
                        key={check.id}
                        className={`p-2 rounded border ${getStatusColor(check.status)}`}
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(check.status)}
                          <span className="text-sm font-medium text-gray-800">{check.name}</span>
                        </div>
                        {check.message && (
                          <p className="text-xs text-gray-600 mt-1 ml-7">{check.message}</p>
                        )}
                        {check.details && (
                          <p className="text-xs text-gray-500 mt-0.5 ml-7 font-mono">{check.details}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {errorDetails && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-red-700">Last Error</h3>
                    <button
                      onClick={handleCopyError}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check size={12} className="text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Details</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-semibold text-red-800 uppercase mb-1">What Went Wrong</p>
                      <p className="text-sm text-red-700">{errorDetails.errorMessage}</p>
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Error Code</p>
                      <p className="text-sm font-mono text-gray-800">{errorDetails.errorCode}</p>
                      {errorDetails.errorHint && (
                        <p className="text-xs text-gray-600 mt-1">{errorDetails.errorHint}</p>
                      )}
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs font-semibold text-blue-800 uppercase mb-1">How to Fix</p>
                      <p className="text-sm text-blue-700">{errorDetails.suggestedFix}</p>
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Context</p>
                      <p className="text-xs text-gray-700">{errorDetails.context}</p>
                      <p className="text-xs text-gray-500 mt-1">{errorDetails.timestamp}</p>
                    </div>

                    {errorDetails.payload && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Request Data</p>
                        <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
                          {JSON.stringify(errorDetails.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!errorDetails && !isRunningChecks && checks.length > 0 && checks.every(c => c.status === 'passed') && (
                <div className="p-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-700">All checks passed</p>
                    <p className="text-xs text-green-600 mt-1">System is ready</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Component Editor */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setIsThemeExpanded(!isThemeExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-700">Component Editor</h3>
              </div>
              <ChevronRight size={16} className={`text-gray-400 transition-transform ${isThemeExpanded ? 'rotate-90' : ''}`} />
            </button>

            {isThemeExpanded && (
              <div className="mt-4 space-y-6">
                {/* Inspector Mode Toggle */}
                <button
                  onClick={() => setIsInspectorMode(!isInspectorMode)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                    isInspectorMode 
                      ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20' 
                      : 'bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <MousePointer2 size={16} className={isInspectorMode ? 'animate-bounce' : ''} />
                  {isInspectorMode ? 'Click to Select Component' : 'Pick Font Size (Inspector)'}
                </button>

                {isInspectorMode && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg animate-pulse">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">
                      Hover and click a dashboard component to change its font size
                    </p>
                  </div>
                )}
                {/* Typography Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Typography</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Font Family</label>
                      <select 
                        value={theme.fontFamily}
                        onChange={(e) => updateTheme({ fontFamily: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs text-gray-700 font-medium border border-gray-200 rounded bg-white"
                      >
                        <option value="Outfit">Outfit (Default)</option>
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="'Open Sans'">Open Sans</option>
                        <option value="system-ui">System Default</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Base Font Size ({theme.fontSize}px)</label>
                      <input 
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        value={theme.fontSize}
                        onChange={(e) => updateTheme({ fontSize: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Broadcast Bar Section */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Broadcast Bar</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Background</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.broadcastBg.startsWith('rgba') ? '#ffffff' : theme.broadcastBg}
                          onChange={(e) => updateTheme({ broadcastBg: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.broadcastBg}
                          onChange={(e) => updateTheme({ broadcastBg: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.broadcastText}
                          onChange={(e) => updateTheme({ broadcastText: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.broadcastText}
                          onChange={(e) => updateTheme({ broadcastText: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Student Cards</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Background</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.cardBg}
                          onChange={(e) => updateTheme({ cardBg: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.cardBg}
                          onChange={(e) => updateTheme({ cardBg: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.cardText}
                          onChange={(e) => updateTheme({ cardText: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.cardText}
                          onChange={(e) => updateTheme({ cardText: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Coin Bg</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.coinBg}
                          onChange={(e) => updateTheme({ coinBg: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.coinBg}
                          onChange={(e) => updateTheme({ coinBg: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Coin Text</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.coinText}
                          onChange={(e) => updateTheme({ coinText: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.coinText}
                          onChange={(e) => updateTheme({ coinText: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Coin Border</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.coinBorder}
                          onChange={(e) => updateTheme({ coinBorder: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.coinBorder}
                          onChange={(e) => updateTheme({ coinBorder: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">+Daily Bg</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.dailyEarnedBg}
                          onChange={(e) => updateTheme({ dailyEarnedBg: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.dailyEarnedBg}
                          onChange={(e) => updateTheme({ dailyEarnedBg: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">+Daily Text</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.dailyEarnedText}
                          onChange={(e) => updateTheme({ dailyEarnedText: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.dailyEarnedText}
                          onChange={(e) => updateTheme({ dailyEarnedText: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">+Daily Border</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.dailyEarnedBorder}
                          onChange={(e) => updateTheme({ dailyEarnedBorder: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.dailyEarnedBorder}
                          onChange={(e) => updateTheme({ dailyEarnedBorder: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Number Tag Bg</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.numberTagBg}
                          onChange={(e) => updateTheme({ numberTagBg: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.numberTagBg}
                          onChange={(e) => updateTheme({ numberTagBg: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Number Tag Text</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={theme.numberTagText}
                          onChange={(e) => updateTheme({ numberTagText: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={theme.numberTagText}
                          onChange={(e) => updateTheme({ numberTagText: e.target.value })}
                          className="w-20 px-1 py-0.5 text-xs text-gray-500 font-mono border border-gray-200 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={resetTheme}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Undo size={14} />
                    Reset
                  </button>
                  <button
                    onClick={handleSaveTheme}
                    disabled={isSavingTheme}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50"
                  >
                    {isSavingTheme ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save to DB
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Inspector Highlight Overlay */}
      {isInspectorMode && hoveredKey && (
        <style>
          {`
            [data-theme-key="${hoveredKey}"] {
              outline: 3px solid #9333ea !important;
              outline-offset: 4px !important;
              background-color: rgba(147, 51, 234, 0.1) !important;
              cursor: crosshair !important;
              transition: all 0.2s ease !important;
            }
          `}
        </style>
      )}
    </div>
  );
};

export default GlobalDiagnosticPanel;
