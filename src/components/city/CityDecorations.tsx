import type { CityDecoration } from "@/types/city";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";

interface CityDecorationsProps {
  decorations: CityDecoration[];
  toIso: (x: number, y: number) => { x: number; y: number };
}

// Custom image decoration renderer
function CustomImageDecoration({
  decoration,
  x,
  y
}: {
  decoration: CityDecoration;
  x: number;
  y: number;
}) {
  const { transform } = decoration;

  // Get transform parameters with defaults
  const {
    offsetX = 0,
    offsetY = 0,
    scale = 1,
    scaleX = 100,
    scaleY = 100,
    rotation = 0,
  } = transform || {};

  // Default dimensions for custom decorations
  const baseWidth = 60;
  const baseHeight = 60;

  // Apply transform scaling
  const finalWidth = baseWidth * scale * (scaleX / 100);
  const finalHeight = baseHeight * scale * (scaleY / 100);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Custom image with transform */}
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        <image
          href={decoration.customImageUrl}
          x={-finalWidth / 2}
          y={-finalHeight}
          width={finalWidth}
          height={finalHeight}
          preserveAspectRatio="xMidYMax meet"
          transform={rotation !== 0 ? `rotate(${rotation}, 0, ${-finalHeight / 2})` : undefined}
        />
      </g>
    </g>
  );
}

export function CityDecorations({ decorations, toIso }: CityDecorationsProps) {
  const renderDecoration = (decoration: CityDecoration) => {
    const pos = toIso(decoration.position.x, decoration.position.y);

    // If decoration has custom image, use custom renderer
    if (decoration.customImageUrl) {
      return (
        <CustomImageDecoration
          key={decoration.id}
          decoration={decoration}
          x={pos.x}
          y={pos.y}
        />
      );
    }

    switch (decoration.type) {
      case "tree":
        return <CuteTree key={decoration.id} x={pos.x} y={pos.y} />;
      case "lamp":
        return <CuteLamp key={decoration.id} x={pos.x} y={pos.y} />;
      case "bench":
        return <CuteBench key={decoration.id} x={pos.x} y={pos.y} rotation={decoration.rotation} />;
      case "fountain":
        return <CuteFountain key={decoration.id} x={pos.x} y={pos.y} />;
      case "flower":
        return <FlowerPatch key={decoration.id} x={pos.x} y={pos.y} />;
      case "bush":
        return <CuteBush key={decoration.id} x={pos.x} y={pos.y} variant={decoration.variant} />;
      case "mushroom":
        return <CuteMushroom key={decoration.id} x={pos.x} y={pos.y} />;
      case "birdhouse":
        return <CuteBirdhouse key={decoration.id} x={pos.x} y={pos.y} />;
      case "rock":
        return <CuteRock key={decoration.id} x={pos.x} y={pos.y} variant={decoration.variant} />;
      case "butterfly":
        return <CuteButterfly key={decoration.id} x={pos.x} y={pos.y} variant={decoration.variant} />;
      default:
        return null;
    }
  };

  return <>{decorations.map(renderDecoration)}</>;
}

// Cute fluffy tree with rounded shapes
function CuteTree({ x, y }: { x: number; y: number }) {
  const colors = CARTOON_PALETTE.decorations;

  return (
    <g transform={`translate(${x}, ${y})`} className="animate-sway-gentle" style={{ transformOrigin: `${x}px ${y}px` }}>
      {/* Trunk with cute curve */}
      <path
        d="M-5,-20 Q-6,-10 -4,5 L4,5 Q6,-10 5,-20 Z"
        fill={colors.trunk}
        stroke={colors.trunkDark}
        strokeWidth={0.5}
      />

      {/* Fluffy foliage (multiple overlapping circles for soft look) */}
      <circle cx={0} cy={-42} r={20} fill={colors.treeFoliage} />
      <circle cx={-14} cy={-32} r={15} fill={colors.treeFoliage} />
      <circle cx={14} cy={-35} r={16} fill={colors.treeFoliage} />
      <circle cx={-8} cy={-50} r={12} fill={colors.treeHighlight} />
      <circle cx={10} cy={-48} r={14} fill={colors.treeHighlight} />
      <circle cx={0} cy={-55} r={10} fill={colors.treeHighlight} />

      {/* Highlight spots for depth */}
      <circle cx={-6} cy={-52} r={5} fill="hsl(130, 60%, 75%)" opacity={0.7} />
      <circle cx={8} cy={-45} r={4} fill="hsl(130, 60%, 75%)" opacity={0.6} />

      {/* Small decorative dots */}
      <circle cx={-12} cy={-38} r={2} fill="hsl(130, 55%, 78%)" opacity={0.8} />
      <circle cx={10} cy={-55} r={2} fill="hsl(130, 55%, 78%)" opacity={0.8} />
    </g>
  );
}

