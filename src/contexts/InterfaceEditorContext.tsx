import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { UIElement, UIElementType } from '@/types/ui-builder';

// Drag item representing an element being dragged
export interface DragItem {
  type: UIElementType;
  sourceId?: string; // If moving an existing element
  isNew: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

// Alignment guide for snapping
export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
  targetId?: string;
}

// Element rectangle for alignment calculations
export interface ElementRect {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

// History entry for undo/redo
interface HistoryEntry {
  pageElements: Record<string, UIElement[]>;
  timestamp: number;
}

interface InterfaceEditorState {
  isEditing: boolean;
  selectedElementId: string | null;
  multiSelectedIds: Set<string>;
  draggingElement: DragItem | null;
  alignmentGuides: AlignmentGuide[];
  pageElements: Record<string, UIElement[]>;
  activeDropZone: string | null;
}

interface InterfaceEditorContextType extends InterfaceEditorState {
  // Mode controls
  enterEditMode: () => void;
  exitEditMode: () => void;
  
  // Selection
  selectElement: (id: string | null, shiftKey?: boolean) => void;
  clearSelection: () => void;
  
  // Drag & Drop
  startDrag: (type: UIElementType, isNew: boolean, sourceId?: string) => void;
  updateDragPosition: (x: number, y: number) => void;
  endDrag: (dropZoneId: string, position: { x: number; y: number }) => void;
  cancelDrag: () => void;
  setActiveDropZone: (zoneId: string | null) => void;
  
  // Alignment
  updateAlignmentGuides: (guides: AlignmentGuide[]) => void;
  registerElement: (id: string, rect: ElementRect) => void;
  unregisterElement: (id: string) => void;
  getRegisteredElements: () => ElementRect[];
  
  // Element operations
  addElement: (zoneId: string, element: UIElement) => void;
  updateElement: (zoneId: string, elementId: string, updates: Partial<UIElement>) => void;
  deleteElement: (zoneId: string, elementId: string) => void;
  moveElement: (fromZone: string, toZone: string, elementId: string, newOrder: number) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // Persistence
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  hasUnsavedChanges: boolean;
}

const InterfaceEditorContext = createContext<InterfaceEditorContextType | undefined>(undefined);

const MAX_HISTORY = 50;

export function InterfaceEditorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InterfaceEditorState>({
    isEditing: false,
    selectedElementId: null,
    multiSelectedIds: new Set(),
    draggingElement: null,
    alignmentGuides: [],
    pageElements: {},
    activeDropZone: null,
  });

  const elementRegistry = useRef<Map<string, ElementRect>>(new Map());
  const historyStack = useRef<HistoryEntry[]>([]);
  const historyIndex = useRef(-1);
  const originalState = useRef<Record<string, UIElement[]>>({});

  // Mode controls
  const enterEditMode = useCallback(() => {
    originalState.current = { ...state.pageElements };
    historyStack.current = [{ pageElements: { ...state.pageElements }, timestamp: Date.now() }];
    historyIndex.current = 0;
    setState(s => ({ ...s, isEditing: true }));
  }, [state.pageElements]);

  const exitEditMode = useCallback(() => {
    setState(s => ({
      ...s,
      isEditing: false,
      selectedElementId: null,
      multiSelectedIds: new Set(),
      draggingElement: null,
      alignmentGuides: [],
      activeDropZone: null,
    }));
  }, []);

  // Selection
  const selectElement = useCallback((id: string | null, shiftKey = false) => {
    setState(s => {
      if (shiftKey && id) {
        const newSet = new Set(s.multiSelectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { ...s, multiSelectedIds: newSet, selectedElementId: id };
      }
      return { ...s, selectedElementId: id, multiSelectedIds: new Set(id ? [id] : []) };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState(s => ({ ...s, selectedElementId: null, multiSelectedIds: new Set() }));
  }, []);

  // Drag & Drop
  const startDrag = useCallback((type: UIElementType, isNew: boolean, sourceId?: string) => {
    setState(s => ({
      ...s,
      draggingElement: {
        type,
        isNew,
        sourceId,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 40 },
      },
    }));
  }, []);

  const updateDragPosition = useCallback((x: number, y: number) => {
    setState(s => {
      if (!s.draggingElement) return s;
      return {
        ...s,
        draggingElement: { ...s.draggingElement, position: { x, y } },
      };
    });
  }, []);

  const endDrag = useCallback((dropZoneId: string, position: { x: number; y: number }) => {
    setState(s => {
      if (!s.draggingElement) return s;

      const newElement: UIElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: s.draggingElement.type,
        order: Object.keys(s.pageElements[dropZoneId] || []).length,
        props: getDefaultProps(s.draggingElement.type),
      };

      const zoneElements = s.pageElements[dropZoneId] || [];
      const updatedElements = [...zoneElements, newElement];

      const newPageElements = {
        ...s.pageElements,
        [dropZoneId]: updatedElements,
      };

      // Add to history
      pushHistory(newPageElements);

      return {
        ...s,
        pageElements: newPageElements,
        draggingElement: null,
        alignmentGuides: [],
        selectedElementId: newElement.id,
      };
    });
  }, []);

  const cancelDrag = useCallback(() => {
    setState(s => ({ ...s, draggingElement: null, alignmentGuides: [] }));
  }, []);

  const setActiveDropZone = useCallback((zoneId: string | null) => {
    setState(s => ({ ...s, activeDropZone: zoneId }));
  }, []);

  // Alignment
  const updateAlignmentGuides = useCallback((guides: AlignmentGuide[]) => {
    setState(s => ({ ...s, alignmentGuides: guides }));
  }, []);

  const registerElement = useCallback((id: string, rect: ElementRect) => {
    elementRegistry.current.set(id, rect);
  }, []);

  const unregisterElement = useCallback((id: string) => {
    elementRegistry.current.delete(id);
  }, []);

  const getRegisteredElements = useCallback(() => {
    return Array.from(elementRegistry.current.values());
  }, []);

  // Element operations
  const pushHistory = (newPageElements: Record<string, UIElement[]>) => {
    // Truncate any redo history
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1);
    historyStack.current.push({ pageElements: newPageElements, timestamp: Date.now() });
    if (historyStack.current.length > MAX_HISTORY) {
      historyStack.current.shift();
    } else {
      historyIndex.current++;
    }
  };

