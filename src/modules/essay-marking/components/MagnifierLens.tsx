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
  zoomLevel?: number;
}

interface MagnifierLensProps {
  state: MagnifierState;
}

export const MagnifierLens: React.FC<MagnifierLensProps> = ({ state }) => {
  if (!state.visible || !state.imgSrc) return null;

  const width = 280;
  const height = 220;

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
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="hidden md:block rounded-xl border-2 border-purple-600 bg-white shadow-2xl overflow-hidden ring-4 ring-purple-600/20 pointer-events-none animate-in fade-in duration-75 select-none"
      aria-hidden="true"
    >
      {/* Alignment crosshair indicator */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="w-5 h-0.5 bg-purple-900" />
        <div className="w-0.5 h-5 bg-purple-900 absolute" />
      </div>

      {/* Magnifier lens info badge */}
      <div className="absolute bottom-0 inset-x-0 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-semibold tracking-wider px-2 py-0.5 flex items-center justify-between">
        <span className="truncate">Handwriting Lens</span>
        <span className="font-mono text-purple-300 font-bold ml-1 shrink-0">
          {(state.zoomLevel ?? 3.0).toFixed(1)}×
        </span>
      </div>
    </div>
  );
};