// Cute street lamp with warm glow
function CuteLamp({ x, y }: { x: number; y: number }) {
  const lamp = CARTOON_PALETTE.decorations.lamp;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Decorative base */}
      <ellipse cx={0} cy={2} rx={6} ry={3} fill={lamp.pole} />

      {/* Pole with slight curve */}
      <path
        d="M-2.5,2 Q-3,-25 -2,-50 L2,-50 Q3,-25 2.5,2 Z"
        fill={lamp.pole}
        stroke="hsl(35, 25%, 45%)"
        strokeWidth={0.5}
      />

      {/* Decorative top ring */}
      <ellipse cx={0} cy={-52} rx={4} ry={2} fill={lamp.head} />

      {/* Lamp arm (curved) */}
      <path
        d="M0,-52 Q8,-55 14,-50"
        fill="none"
        stroke={lamp.pole}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Lamp head (cute rounded shape) */}
      <ellipse cx={16} cy={-48} rx={8} ry={5} fill={lamp.head} />
      <ellipse cx={16} cy={-50} rx={6} ry={3} fill="hsl(35, 40%, 75%)" />

      {/* Warm light glow */}
      <ellipse cx={16} cy={-42} rx={14} ry={10} fill={lamp.glowOuter} opacity={0.2} />
      <ellipse cx={16} cy={-44} rx={10} ry={7} fill={lamp.glow} opacity={0.3} />
      <ellipse cx={16} cy={-46} rx={5} ry={4} fill="hsl(45, 100%, 92%)" opacity={0.8} />
    </g>
  );
}

