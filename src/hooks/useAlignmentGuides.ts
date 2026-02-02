import { useCallback } from 'react';
import { useInterfaceEditor, type ElementRect, type AlignmentGuide } from '@/contexts/InterfaceEditorContext';

const SNAP_THRESHOLD = 8; // pixels

interface DragRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export function useAlignmentGuides() {
  const { getRegisteredElements, updateAlignmentGuides } = useInterfaceEditor();

  const calculateGuides = useCallback((dragRect: DragRect): { guides: AlignmentGuide[]; snapOffset: { x: number; y: number } } => {
    const elements = getRegisteredElements();
    const guides: AlignmentGuide[] = [];
    let snapX = 0;
    let snapY = 0;

    for (const el of elements) {
      // Vertical alignments (x-axis)
      
      // Left edge alignment
      const leftDiff = dragRect.left - el.left;
      if (Math.abs(leftDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical',
          position: el.left,
          start: Math.min(dragRect.top, el.top),
          end: Math.max(dragRect.bottom, el.bottom),
          targetId: el.id,
        });
        if (Math.abs(leftDiff) < Math.abs(snapX) || snapX === 0) {
          snapX = -leftDiff;
        }
      }

      // Right edge alignment
      const rightDiff = dragRect.right - el.right;
      if (Math.abs(rightDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical',
          position: el.right,
          start: Math.min(dragRect.top, el.top),
          end: Math.max(dragRect.bottom, el.bottom),
          targetId: el.id,
        });
        if (Math.abs(rightDiff) < Math.abs(snapX) || snapX === 0) {
          snapX = -rightDiff;
        }
      }

      // Center X alignment
      const centerXDiff = dragRect.centerX - el.centerX;
      if (Math.abs(centerXDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical',
          position: el.centerX,
          start: Math.min(dragRect.top, el.top),
          end: Math.max(dragRect.bottom, el.bottom),
          targetId: el.id,
        });
        if (Math.abs(centerXDiff) < Math.abs(snapX) || snapX === 0) {
          snapX = -centerXDiff;
        }
      }

      // Left to Right alignment
      const leftToRightDiff = dragRect.left - el.right;
      if (Math.abs(leftToRightDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical',
          position: el.right,
          start: Math.min(dragRect.top, el.top),
          end: Math.max(dragRect.bottom, el.bottom),
          targetId: el.id,
        });
        if (Math.abs(leftToRightDiff) < Math.abs(snapX) || snapX === 0) {
          snapX = -leftToRightDiff;
        }
      }

      // Right to Left alignment
      const rightToLeftDiff = dragRect.right - el.left;
      if (Math.abs(rightToLeftDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical',
          position: el.left,
          start: Math.min(dragRect.top, el.top),
          end: Math.max(dragRect.bottom, el.bottom),
          targetId: el.id,
        });
        if (Math.abs(rightToLeftDiff) < Math.abs(snapX) || snapX === 0) {
          snapX = -rightToLeftDiff;
        }
      }

      // Horizontal alignments (y-axis)
      
      // Top edge alignment
      const topDiff = dragRect.top - el.top;
      if (Math.abs(topDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal',
          position: el.top,
          start: Math.min(dragRect.left, el.left),
          end: Math.max(dragRect.right, el.right),
          targetId: el.id,
        });
        if (Math.abs(topDiff) < Math.abs(snapY) || snapY === 0) {
          snapY = -topDiff;
        }
      }

      // Bottom edge alignment
      const bottomDiff = dragRect.bottom - el.bottom;
      if (Math.abs(bottomDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal',
          position: el.bottom,
          start: Math.min(dragRect.left, el.left),
          end: Math.max(dragRect.right, el.right),
          targetId: el.id,
        });
        if (Math.abs(bottomDiff) < Math.abs(snapY) || snapY === 0) {
          snapY = -bottomDiff;
        }
      }

      // Center Y alignment
      const centerYDiff = dragRect.centerY - el.centerY;
      if (Math.abs(centerYDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal',
          position: el.centerY,
          start: Math.min(dragRect.left, el.left),
          end: Math.max(dragRect.right, el.right),
          targetId: el.id,
        });
        if (Math.abs(centerYDiff) < Math.abs(snapY) || snapY === 0) {
          snapY = -centerYDiff;
        }
      }

      // Top to Bottom alignment
      const topToBottomDiff = dragRect.top - el.bottom;
      if (Math.abs(topToBottomDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal',
          position: el.bottom,
          start: Math.min(dragRect.left, el.left),
          end: Math.max(dragRect.right, el.right),
          targetId: el.id,
        });
        if (Math.abs(topToBottomDiff) < Math.abs(snapY) || snapY === 0) {
          snapY = -topToBottomDiff;
        }
      }

      // Bottom to Top alignment
      const bottomToTopDiff = dragRect.bottom - el.top;
      if (Math.abs(bottomToTopDiff) < SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal',
          position: el.top,
          start: Math.min(dragRect.left, el.left),
          end: Math.max(dragRect.right, el.right),
          targetId: el.id,
        });
        if (Math.abs(bottomToTopDiff) < Math.abs(snapY) || snapY === 0) {
          snapY = -bottomToTopDiff;
        }
      }
    }

    // Deduplicate guides by position
    const uniqueGuides = guides.reduce((acc, guide) => {
      const key = `${guide.type}-${guide.position}`;
      if (!acc.has(key)) {
        acc.set(key, guide);
      }
      return acc;
    }, new Map<string, AlignmentGuide>());

    return {
      guides: Array.from(uniqueGuides.values()),
      snapOffset: { x: snapX, y: snapY },
    };
  }, [getRegisteredElements]);

  const updateGuides = useCallback((dragRect: DragRect) => {
    const { guides } = calculateGuides(dragRect);
    updateAlignmentGuides(guides);
    return calculateGuides(dragRect);
  }, [calculateGuides, updateAlignmentGuides]);

  const clearGuides = useCallback(() => {
    updateAlignmentGuides([]);
  }, [updateAlignmentGuides]);

  return {
    calculateGuides,
    updateGuides,
    clearGuides,
  };
}
