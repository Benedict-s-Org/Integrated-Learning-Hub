import React from 'react';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';

export function InterfaceEditorButton() {
  const { isAdmin } = useAuth();
  const { isEditing, enterEditMode } = useInterfaceEditor();

  // Only show for admins and when not already editing
  if (!isAdmin || isEditing) return null;

  return (
    <button
      onClick={enterEditMode}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 
                 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] 
                 rounded-full shadow-lg hover:shadow-xl transition-all duration-200
                 hover:scale-105 active:scale-95"
      aria-label="編輯介面"
    >
      <Pencil size={18} />
      <span className="font-medium">編輯介面</span>
    </button>
  );
}
