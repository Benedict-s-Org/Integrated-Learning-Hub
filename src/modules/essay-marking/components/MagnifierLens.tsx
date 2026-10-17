import React from 'react';

export interface MagnifierState {
  visible: boolean;
  x: number;
  y: number;
  imgSrc: string;
  bgWidth: number;
  bgHeight: number;
  bgX: number;
  bgY: number;
}

interface MagnifierLensProps {
  state: MagnifierState;
}

export const MagnifierLens: React.FC<MagnifierLensProps> = ({ state }) => {
  if (!state.visible || !state.imgSrc) return null;

  const width = 280;
  const height = 190;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${state.x}px`,
        top: `${state.y}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundImage: `url("${state.imgSrc}")`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${state.bgWidth}px ${state.bgHeight}px`,
        backgroundPosition: `${state.bgX}px ${state.bgY}px`,
        zIndex: 100,
        pointerEvents: 'none',
      }}
      className="hidden md:block rounded-lg border-2 border-blue-600 bg-white shadow-2xl overflow-hidden animate-in fade-in duration-75"
    >
      <div className="absolute bottom-0 inset-x-0 bg-blue-700/90 text-white text-[10px] font-semibold tracking-wider px-2 py-0.5 text-center">
        Magnifier · 2.8×
      </div>
    </div>
  );
};
