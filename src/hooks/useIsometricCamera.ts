import { useState, useRef, useCallback } from "react";

interface CameraState {
  offset: { x: number; y: number };
  rotation: number;
}

interface UseIsometricCameraOptions {
  initialOffset?: { x: number; y: number };
  initialRotation?: number;
  onRotateDrag?: () => void;
}

export function useIsometricCamera(options: UseIsometricCameraOptions = {}) {
  const { 
    initialOffset = { x: 0, y: 100 }, 
    initialRotation = 0,
    onRotateDrag
  } = options;

  const [offset, setOffset] = useState(initialOffset);
  const [rotation, setRotation] = useState(initialRotation);
  const [isPanDragging, setIsPanDragging] = useState(false);
  const [isRotateDragging, setIsRotateDragging] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent, isDraggingItem: boolean = false) => {
    if (e.button === 2) {
      e.preventDefault();
      if (isDraggingItem) {
        // Let parent handle rotation of dragging item
        onRotateDrag?.();
      } else {
        setIsRotateDragging(true);
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 0 && !isDraggingItem) {
      setIsPanDragging(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [onRotateDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanDragging) {
      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    } else if (isRotateDragging) {
      const deltaX = e.clientX - lastMouseRef.current.x;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setRotation((prev) => prev + deltaX * 0.01);
    }
  }, [isPanDragging, isRotateDragging]);

  const handleMouseUp = useCallback(() => {
    setIsPanDragging(false);
    setIsRotateDragging(false);
  }, []);

  const resetCamera = useCallback(() => {
    setOffset(initialOffset);
    setRotation(initialRotation);
  }, [initialOffset, initialRotation]);

  return {
    offset,
    rotation,
    isPanDragging,
    isRotateDragging,
    setOffset,
    setRotation,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetCamera,
    lastMouseRef,
  };
}