// Cute wooden bench
function CuteBench({ x, y, rotation = 0 }: { x: number; y: number; rotation?: number }) {
  const bench = CARTOON_PALETTE.decorations.bench;

  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation * 90})`}>
      {/* Cute legs with rounded bottoms */}
      <rect x={-14} y={-10} width={4} height={14} rx={2} fill={bench.metal} />
      <rect x={10} y={-10} width={4} height={14} rx={2} fill={bench.metal} />

      {/* Bench seat (rounded plank look) */}
      <rect x={-18} y={-14} width={36} height={6} rx={3} fill={bench.wood} />
      <rect x={-16} y={-13} width={32} height={2} rx={1} fill="hsl(25, 55%, 62%)" opacity={0.6} />

      {/* Bench back (two rounded planks) */}
      <rect x={-16} y={-26} width={32} height={5} rx={2.5} fill={bench.wood} />
      <rect x={-16} y={-20} width={32} height={4} rx={2} fill={bench.woodDark} />

      {/* Cute details - small wood grain lines */}
      <line x1={-10} y1={-12} x2={-5} y2={-12} stroke="hsl(25, 40%, 48%)" strokeWidth={0.5} opacity={0.4} />
      <line x1={5} y1={-12} x2={12} y2={-12} stroke="hsl(25, 40%, 48%)" strokeWidth={0.5} opacity={0.4} />
    </g>
  );
}

// Cute fountain with water animation
function CuteFountain({ x, y }: { x: number; y: number }) {
  const fountain = CARTOON_PALETTE.decorations.fountain;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pool base (cute rounded stone) */}
      <ellipse cx={0} cy={2} rx={26} ry={12} fill={fountain.stone} />
      <ellipse cx={0} cy={-1} rx={24} ry={11} fill={fountain.stoneDark} />
      <ellipse cx={0} cy={-3} rx={22} ry={10} fill={fountain.water} opacity={0.9} />

      {/* Water surface highlights */}
      <ellipse cx={-8} cy={-4} rx={6} ry={3} fill={fountain.waterLight} opacity={0.5} />
      <ellipse cx={10} cy={-2} rx={4} ry={2} fill={fountain.waterLight} opacity={0.4} />

      {/* Center pedestal (rounded cute shape) */}
      <path
        d="M-5,0 Q-6,-12 -4,-25 L4,-25 Q6,-12 5,0 Z"
        fill={fountain.stone}
        stroke={fountain.stoneDark}
        strokeWidth={0.5}
      />

      {/* Top bowl */}
      <ellipse cx={0} cy={-28} rx={12} ry={6} fill={fountain.stone} />
      <ellipse cx={0} cy={-30} rx={10} ry={5} fill={fountain.water} opacity={0.85} />
      <ellipse cx={-3} cy={-31} rx={4} ry={2} fill={fountain.waterLight} opacity={0.5} />

      {/* Water spout (animated) */}
      <ellipse cx={0} cy={-38} rx={4} ry={8} fill={fountain.waterLight} opacity={0.7} className="animate-float" />

      {/* Water droplets */}
      <circle cx={-8} cy={-18} r={2.5} fill={fountain.waterLight} opacity={0.6} className="animate-sparkle" />
      <circle cx={8} cy={-15} r={2} fill={fountain.waterLight} opacity={0.5} className="animate-sparkle" style={{ animationDelay: '0.5s' }} />
      <circle cx={-3} cy={-12} r={2} fill={fountain.waterLight} opacity={0.6} className="animate-sparkle" style={{ animationDelay: '1s' }} />
      <circle cx={5} cy={-20} r={1.5} fill={fountain.waterLight} opacity={0.5} className="animate-sparkle" style={{ animationDelay: '0.3s' }} />
    </g>
  );
}

// Cute flower patch
function FlowerPatch({ x, y }: { x: number; y: number }) {
  const flowers = CARTOON_PALETTE.decorations.flowers;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Grass base */}
      <ellipse cx={0} cy={2} rx={12} ry={6} fill="hsl(130, 50%, 58%)" />

      {/* Cute flowers */}
      <Flower cx={-5} cy={-8} color={flowers[0]} size={1} />
      <Flower cx={5} cy={-6} color={flowers[1]} size={0.8} />
      <Flower cx={0} cy={-12} color={flowers[2]} size={1.1} />
      <Flower cx={-8} cy={-4} color={flowers[3]} size={0.7} />
      <Flower cx={7} cy={-10} color={flowers[4]} size={0.9} />

      {/* Small grass tufts */}
      <path d="M-3,0 Q-4,-6 -2,-4" stroke="hsl(130, 55%, 50%)" strokeWidth={1.5} fill="none" />
      <path d="M3,0 Q5,-5 2,-3" stroke="hsl(130, 55%, 50%)" strokeWidth={1.5} fill="none" />
    </g>
  );
}

// Individual cute flower
function Flower({ cx, cy, color, size }: { cx: number; cy: number; color: string; size: number }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${size})`} className="animate-sway-gentle">
      {/* Stem */}
      <path d={`M0,8 Q-1,4 0,0`} stroke="hsl(130, 50%, 45%)" strokeWidth={1.5} fill="none" />

      {/* Petals (5 circles around center) */}
      <circle cx={0} cy={-4} r={3} fill={color} />
      <circle cx={3} cy={-1} r={3} fill={color} />
      <circle cx={2} cy={3} r={3} fill={color} />
      <circle cx={-2} cy={3} r={3} fill={color} />
      <circle cx={-3} cy={-1} r={3} fill={color} />

      {/* Center */}
      <circle cx={0} cy={0} r={2.5} fill="hsl(45, 90%, 65%)" />
      <circle cx={-0.5} cy={-0.5} r={1} fill="hsl(45, 95%, 75%)" opacity={0.8} />
    </g>
  );
}

