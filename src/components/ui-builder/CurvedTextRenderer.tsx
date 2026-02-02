// Curved Text Renderer - SVG-based text path rendering
import React, { useMemo, useId } from 'react';
import type { TextShape, FontWeight } from '@/types/ui-builder';

interface CurvedTextRendererProps {
  text: string;
  shape: TextShape;
  curve: number;
  fontSize?: number;
  fontWeight?: FontWeight;
  color?: string;
  letterSpacing?: number;
  className?: string;
}

// =============================================================================
// PATH GENERATORS
// =============================================================================

function generateArchUpPath(width: number, height: number, intensity: number): string {
  const curveHeight = height * (Math.abs(intensity) / 100) * 0.8;
  const direction = intensity >= 0 ? -1 : 1;
  return `M 0,${height / 2 + curveHeight * direction} Q ${width / 2},${height / 2 - curveHeight * direction} ${width},${height / 2 + curveHeight * direction}`;
}

function generateArchDownPath(width: number, height: number, intensity: number): string {
  const curveHeight = height * (Math.abs(intensity) / 100) * 0.8;
  const direction = intensity >= 0 ? 1 : -1;
  return `M 0,${height / 2 - curveHeight * direction} Q ${width / 2},${height / 2 + curveHeight * direction} ${width},${height / 2 - curveHeight * direction}`;
}

function generateWavePath(width: number, height: number, intensity: number): string {
  const waveHeight = height * (Math.abs(intensity) / 100) * 0.5;
  const segments = 3;
  const segmentWidth = width / segments;
  
  let path = `M 0,${height / 2}`;
  for (let i = 0; i < segments; i++) {
    const x1 = segmentWidth * i + segmentWidth / 4;
    const y1 = height / 2 + (i % 2 === 0 ? -waveHeight : waveHeight);
    const x2 = segmentWidth * i + (segmentWidth * 3) / 4;
    const y2 = height / 2 + (i % 2 === 0 ? waveHeight : -waveHeight);
    const x3 = segmentWidth * (i + 1);
    const y3 = height / 2;
    path += ` C ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
  }
  return path;
}

function generateBridgePath(width: number, height: number, intensity: number): string {
  const curveHeight = height * (Math.abs(intensity) / 100) * 0.6;
  return `M 0,${height / 2 + curveHeight} Q ${width / 4},${height / 2 - curveHeight} ${width / 2},${height / 2 - curveHeight} Q ${(width * 3) / 4},${height / 2 - curveHeight} ${width},${height / 2 + curveHeight}`;
}

function generateValleyPath(width: number, height: number, intensity: number): string {
  const curveHeight = height * (Math.abs(intensity) / 100) * 0.6;
  return `M 0,${height / 2 - curveHeight} Q ${width / 4},${height / 2 + curveHeight} ${width / 2},${height / 2 + curveHeight} Q ${(width * 3) / 4},${height / 2 + curveHeight} ${width},${height / 2 - curveHeight}`;
}

function generateCirclePath(width: number, height: number, intensity: number): string {
  const radius = Math.min(width, height) * 0.4;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Arc from bottom-left to bottom-right going through top
  return `M ${centerX - radius},${centerY + radius * 0.2} A ${radius},${radius} 0 1,1 ${centerX + radius},${centerY + radius * 0.2}`;
}

function generateSquarePath(width: number, height: number, intensity: number): string {
  const margin = width * 0.1;
  const effectiveWidth = width - margin * 2;
  const effectiveHeight = height * 0.6;
  const startY = height / 2 + effectiveHeight / 2;
  
  // Create a square-ish path
  return `M ${margin},${startY} L ${margin},${height / 2 - effectiveHeight / 2} L ${margin + effectiveWidth},${height / 2 - effectiveHeight / 2} L ${margin + effectiveWidth},${startY}`;
}

function generatePath(shape: TextShape, width: number, height: number, intensity: number): string {
  switch (shape) {
    case 'arch-up':
      return generateArchUpPath(width, height, intensity);
    case 'arch-down':
      return generateArchDownPath(width, height, intensity);
    case 'wave':
      return generateWavePath(width, height, intensity);
    case 'bridge':
      return generateBridgePath(width, height, intensity);
    case 'valley':
      return generateValleyPath(width, height, intensity);
    case 'circle':
      return generateCirclePath(width, height, intensity);
    case 'square':
      return generateSquarePath(width, height, intensity);
    default:
      return `M 0,${height / 2} L ${width},${height / 2}`;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CurvedTextRenderer({
  text,
  shape,
  curve,
  fontSize = 16,
  fontWeight = 400,
  color = 'currentColor',
  letterSpacing = 0,
  className = '',
}: CurvedTextRendererProps) {
  const pathId = useId();
  
  // Calculate dimensions based on text
  const estimatedWidth = useMemo(() => {
    // Rough estimation: average character width is about 0.6 * fontSize
    return Math.max(text.length * fontSize * 0.6 + letterSpacing * text.length, 200);
  }, [text, fontSize, letterSpacing]);
  
  const svgHeight = useMemo(() => {
    // Height needs to accommodate the curve
    const baseHeight = fontSize * 2;
    const curveExtra = Math.abs(curve) * 0.5;
    return baseHeight + curveExtra;
  }, [fontSize, curve]);
  
  const path = useMemo(() => {
    return generatePath(shape, estimatedWidth, svgHeight, curve);
  }, [shape, estimatedWidth, svgHeight, curve]);

  if (shape === 'none') {
    return (
      <span
        className={className}
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing,
        }}
      >
        {text}
      </span>
    );
  }

  return (
    <svg
      width={estimatedWidth}
      height={svgHeight}
      className={className}
      viewBox={`0 0 ${estimatedWidth} ${svgHeight}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <path id={pathId} d={path} fill="none" />
      </defs>
      <text
        fill={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        <textPath
          href={`#${pathId}`}
          startOffset="50%"
        >
          {text}
        </textPath>
      </text>
      {/* Debug: show path (uncomment to debug) */}
      {/* <path d={path} stroke="red" strokeWidth="1" fill="none" opacity="0.3" /> */}
    </svg>
  );
}

export default CurvedTextRenderer;
