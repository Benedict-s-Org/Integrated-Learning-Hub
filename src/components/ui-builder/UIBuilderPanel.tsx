// UI Builder Panel - Refactored with top toolbar, left sidebar, and main canvas
import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from 'lucide-react';
import type { UIElement, Asset, UITemplate } from '@/types/ui-builder';
import { createDefaultElement } from './ElementToolbar';
import { TopToolbar } from './TopToolbar';
import { EditorSidebar } from './EditorSidebar';
import { MainCanvas } from './MainCanvas';
import { StatusBar } from './StatusBar';
import { useHistoryState } from '@/hooks/useHistoryState';

interface UIBuilderPanelProps {
  onClose?: () => void;
  onSave?: (elements: UIElement[]) => void;
}

// Preset templates
const presetTemplates: UITemplate[] = [
  {
    id: 'nav-buttons',
    name: '導航按鈕組',
    description: '4個水平排列的導航按鈕',
    category: '導航',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'nav-row',
        type: 'row' as const,
        order: 0,
        props: { gap: 8, alignItems: 'center', justifyContent: 'center' },
        children: [
          { id: 'btn-1', type: 'button' as const, order: 0, props: { label: '首頁', variant: 'primary' } },
          { id: 'btn-2', type: 'button' as const, order: 1, props: { label: '關於', variant: 'secondary' } },
          { id: 'btn-3', type: 'button' as const, order: 2, props: { label: '服務', variant: 'secondary' } },
          { id: 'btn-4', type: 'button' as const, order: 3, props: { label: '聯絡', variant: 'ghost' } },
        ]
      }
    ]
  },
  {
    id: 'confirm-dialog',
    name: '確認對話框按鈕',
    description: '取消與確認按鈕組合',
    category: '對話框',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'dialog-row',
        type: 'row' as const,
        order: 0,
        props: { gap: 12, alignItems: 'center', justifyContent: 'end' },
        children: [
          { id: 'cancel-btn', type: 'button' as const, order: 0, props: { label: '取消', variant: 'ghost' } },
          { id: 'confirm-btn', type: 'button' as const, order: 1, props: { label: '確認', variant: 'primary' } },
        ]
      }
    ]
  },
  {
    id: 'feature-card',
    name: '功能卡片',
    description: '圖示、標題、說明與按鈕的組合',
    category: '卡片',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'card-col',
        type: 'column' as const,
        order: 0,
        props: { gap: 12, alignItems: 'center', padding: 24, backgroundColor: 'hsl(var(--card))' },
        children: [
          { id: 'card-icon', type: 'icon' as const, order: 0, props: { iconName: 'Star', size: 48, color: 'hsl(var(--primary))' } },
          { id: 'card-title', type: 'text' as const, order: 1, props: { content: '功能標題', fontSize: 20, fontWeight: 600 } },
          { id: 'card-desc', type: 'text' as const, order: 2, props: { content: '這是功能的簡短說明文字', fontSize: 14, color: 'hsl(var(--muted-foreground))' } },
          { id: 'card-btn', type: 'button' as const, order: 3, props: { label: '了解更多', variant: 'primary' } },
        ]
      }
    ]
  },
];

