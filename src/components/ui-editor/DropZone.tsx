import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';

interface DropZoneProps {
  zoneId: string;
  children: React.ReactNode;
  className?: string;
}

export function DropZone({ zoneId, children, className = '' }: DropZoneProps) {
  const { 
    isEditing, 
    endDrag, 
    draggingElement,
    setActiveDropZone,
    activeDropZone,
  } = useInterfaceEditor();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  // Register drop zone bounds
  useEffect(() => {
    if (!isEditing || !zoneRef.current) return;
    // Could register zone bounds for advanced features
  }, [isEditing]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
    setActiveDropZone(zoneId);
  }, [isEditing, zoneId, setActiveDropZone]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the zone itself, not entering a child
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
      setActiveDropZone(null);
    }
  }, [setActiveDropZone]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    setIsDragOver(false);
    
    const data = e.dataTransfer.getData('application/x-ui-element');
    if (data && draggingElement) {
      const rect = zoneRef.current?.getBoundingClientRect();
      const position = {
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
      };
      endDrag(zoneId, position);
    }
  }, [isEditing, draggingElement, endDrag, zoneId]);

  if (!isEditing) {
    return <>{children}</>;
  }

  return (
    <div
      ref={zoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative transition-all duration-200
        ${isDragOver ? 'ring-2 ring-[hsl(var(--accent))] ring-offset-2 ring-offset-background' : ''}
        ${activeDropZone === zoneId ? 'bg-[hsl(var(--accent)/0.05)]' : ''}
        ${className}
      `}
      data-dropzone={zoneId}
    >
      {children}
      
      {/* Drop indicator overlay */}
      {isDragOver && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center 
                        bg-[hsl(var(--accent)/0.1)] border-2 border-dashed border-[hsl(var(--accent))] 
                        rounded-lg">
          <span className="text-sm font-medium text-[hsl(var(--accent))] bg-[hsl(var(--background))] 
                           px-3 py-1.5 rounded-full shadow-sm">
            放置元素
          </span>
        </div>
      )}
    </div>
  );
}
