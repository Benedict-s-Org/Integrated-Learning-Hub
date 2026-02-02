import React, { useEffect } from 'react';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';
import { InterfaceEditorToolbar } from './InterfaceEditorToolbar';
import { AlignmentGuides } from './AlignmentGuides';

export function InterfaceEditorOverlay() {
  const { isEditing, undo, redo, cancelDrag, clearSelection } = useInterfaceEditor();

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      // Cancel drag: Escape
      if (e.key === 'Escape') {
        cancelDrag();
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, undo, redo, cancelDrag, clearSelection]);

  if (!isEditing) return null;

  return (
    <>
      <InterfaceEditorToolbar />
      <AlignmentGuides />
      
      {/* Padding spacer to prevent content from being hidden under toolbar */}
      <div className="h-24" />
    </>
  );
}