export function UIBuilderPanel({ onClose, onSave }: UIBuilderPanelProps) {
  // History-enabled state for elements (supports undo/redo)
  const {
    state: elements,
    set: setElements,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetElements,
    pastLength,
    futureLength,
  } = useHistoryState<UIElement[]>([]);

  // Other state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (modKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Find selected element
  const selectedElement = findElement(elements, selectedId);
  const hasMultiSelection = multiSelectedIds.size > 1;

  // Handle selection with multi-select support
  const handleSelect = useCallback((id: string | null, shiftKey: boolean = false) => {
    if (!id) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      return;
    }

    if (shiftKey) {
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (selectedId === id && next.size > 0) {
            setSelectedId([...next][0]);
          } else if (next.size === 0) {
            setSelectedId(null);
          }
        } else {
          next.add(id);
          if (!selectedId) {
            setSelectedId(id);
          }
        }
        return next;
      });
    } else {
      setSelectedId(id);
      setMultiSelectedIds(new Set([id]));
    }
  }, [selectedId]);

  // Add new element
  const handleAddElement = useCallback((type: UIElement['type']) => {
    const newElement = createDefaultElement(type, elements.length);
    setElements(prev => [...prev, newElement]);
    setSelectedId(newElement.id);
    setMultiSelectedIds(new Set([newElement.id]));
  }, [elements.length, setElements]);

  // Update element props
  const handleUpdateElement = useCallback((id: string, newProps: Record<string, any>) => {
    setElements(prev => updateElementInTree(prev, id, (el) => ({
      ...el,
      props: newProps,
    })));
  }, [setElements]);

  // Delete element(s)
  const handleDeleteElement = useCallback((id: string) => {
    const idsToDelete = multiSelectedIds.size > 1 ? [...multiSelectedIds] : [id];
    
    setElements(prev => {
      let result = prev;
      for (const delId of idsToDelete) {
        result = removeElementFromTree(result, delId);
      }
      return result;
    });
    
    setSelectedId(null);
    setMultiSelectedIds(new Set());
  }, [multiSelectedIds, setElements]);

  // Delete all selected elements
  const handleDeleteSelected = useCallback(() => {
    if (multiSelectedIds.size === 0) return;
    
    setElements(prev => {
      let result = prev;
      for (const id of multiSelectedIds) {
        result = removeElementFromTree(result, id);
      }
      return result;
    });
    
    setSelectedId(null);
    setMultiSelectedIds(new Set());
  }, [multiSelectedIds, setElements]);

  // Duplicate element
  const handleDuplicateElement = useCallback((id: string) => {
    const element = findElement(elements, id);
    if (element) {
      const cloned = JSON.parse(JSON.stringify(element));
      regenerateIds([cloned]);
      cloned.order = elements.length;
      setElements(prev => [...prev, cloned]);
      setSelectedId(cloned.id);
      setMultiSelectedIds(new Set([cloned.id]));
    }
  }, [elements, setElements]);

  // Group selected elements into a container
  const handleGroupElements = useCallback((containerType: 'row' | 'column') => {
    if (multiSelectedIds.size < 2) return;

    const selectedElements: UIElement[] = [];
    const selectedIdsArray = [...multiSelectedIds];
    
    for (const id of selectedIdsArray) {
      const el = findElement(elements, id);
      if (el) {
        selectedElements.push(el);
      }
    }

    if (selectedElements.length < 2) return;

    const containerId = `${containerType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newContainer: UIElement = {
      id: containerId,
      type: containerType,
      order: elements.length,
      props: {
        gap: 8,
        alignItems: 'center',
        justifyContent: 'start',
        padding: 8,
      },
      children: selectedElements.map((el, index) => ({
        ...el,
        parentId: containerId,
        order: index,
      })),
    };

    setElements(prev => {
      let result = prev;
      for (const id of selectedIdsArray) {
        result = removeElementFromTree(result, id);
      }
      return [...result, newContainer];
    });

    setSelectedId(containerId);
    setMultiSelectedIds(new Set([containerId]));
  }, [elements, multiSelectedIds, setElements]);

  // Ungroup a container
  const handleUngroupElement = useCallback((id: string) => {
    const container = findElement(elements, id);
    if (!container || !container.children || container.children.length === 0) return;
    if (container.type !== 'row' && container.type !== 'column') return;

    const children = container.children;
    const parentId = container.parentId;

    setElements(prev => {
      let result = removeElementFromTree(prev, id);
      
      if (parentId) {
        result = updateElementInTree(result, parentId, (parent) => ({
          ...parent,
          children: [
            ...(parent.children || []),
            ...children.map((c, i) => ({ ...c, parentId, order: (parent.children?.length || 0) + i })),
          ],
        }));
      } else {
        result = [
          ...result,
          ...children.map((c, i) => ({ ...c, parentId: undefined, order: result.length + i })),
        ];
      }
      
      return result;
    });

    const childIds = new Set(children.map(c => c.id));
    setSelectedId(children[0]?.id || null);
    setMultiSelectedIds(childIds);
  }, [elements, setElements]);

  // Reorder elements with drag and drop
  const handleReorder = useCallback((dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    setElements(prev => {
      const draggedElement = findElement(prev, dragId);
      if (!draggedElement) return prev;

      const treeWithoutDragged = removeElementFromTree(prev, dragId);
      const targetParent = findParentElement(treeWithoutDragged, targetId);
      
      if (position === 'inside') {
        return updateElementInTree(treeWithoutDragged, targetId, (el) => ({
          ...el,
          children: [...(el.children || []), { ...draggedElement, parentId: el.id }],
        }));
      }

      if (targetParent) {
        return updateElementInTree(treeWithoutDragged, targetParent.id, (parent) => {
          const children = [...(parent.children || [])];
          const targetIndex = children.findIndex(c => c.id === targetId);
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          children.splice(insertIndex, 0, { ...draggedElement, parentId: parent.id });
          return { ...parent, children };
        });
      } else {
        const targetIndex = treeWithoutDragged.findIndex(el => el.id === targetId);
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        const result = [...treeWithoutDragged];
        result.splice(insertIndex, 0, { ...draggedElement, parentId: undefined });
        return result;
      }
    });
  }, [setElements]);

  // Apply template (resets history)
  const handleApplyTemplate = useCallback((templateElements: UIElement[]) => {
    resetElements(templateElements);
    setSelectedId(null);
    setMultiSelectedIds(new Set());
  }, [resetElements]);

  // Asset management
  const handleAddAsset = useCallback((asset: Asset) => {
    setAssets(prev => [...prev, asset]);
  }, []);

  const handleRemoveAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  // Save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(elements);
    }
    if (onClose) {
      onClose();
    }
  }, [elements, onSave, onClose]);

  // Check if selected element can be ungrouped
  const canUngroup = selectedElement && 
    (selectedElement.type === 'row' || selectedElement.type === 'column') && 
    selectedElement.children && 
    selectedElement.children.length > 0;

  return (
    <div 
      className={`bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-2xl flex flex-col overflow-hidden ${
        onClose ? 'fixed z-50' : 'h-full'
      } ${
        onClose 
          ? isMaximized 
            ? 'inset-4' 
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[1400px] h-[90vh]'
          : ''
      }`}
    >
      {/* Top Toolbar */}
      <TopToolbar
        onAddElement={handleAddElement}
        onGroupAsRow={() => handleGroupElements('row')}
        onGroupAsColumn={() => handleGroupElements('column')}
        onUngroup={handleUngroupElement}
        onDeleteSelected={handleDeleteSelected}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        selectedId={selectedId}
        multiSelectedIds={multiSelectedIds}
        canUngroup={canUngroup || false}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized(!isMaximized)}
        onSave={handleSave}
        onClose={onClose}
        presetTemplates={presetTemplates}
        onApplyTemplate={handleApplyTemplate}
        assets={assets}
        onAddAsset={handleAddAsset}
        onRemoveAsset={handleRemoveAsset}
      />

      {/* Main Content: Sidebar + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <EditorSidebar
          elements={elements}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          selectedElement={selectedElement}
          onSelect={handleSelect}
          onReorder={handleReorder}
          onDelete={handleDeleteElement}
          onDuplicate={handleDuplicateElement}
          onUpdateElement={handleUpdateElement}
          onUngroup={handleUngroupElement}
        />

        {/* Main Canvas */}
        <MainCanvas
          elements={elements}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          onSelect={handleSelect}
          onReorder={handleReorder}
        />
      </div>

      {/* Status Bar */}
      <StatusBar
        elementCount={elements.length}
        selectedCount={multiSelectedIds.size}
        pastLength={pastLength}
        futureLength={futureLength}
      />
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function findElement(elements: UIElement[], id: string | null): UIElement | null {
  if (!id) return null;
  
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.children) {
      const found = findElement(element.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateElementInTree(
  elements: UIElement[], 
  id: string, 
  updater: (el: UIElement) => UIElement
): UIElement[] {
  return elements.map(element => {
    if (element.id === id) {
      return updater(element);
    }
    if (element.children) {
      return {
        ...element,
        children: updateElementInTree(element.children, id, updater),
      };
    }
    return element;
  });
}

function removeElementFromTree(elements: UIElement[], id: string): UIElement[] {
  return elements
    .filter(element => element.id !== id)
    .map(element => {
      if (element.children) {
        return {
          ...element,
          children: removeElementFromTree(element.children, id),
        };
      }
      return element;
    });
}

function findParentElement(elements: UIElement[], childId: string): UIElement | null {
  for (const element of elements) {
    if (element.children?.some(c => c.id === childId)) {
      return element;
    }
    if (element.children) {
      const found = findParentElement(element.children, childId);
      if (found) return found;
    }
  }
  return null;
}

function regenerateIds(elements: UIElement[]): void {
  for (const element of elements) {
    element.id = `${element.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (element.children) {
      regenerateIds(element.children);
    }
  }
}

export default UIBuilderPanel;