  const addElement = useCallback((zoneId: string, element: UIElement) => {
    setState(s => {
      const zoneElements = s.pageElements[zoneId] || [];
      const newPageElements = {
        ...s.pageElements,
        [zoneId]: [...zoneElements, element],
      };
      pushHistory(newPageElements);
      return { ...s, pageElements: newPageElements };
    });
  }, []);

  const updateElement = useCallback((zoneId: string, elementId: string, updates: Partial<UIElement>) => {
    setState(s => {
      const zoneElements = s.pageElements[zoneId] || [];
      const newElements = zoneElements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      );
      const newPageElements = { ...s.pageElements, [zoneId]: newElements };
      pushHistory(newPageElements);
      return { ...s, pageElements: newPageElements };
    });
  }, []);

  const deleteElement = useCallback((zoneId: string, elementId: string) => {
    setState(s => {
      const zoneElements = s.pageElements[zoneId] || [];
      const newElements = zoneElements.filter(el => el.id !== elementId);
      const newPageElements = { ...s.pageElements, [zoneId]: newElements };
      pushHistory(newPageElements);
      return { ...s, pageElements: newPageElements, selectedElementId: null };
    });
  }, []);

  const moveElement = useCallback((fromZone: string, toZone: string, elementId: string, newOrder: number) => {
    setState(s => {
      const fromElements = s.pageElements[fromZone] || [];
      const element = fromElements.find(el => el.id === elementId);
      if (!element) return s;

      const newFromElements = fromElements.filter(el => el.id !== elementId);
      const toElements = fromZone === toZone ? newFromElements : (s.pageElements[toZone] || []);
      const updatedElement = { ...element, order: newOrder };
      const newToElements = [...toElements, updatedElement].sort((a, b) => a.order - b.order);

      const newPageElements = {
        ...s.pageElements,
        [fromZone]: newFromElements,
        [toZone]: newToElements,
      };
      pushHistory(newPageElements);
      return { ...s, pageElements: newPageElements };
    });
  }, []);

  // History
  const undo = useCallback(() => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      const entry = historyStack.current[historyIndex.current];
      setState(s => ({ ...s, pageElements: entry.pageElements }));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndex.current < historyStack.current.length - 1) {
      historyIndex.current++;
      const entry = historyStack.current[historyIndex.current];
      setState(s => ({ ...s, pageElements: entry.pageElements }));
    }
  }, []);

  // Persistence
  const saveChanges = useCallback(async () => {
    // TODO: Save to localStorage or Supabase
    try {
      localStorage.setItem('interface-editor-layout', JSON.stringify(state.pageElements));
      originalState.current = { ...state.pageElements };
      exitEditMode();
    } catch (err) {
      console.error('Failed to save changes:', err);
    }
  }, [state.pageElements, exitEditMode]);

  const discardChanges = useCallback(() => {
    setState(s => ({ ...s, pageElements: originalState.current }));
    exitEditMode();
  }, [exitEditMode]);

  const value: InterfaceEditorContextType = {
    ...state,
    enterEditMode,
    exitEditMode,
    selectElement,
    clearSelection,
    startDrag,
    updateDragPosition,
    endDrag,
    cancelDrag,
    setActiveDropZone,
    updateAlignmentGuides,
    registerElement,
    unregisterElement,
    getRegisteredElements,
    addElement,
    updateElement,
    deleteElement,
    moveElement,
    undo,
    redo,
    canUndo: historyIndex.current > 0,
    canRedo: historyIndex.current < historyStack.current.length - 1,
    saveChanges,
    discardChanges,
    hasUnsavedChanges: JSON.stringify(state.pageElements) !== JSON.stringify(originalState.current),
  };

  return (
    <InterfaceEditorContext.Provider value={value}>
      {children}
    </InterfaceEditorContext.Provider>
  );
}

export function useInterfaceEditor() {
  const context = useContext(InterfaceEditorContext);
  if (context === undefined) {
    throw new Error('useInterfaceEditor must be used within an InterfaceEditorProvider');
  }
  return context;
}

// Helper to get default props for element types
function getDefaultProps(type: UIElementType): Record<string, unknown> {
  switch (type) {
    case 'button':
      return { label: '按鈕', variant: 'primary' };
    case 'text':
      return { content: '文字', fontSize: 14 };
    case 'icon':
      return { iconName: 'Star', size: 24 };
    case 'image':
      return { src: '', alt: '圖像' };
    case 'row':
    case 'column':
      return { gap: 8 };
    case 'divider':
      return { thickness: 1 };
    case 'spacer':
      return { size: 16 };
    default:
      return {};
  }
}
