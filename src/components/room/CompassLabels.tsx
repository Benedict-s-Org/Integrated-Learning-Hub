import React from "react";
import { IsoPoint } from "@/types/room";

interface CompassLabelsProps {
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
}

export const CompassLabels: React.FC<CompassLabelsProps> = ({
  gridSize,
  toIso,
}) => {
  const labelStyle: React.SVGTextElementAttributes<SVGTextElement> = {
    fontSize: "14px",
    fontWeight: "bold",
    fill: "#5D4037",
    fontFamily: "monospace",
    textAnchor: "middle",
    dominantBaseline: "middle",
  };

  const nPos = toIso(0, gridSize / 2);
  const ePos = toIso(gridSize / 2, 0);
  const sPos = toIso(gridSize, gridSize / 2);
  const wPos = toIso(gridSize / 2, gridSize);

  return (
    <g className="select-none pointer-events-none">
      <text x={nPos.x - 40} y={nPos.y - 15} {...labelStyle}>
        北 (N)
      </text>
      <text x={ePos.x + 40} y={ePos.y - 15} {...labelStyle}>
        東 (E)
      </text>
      <text x={sPos.x + 40} y={sPos.y + 25} {...labelStyle}>
        南 (S)
      </text>
      <text x={wPos.x - 40} y={wPos.y + 25} {...labelStyle}>
        西 (W)
      </text>
    </g>
  );
};