// Cute fluffy bush with optional berries
function CuteBush({ x, y, variant }: { x: number; y: number; variant?: string }) {
  const bush = CARTOON_PALETTE.decorations.bush;
  const hasBerries = variant === 'berries';

  return (
    <g transform={`translate(${x}, ${y})`} className="animate-sway-gentle" style={{ transformOrigin: `${x}px ${y}px` }}>
      {/* Main bush shape (overlapping circles for fluffy look) */}
      <ellipse cx={0} cy={-2} rx={12} ry={10} fill={bush.main} />
      <circle cx={-8} cy={-5} r={8} fill={bush.main} />
      <circle cx={8} cy={-4} r={9} fill={bush.main} />
      <circle cx={0} cy={-10} r={7} fill={bush.light} />
      <circle cx={-5} cy={-8} r={6} fill={bush.light} />
      <circle cx={6} cy={-7} r={5} fill={bush.light} />

      {/* Highlight spots */}
      <circle cx={-3} cy={-12} r={3} fill="hsl(130, 55%, 70%)" opacity={0.7} />
      <circle cx={5} cy={-10} r={2.5} fill="hsl(130, 55%, 70%)" opacity={0.6} />

      {/* Berries if variant */}
      {hasBerries && (
        <>
          <circle cx={-6} cy={-3} r={2.5} fill={bush.berry} />
          <circle cx={-4} cy={-6} r={2} fill={bush.berry} />
          <circle cx={7} cy={-2} r={2.5} fill={bush.berry} />
          <circle cx={5} cy={-5} r={2} fill={bush.berry} />
          <circle cx={0} cy={-4} r={2} fill={bush.berry} />
          {/* Berry highlights */}
          <circle cx={-6.5} cy={-3.5} r={0.8} fill="hsl(350, 70%, 75%)" opacity={0.8} />
          <circle cx={6.5} cy={-2.5} r={0.8} fill="hsl(350, 70%, 75%)" opacity={0.8} />
        </>
      )}
    </g>
  );
}

// Cute spotted mushroom
function CuteMushroom({ x, y }: { x: number; y: number }) {
  const mushroom = CARTOON_PALETTE.decorations.mushroom;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Stem */}
      <path
        d="M-4,4 Q-5,-2 -3,-8 L3,-8 Q5,-2 4,4 Z"
        fill={mushroom.stem}
        stroke={mushroom.stemDark}
        strokeWidth={0.5}
      />

      {/* Stem ring detail */}
      <ellipse cx={0} cy={-2} rx={4} ry={1.5} fill={mushroom.stemDark} opacity={0.4} />

      {/* Cap */}
      <ellipse cx={0} cy={-12} rx={12} ry={8} fill={mushroom.cap} />
      <ellipse cx={0} cy={-8} rx={10} ry={3} fill={mushroom.stem} />

      {/* Cap spots */}
      <circle cx={-5} cy={-14} r={2.5} fill={mushroom.capSpots} />
      <circle cx={4} cy={-16} r={2} fill={mushroom.capSpots} />
      <circle cx={-2} cy={-17} r={1.5} fill={mushroom.capSpots} />
      <circle cx={7} cy={-12} r={1.8} fill={mushroom.capSpots} />
      <circle cx={-8} cy={-10} r={1.5} fill={mushroom.capSpots} />

      {/* Highlight */}
      <ellipse cx={-4} cy={-15} rx={3} ry={2} fill="hsl(10, 75%, 75%)" opacity={0.5} />
    </g>
  );
}

// Cute birdhouse on a pole
function CuteBirdhouse({ x, y }: { x: number; y: number }) {
  const birdhouse = CARTOON_PALETTE.decorations.birdhouse;

  return (
    <g transform={`translate(${x}, ${y})`} className="animate-sway-gentle" style={{ transformOrigin: `${x}px ${y}px` }}>
      {/* Pole */}
      <rect x={-2} y={-45} width={4} height={50} rx={1} fill={birdhouse.wood} />
      <rect x={-1.5} y={-45} width={1.5} height={50} fill={birdhouse.woodDark} opacity={0.3} />

      {/* House body */}
      <rect x={-10} y={-60} width={20} height={18} rx={2} fill={birdhouse.wood} />
      <rect x={-9} y={-59} width={8} height={16} fill="hsl(25, 55%, 65%)" opacity={0.5} />

      {/* Roof */}
      <path
        d="M-14,-60 L0,-72 L14,-60 Z"
        fill={birdhouse.roof}
        stroke="hsl(15, 50%, 45%)"
        strokeWidth={0.5}
      />
      <path
        d="M-12,-60 L0,-70 L0,-60 Z"
        fill="hsl(15, 60%, 62%)"
        opacity={0.5}
      />

      {/* Entrance hole */}
      <circle cx={0} cy={-52} r={4} fill={birdhouse.hole} />
      <circle cx={-1} cy={-53} r={1.5} fill="hsl(25, 30%, 35%)" opacity={0.5} />

      {/* Perch */}
      <rect x={-1} y={-48} width={2} height={6} rx={1} fill={birdhouse.perch} />
      <circle cx={0} cy={-42} r={2} fill={birdhouse.perch} />

      {/* Small bird sitting on perch (optional cute detail) */}
      <ellipse cx={3} cy={-44} rx={4} ry={3} fill="hsl(45, 70%, 65%)" />
      <circle cx={5} cy={-46} r={2.5} fill="hsl(45, 75%, 70%)" />
      <path d="M7,-46 L10,-45" stroke="hsl(35, 60%, 55%)" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={5.5} cy={-46.5} r={0.8} fill="hsl(25, 30%, 20%)" />
    </g>
  );
}

