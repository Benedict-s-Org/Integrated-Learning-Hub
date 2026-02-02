import React, { useCallback } from 'react';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';
import type { UIElementType } from '@/types/ui-builder';

interface DraggableElementProps {
  type: UIElementType;
  icon: React.ReactNode;
  label: string;
}

export function DraggableElement({ type, icon, label }: DraggableElementProps) {
  const { startDrag, updateDragPosition, cancelDrag, draggingElement } = useInterfaceEditor();

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-ui-element', JSON.stringify({ type, isNew: true }));
    
    // Create custom drag image
    const ghost = document.createElement('div');
    ghost.className = 'px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg text-sm font-medium';
    ghost.textContent = label;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 50, 20);
    
    setTimeout(() => document.body.removeChild(ghost), 0);
    
    startDrag(type, true);
  }, [type, label, startDrag]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX > 0 && e.clientY > 0) {
      updateDragPosition(e.clientX, e.clientY);
    }
  }, [updateDragPosition]);

  const handleDragEnd = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  const isDragging = draggingElement?.type === type && draggingElement?.isNew;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className={`
        flex flex-col items-center gap-1 p-2 rounded-lg cursor-grab 
        hover:bg-[hsl(var(--background))] transition-colors select-none
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      title={`拖曳新增${label}`}
    >
      <div className="text-[hsl(var(--foreground))]">
        {icon}
      </div>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">
        {label}
      </span>
    </div>
  );
}
