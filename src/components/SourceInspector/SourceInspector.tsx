import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Pin, X, Database, Zap, MousePointer, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { getComponentDebugInfo, ComponentDebugInfo } from './componentRegistry';

interface SourceInfo {
  component: string;
  file: string;
  x: number;
  y: number;
  debugInfo: ComponentDebugInfo | null;
  elementStatus: ElementStatus | null;
}

interface ElementStatus {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
  dataLoaded: boolean;
}

interface ButtonPosition {
  x: number;
  y: number;
}

const POSITION_STORAGE_KEY = 'inspector_button_position';
const DRAG_THRESHOLD = 5;
const BUTTON_SIZE = { width: 44, height: 40 };

const getDefaultPosition = (): ButtonPosition => ({
  x: window.innerWidth - BUTTON_SIZE.width - 16,
  y: 16
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
  } catch {}
  return getDefaultPosition();
};

const SourceInspector: React.FC = () => {
  const [isDetectionMode, setIsDetectionMode] = useState(() => {
    const saved = localStorage.getItem('detectionMode');
    return saved === 'true';
  });
  const [hoveredSource, setHoveredSource] = useState<SourceInfo | null>(null);
  const [pinnedSource, setPinnedSource] = useState<SourceInfo | null>(null);
  const [buttonPosition, setButtonPosition] = useState<ButtonPosition>(loadSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; buttonX: number; buttonY: number } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setButtonPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - BUTTON_SIZE.width),
        y: Math.min(prev.y, window.innerHeight - BUTTON_SIZE.height)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const constrainPosition = useCallback((x: number, y: number): ButtonPosition => ({
    x: Math.min(Math.max(0, x), window.innerWidth - BUTTON_SIZE.width),
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

  const handleButtonClick = () => {
    if (!hasDraggedRef.current) {
      const newValue = !isDetectionMode;
      setIsDetectionMode(newValue);
      localStorage.setItem('detectionMode', String(newValue));
    }
  };

  const toggleDetectionMode = () => {
    const newValue = !isDetectionMode;
    setIsDetectionMode(newValue);
    localStorage.setItem('detectionMode', String(newValue));
  };

  const detectElementStatus = (element: HTMLElement): ElementStatus => {
    const container = element.closest('[data-source-tsx]') || element;
    const hasLoadingText = container.textContent?.toLowerCase().includes('loading');
    const hasErrorText = container.textContent?.toLowerCase().includes('error') ||
                         container.textContent?.toLowerCase().includes('failed');
    const errorElement = container.querySelector('.text-red-600, .text-red-700, .bg-red-50');
    const errorMessage = errorElement?.textContent || null;

    return {
      isLoading: hasLoadingText || false,
      hasError: hasErrorText || !!errorElement,
      errorMessage: errorMessage,
      dataLoaded: !hasLoadingText,
    };
  };

  useEffect(() => {
    if (!isDetectionMode) {
      setHoveredSource(null);
      setPinnedSource(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (pinnedSource) return;

      const target = e.target as HTMLElement;
      const sourceElement = target.closest('[data-source-tsx]') as HTMLElement;

      if (sourceElement) {
        const sourceData = sourceElement.getAttribute('data-source-tsx');
        if (sourceData) {
          const [component, file] = sourceData.split('|');
          const debugInfo = getComponentDebugInfo(component);
          const elementStatus = detectElementStatus(sourceElement);

          setHoveredSource({
            component: component || 'Unknown Component',
            file: file || 'Unknown File',
            x: e.clientX,
            y: e.clientY,
            debugInfo,
            elementStatus,
          });
        }
      } else {
        setHoveredSource(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!hoveredSource) return;

      e.preventDefault();
      e.stopPropagation();

      setPinnedSource({
        ...hoveredSource,
        x: e.clientX,
        y: e.clientY,
      });
      setHoveredSource(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isDetectionMode, hoveredSource, pinnedSource]);

  const currentSource = pinnedSource || hoveredSource;

  const renderDebugInfo = (info: ComponentDebugInfo) => {
    return (
      <div className="mt-3 pt-3 border-t border-gray-600 space-y-3">
        {info.description && (
          <div className="text-xs text-gray-300 italic mb-2">
            {info.description}
          </div>
        )}

        {info.tables && (info.tables.reads?.length || info.tables.writes?.length) && (
          <div>
            <div className="flex items-center space-x-1 text-teal-400 text-xs font-semibold mb-1">
              <Database size={12} />
              <span>DATABASE TABLES</span>
            </div>
            {info.tables.reads && info.tables.reads.length > 0 && (
              <div className="ml-4 text-xs">
                <span className="text-gray-400">Reads:</span>
                <span className="ml-1 text-teal-300">{info.tables.reads.join(', ')}</span>
              </div>
            )}
            {info.tables.writes && info.tables.writes.length > 0 && (
              <div className="ml-4 text-xs">
                <span className="text-gray-400">Writes:</span>
                <span className="ml-1 text-yellow-300">{info.tables.writes.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {info.rpcFunctions && info.rpcFunctions.length > 0 && (
          <div>
            <div className="flex items-center space-x-1 text-blue-400 text-xs font-semibold mb-1">
              <Zap size={12} />
              <span>DATABASE FUNCTIONS</span>
            </div>
            <div className="ml-4 text-xs text-blue-300">
              {info.rpcFunctions.map((fn, i) => (
                <div key={i} className="flex items-center space-x-1">
                  <span className="text-gray-500">•</span>
                  <span>{fn}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {info.edgeFunctions && info.edgeFunctions.length > 0 && (
          <div>
            <div className="flex items-center space-x-1 text-purple-400 text-xs font-semibold mb-1">
              <FileText size={12} />
              <span>EDGE FUNCTIONS (API)</span>
            </div>
            <div className="ml-4 text-xs text-purple-300">
              {info.edgeFunctions.map((fn, i) => (
                <div key={i} className="flex items-center space-x-1">
                  <span className="text-gray-500">•</span>
                  <span>/functions/v1/{fn}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {info.actions && info.actions.length > 0 && (
          <div>
            <div className="flex items-center space-x-1 text-green-400 text-xs font-semibold mb-1">
              <MousePointer size={12} />
              <span>AVAILABLE ACTIONS</span>
            </div>
            <div className="ml-4 text-xs text-green-300">
              {info.actions.map((action, i) => (
                <div key={i} className="flex items-center space-x-1">
                  <span className="text-gray-500">•</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStatus = (status: ElementStatus) => {
    return (
      <div className="mt-3 pt-3 border-t border-gray-600">
        <div className="text-xs font-semibold mb-2 text-gray-300">CURRENT STATUS</div>
        <div className="space-y-1">
          {status.isLoading && (
            <div className="flex items-center space-x-2 text-yellow-400 text-xs">
              <Loader size={12} className="animate-spin" />
              <span>Loading data...</span>
            </div>
          )}
          {status.hasError && (
            <div className="flex items-center space-x-2 text-red-400 text-xs">
              <AlertCircle size={12} />
              <span>Error detected</span>
            </div>
          )}
          {status.errorMessage && (
            <div className="ml-4 text-xs text-red-300 bg-red-900/30 px-2 py-1 rounded">
              {status.errorMessage.slice(0, 100)}
            </div>
          )}
          {!status.isLoading && !status.hasError && (
            <div className="flex items-center space-x-2 text-green-400 text-xs">
              <CheckCircle size={12} />
              <span>Ready</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
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
        className={`fixed z-[9999] flex items-center space-x-2 px-3 py-2 rounded-lg font-medium shadow-lg select-none ${
          isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'
        } ${
          isDetectionMode
            ? 'bg-orange-600 text-white'
            : 'bg-gray-700 text-white opacity-70 hover:opacity-100'
        }`}
        style={{
          left: buttonPosition.x,
          top: buttonPosition.y,
          touchAction: 'none',
          fontFamily: 'Times New Roman, serif',
          transition: isDragging ? 'none' : 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease'
        }}
        title={isDetectionMode ? 'Drag to move, click to exit Detection Mode' : 'Drag to move, click to enter Detection Mode'}
      >
        {isDetectionMode ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>

      {currentSource && (
        <div
          className="fixed z-[9998] bg-gray-900 bg-opacity-95 text-white p-4 rounded-lg shadow-xl max-w-md pointer-events-none"
          style={{
            left: Math.min(currentSource.x + 10, window.innerWidth - 420),
            top: Math.max(currentSource.y - 80, 10),
            fontFamily: 'Times New Roman, serif',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-sm text-orange-400">Debug Inspector</h3>
            {pinnedSource && (
              <button
                onClick={() => setPinnedSource(null)}
                className="text-gray-400 hover:text-white pointer-events-auto"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div>
              <span className="text-gray-400">Component:</span>
              <span className="ml-2 text-blue-300 font-medium">{currentSource.component}</span>
            </div>
            <div>
              <span className="text-gray-400">File:</span>
              <span className="ml-2 text-green-300 text-[10px]">{currentSource.file}</span>
            </div>
          </div>

          {currentSource.elementStatus && renderStatus(currentSource.elementStatus)}

          {currentSource.debugInfo && renderDebugInfo(currentSource.debugInfo)}

          {!currentSource.debugInfo && (
            <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-400 italic">
              No additional debug info registered for this component.
            </div>
          )}

          {pinnedSource && (
            <div className="flex items-center mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400">
              <Pin size={12} className="mr-1" />
              <span>Pinned - Click X to unpin</span>
            </div>
          )}
        </div>
      )}

      {isDetectionMode && (
        <div className="fixed inset-0 z-[9997] pointer-events-none">
          <div className="absolute top-20 left-4 bg-orange-600 text-white px-3 py-2 rounded-lg text-sm shadow-lg max-w-xs">
            <div className="font-bold mb-1">Debug Mode Active</div>
            <div className="text-xs space-y-1">
              <div>• Hover over components to see debug info</div>
              <div>• Click to pin the info window</div>
              <div>• View database tables, functions, and status</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SourceInspector;
