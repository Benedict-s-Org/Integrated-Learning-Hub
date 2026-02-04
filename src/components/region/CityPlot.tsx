import type { RegionPlot } from '@/types/region';
import { CITY_LEVEL_COLORS, PLOT_TYPE_COLORS, REGION_CONFIG } from '@/constants/regionConfig';

interface CityPlotProps {
  plot: RegionPlot;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (plotId: string) => void;
  onHover: (plotId: string | null) => void;
}

export function CityPlot({ plot, isSelected, isHovered, onSelect, onHover }: CityPlotProps) {
  const { tileWidth, tileHeight } = REGION_CONFIG;

  // Calculate isometric position
  const isoX = (plot.position.x - plot.position.y) * (tileWidth / 2);
  const isoY = (plot.position.x + plot.position.y) * (tileHeight / 2);

  // Get color based on plot type and city level
  const getPlotColor = () => {
    if (plot.plotType === 'city' && plot.cityLevel) {
      return CITY_LEVEL_COLORS[plot.cityLevel as keyof typeof CITY_LEVEL_COLORS] || CITY_LEVEL_COLORS[1];
    }
    return PLOT_TYPE_COLORS[plot.plotType];
  };

  const baseColor = getPlotColor();
  const plotWidth = plot.size.width * tileWidth;
  const plotDepth = plot.size.depth * tileHeight;

  // Create isometric diamond path for the plot
  const createIsometricPath = () => {
    const halfW = plotWidth / 2;
    const halfD = plotDepth / 2;
    return `M 0 ${halfD} L ${halfW} 0 L ${plotWidth} ${halfD} L ${halfW} ${plotDepth} Z`;
  };

  return (
    <g
      transform={`translate(${isoX}, ${isoY})`}
      onClick={() => onSelect(plot.id)}
      onMouseEnter={() => onHover(plot.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Plot ground with soft rounded look */}
      <path
        d={createIsometricPath()}
        fill={baseColor}
        stroke={isSelected ? '#5D4037' : isHovered ? '#8D6E63' : '#E2E8F0'}
        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
        strokeLinejoin="round"
        opacity={plot.plotType === 'empty' ? 0.6 : 1}
        filter="drop-shadow(0 4px 6px rgba(93, 64, 55, 0.1))"
      />

      {/* City building representation - Chunky & Cute */}
      {plot.plotType === 'city' && (
        <g transform={`translate(${plotWidth / 2}, ${plotDepth / 2.5})`}>
          {/* Main House Body - Rounded & Pastel */}
          <rect
            x={-18}
            y={-22}
            width={36}
            height={28}
            rx={4}
            fill="#FFDAC1" // Soft Peach
            stroke="#8D6E63" // Milk Chocolate
            strokeWidth={2}
          />
          {/* Roof - Soft Red */}
          <path
            d="M -22 -22 L 0 -38 L 22 -22 Z"
            fill="#FFB7B2" // Pastel Red
            stroke="#8D6E63"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Door - Cute contrast */}
          <rect
            x={-6}
            y={-10}
            width={12}
            height={16}
            rx={2}
            fill="#C7CEEA" // Periwinkle
            stroke="#8D6E63"
            strokeWidth={1.5}
          />

          {/* City level badge - Soft bubble style */}
          {plot.cityLevel && (
            <g transform="translate(20, -35)">
              <circle r={12} fill="#B5EAD7" stroke="#8D6E63" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="#5D4037"
                fontSize={11}
                fontWeight="800"
              >
                {plot.cityLevel}
              </text>
            </g>
          )}
        </g>
      )}

      {/* Empty plot indicator - Soft text */}
      {plot.plotType === 'empty' && (
        <text
          x={plotWidth / 2}
          y={plotDepth / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#8D6E63"
          fontSize={12}
          fontWeight="500"
          opacity={0.7}
        >
          空地
        </text>
      )}

      {/* City name label - Darker Morandi brown */}
      {plot.cityName && (
        <text
          x={plotWidth / 2}
          y={plotDepth + 5}
          textAnchor="middle"
          fill="#5D4037"
          fontSize={11}
          fontWeight="600"
          style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
        >
          {plot.cityName}
        </text>
      )}

      {/* Hover tooltip area - Glassmorphism style */}
      {isHovered && plot.plotType === 'city' && (
        <g transform={`translate(${plotWidth / 2}, -50)`}>
          <rect
            x={-60}
            y={-25}
            width={120}
            height={45}
            rx={10}
            fill="rgba(255, 255, 255, 0.95)"
            stroke="#B5EAD7"
            strokeWidth={2}
            filter="drop-shadow(0 4px 10px rgba(93, 64, 55, 0.1))"
          />
          <text
            textAnchor="middle"
            y={-7}
            fill="#5D4037"
            fontSize={12}
            fontWeight="bold"
          >
            {plot.cityName || '未命名城市'}
          </text>
          <text
            textAnchor="middle"
            y={10}
            fill="#8D6E63"
            fontSize={10}
          >
            等級 {plot.cityLevel || 1}
          </text>
        </g>
      )}
    </g>
  );
}
