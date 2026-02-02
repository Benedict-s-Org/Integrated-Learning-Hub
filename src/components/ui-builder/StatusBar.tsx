// Status Bar - Bottom status information
import React from 'react';

interface StatusBarProps {
  elementCount: number;
  selectedCount: number;
  pastLength: number;
  futureLength: number;
}

export function StatusBar({
  elementCount,
  selectedCount,
  pastLength,
  futureLength,
}: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-sm text-[hsl(var(--muted-foreground))]">
      <div className="flex items-center gap-4">
        <span>{elementCount} 個元素</span>
        {selectedCount > 0 && (
          <span className="text-[hsl(var(--primary))]">已選擇 {selectedCount} 個</span>
        )}
        {(pastLength > 0 || futureLength > 0) && (
          <span className="opacity-70">歷史: {pastLength}↩ {futureLength}↪</span>
        )}
      </div>
      {selectedCount > 1 && (
        <span className="text-xs opacity-70">Shift+點擊多選</span>
      )}
    </div>
  );
}

export default StatusBar;