// Cute rounded rocks
function CuteRock({ x, y, variant }: { x: number; y: number; variant?: string }) {
  const rock = CARTOON_PALETTE.decorations.rock;
  const isSmall = variant === 'small';
  const scale = isSmall ? 0.6 : 1;

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {/* Main rock (organic blob shape) */}
      <path
        d="M-12,2 Q-14,-5 -8,-10 Q0,-14 10,-8 Q15,-3 12,2 Q5,6 -5,5 Z"
        fill={rock.main}
        stroke={rock.dark}
        strokeWidth={0.5}
      />

      {/* Highlight */}
      <path
        d="M-6,-8 Q-2,-12 4,-9 Q6,-6 2,-5 Q-3,-4 -6,-8 Z"
        fill={rock.light}
        opacity={0.7}
      />

      {/* Small texture details */}
      <circle cx={-3} cy={-5} r={1} fill={rock.light} opacity={0.5} />
      <circle cx={5} cy={-3} r={0.8} fill={rock.light} opacity={0.4} />

      {/* Small moss/grass tuft on rock */}
      <path d="M-5,1 Q-6,-3 -4,-1" stroke="hsl(130, 45%, 50%)" strokeWidth={1.5} fill="none" />
      <path d="M-3,2 Q-2,-2 -1,0" stroke="hsl(130, 50%, 55%)" strokeWidth={1} fill="none" />
    </g>
  );
}

// Cute animated butterfly
function CuteButterfly({ x, y, variant }: { x: number; y: number; variant?: string }) {
  const colors = CARTOON_PALETTE.decorations.butterfly;
  const colorIndex = variant ? parseInt(variant) % colors.length : Math.floor(Math.random() * colors.length);
  const wingColor = colors[colorIndex];

  return (
    <g transform={`translate(${x}, ${y})`} className="animate-float" style={{ animationDuration: '3s' }}>
      {/* Body */}
      <ellipse cx={0} cy={0} rx={2} ry={5} fill="hsl(35, 40%, 35%)" />

      {/* Head */}
      <circle cx={0} cy={-6} r={2.5} fill="hsl(35, 40%, 35%)" />

      {/* Antennae */}
      <path d="M-1,-8 Q-3,-12 -4,-11" stroke="hsl(35, 35%, 30%)" strokeWidth={0.8} fill="none" />
      <path d="M1,-8 Q3,-12 4,-11" stroke="hsl(35, 35%, 30%)" strokeWidth={0.8} fill="none" />
      <circle cx={-4} cy={-11} r={1} fill="hsl(35, 40%, 40%)" />
      <circle cx={4} cy={-11} r={1} fill="hsl(35, 40%, 40%)" />

      {/* Wings (with flutter animation via scale) */}
      <g className="animate-sway" style={{ transformOrigin: '0 0', animationDuration: '0.3s' }}>
        {/* Left wings */}
        <ellipse cx={-10} cy={-3} rx={8} ry={6} fill={wingColor} opacity={0.9} />
        <ellipse cx={-8} cy={4} rx={5} ry={4} fill={wingColor} opacity={0.85} />
        <ellipse cx={-9} cy={-4} rx={4} ry={3} fill="white" opacity={0.4} />
        <circle cx={-10} cy={-2} r={2} fill="white" opacity={0.5} />

        {/* Right wings */}
        <ellipse cx={10} cy={-3} rx={8} ry={6} fill={wingColor} opacity={0.9} />
        <ellipse cx={8} cy={4} rx={5} ry={4} fill={wingColor} opacity={0.85} />
        <ellipse cx={9} cy={-4} rx={4} ry={3} fill="white" opacity={0.4} />
        <circle cx={10} cy={-2} r={2} fill="white" opacity={0.5} />
      </g>
    </g>
  );
}
