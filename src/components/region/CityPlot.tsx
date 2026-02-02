import React from 'react';
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
      return CITY_LEVEL_COLORS[plot.cityLevel] || CITY_LEVEL_COLORS[1];
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
      {/* Plot ground */}
      <path
        d={createIsometricPath()}
        fill={baseColor}
        stroke={isSelected ? 'hsl(var(--primary))' : isHovered ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
        opacity={plot.plotType === 'empty' ? 0.5 : 0.9}
      />
      
      {/* City building representation */}
      {plot.plotType === 'city' && (
        <g transform={`translate(${plotWidth / 2}, ${plotDepth / 3})`}>
          {/* Simple house icon */}
          <rect
            x={-15}
            y={-20}
            width={30}
            height={25}
            fill="hsl(30, 40%, 60%)"
            stroke="hsl(30, 30%, 40%)"
            strokeWidth={1}
          />
          <polygon
            points="-20,-20 0,-35 20,-20"
            fill="hsl(15, 60%, 45%)"
            stroke="hsl(15, 50%, 35%)"
            strokeWidth={1}
          />
          {/* City level badge */}
          {plot.cityLevel && (
            <g transform="translate(20, -30)">
              <circle r={10} fill="hsl(var(--primary))" />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={10}
                fontWeight="bold"
              >
                {plot.cityLevel}
              </text>
            </g>
          )}
        </g>
      )}

      {/* Empty plot indicator */}
      {plot.plotType === 'empty' && (
        <text
          x={plotWidth / 2}
          y={plotDepth / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="hsl(var(--muted-foreground))"
          fontSize={12}
          opacity={0.6}
        >
          空地
        </text>
      )}

      {/* City name label */}
      {plot.cityName && (
        <text
          x={plotWidth / 2}
          y={plotDepth - 5}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontSize={10}
          fontWeight="500"
        >
          {plot.cityName}
        </text>
      )}

      {/* Hover tooltip area */}
      {isHovered && plot.plotType === 'city' && (
        <g transform={`translate(${plotWidth / 2}, -45)`}>
          <rect
            x={-50}
            y={-20}
            width={100}
            height={40}
            rx={4}
            fill="hsl(var(--popover))"
            stroke="hsl(var(--border))"
          />
          <text
            textAnchor="middle"
            y={-5}
            fill="hsl(var(--popover-foreground))"
            fontSize={11}
            fontWeight="bold"
          >
            {plot.cityName || '未命名城市'}
          </text>
          <text
            textAnchor="middle"
            y={10}
            fill="hsl(var(--muted-foreground))"
            fontSize={9}
          >
            等級 {plot.cityLevel || 1}
          </text>
        </g>
      )}
    </g>
  );
}
