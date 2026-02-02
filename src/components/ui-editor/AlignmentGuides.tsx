import React from 'react';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';

export function AlignmentGuides() {
  const { isEditing, alignmentGuides, draggingElement } = useInterfaceEditor();

  if (!isEditing || !draggingElement || alignmentGuides.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[99]">
      <svg className="w-full h-full">
        {alignmentGuides.map((guide, index) => (
          <line
            key={`${guide.type}-${guide.position}-${index}`}
            x1={guide.type === 'vertical' ? guide.position : guide.start}
            y1={guide.type === 'horizontal' ? guide.position : guide.start}
            x2={guide.type === 'vertical' ? guide.position : guide.end}
            y2={guide.type === 'horizontal' ? guide.position : guide.end}
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        ))}
      </svg>
      
      {/* Position indicators at intersection points */}
      {alignmentGuides.map((guide, index) => (
        <div
          key={`indicator-${index}`}
          className="absolute w-2 h-2 bg-[hsl(var(--accent))] rounded-full transform -translate-x-1 -translate-y-1"
          style={{
            left: guide.type === 'vertical' ? guide.position : (guide.start + guide.end) / 2,
            top: guide.type === 'horizontal' ? guide.position : (guide.start + guide.end) / 2,
          }}
        />
      ))}
    </div>
  );
}
