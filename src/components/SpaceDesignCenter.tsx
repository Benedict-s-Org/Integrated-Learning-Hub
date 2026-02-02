import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Grid,
  Layout,
  Plus,
  Trash2,
  RotateCcw,
  RotateCw,
  Save,
  Package,
  Eye,
  Edit,
  ChevronLeft,
  Hammer,
  Move,
  X,
  Check,
  Settings,
  Undo,
  Redo,
  Store,
  Send,
  DoorOpen,
} from "lucide-react";
import { useRoomLayout } from "@/hooks/useRoomLayout";
import { useBlueprints, Blueprint } from "@/hooks/useBlueprints";
import {
  Chunk,
  toIso,
  fromIso,
  chunksToTiles,
  isTileActive,
  DoorPlacement,
  WallSegment,
  splitSegmentForDoors,
  getWallSegmentPath,
  DOOR_CATALOG,
  buildConnectivityGraph,
} from "@/utils/roomGeometry";

interface SpaceDesignCenterProps {
  onClose: () => void;
  fullCatalog?: any[];
  activeWall: any;
  activeFloor: any;
  customWalls?: any[];
  customFloors?: any[];
  activeWallId?: string | null;
  activeFloorId?: string | null;
  onSelectWall?: (id: string | null) => void;
  onSelectFloor?: (id: string | null) => void;
}

type TabMode = "admin-test" | "blueprint";
type ToolMode = "select" | "build" | "remove" | "place-furniture" | "place-wall-decor" | "place-door";

export function SpaceDesignCenter({
  onClose,
  fullCatalog,
  activeWall,
  activeFloor,
  customWalls,
  customFloors,
  onSelectWall,
  onSelectFloor,
}: SpaceDesignCenterProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("admin-test");
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selectedFurniture, setSelectedFurniture] = useState<any>(null);
  const [draggingRotation, setDraggingRotation] = useState(0);

  // Room layout hook - different storage for test vs blueprint
  const testLayout = useRoomLayout("mp_test_room_chunks");
  const blueprintLayout = useRoomLayout("mp_blueprint_room_chunks");
  const currentLayout = activeTab === "admin-test" ? testLayout : blueprintLayout;

  // Blueprints
  const { blueprints, createBlueprint, updateBlueprint, deleteBlueprint, publishBlueprint, unpublishBlueprint } =
    useBlueprints();
  const [editingBlueprint, setEditingBlueprint] = useState<Blueprint | null>(null);
  const [blueprintName, setBlueprintName] = useState("");
  const [blueprintPrice, setBlueprintPrice] = useState(100);
  const [blueprintDesc, setBlueprintDesc] = useState("");

  // Placements state (separate for test and blueprint modes)
  const [testPlacements, setTestPlacements] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_test_placements");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [blueprintPlacements, setBlueprintPlacements] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_blueprint_placements");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const placements = activeTab === "admin-test" ? testPlacements : blueprintPlacements;
  const setPlacements = activeTab === "admin-test" ? setTestPlacements : setBlueprintPlacements;

  // Wall placements
  const [testWallPlacements, setTestWallPlacements] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_test_wall_placements");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [blueprintWallPlacements, setBlueprintWallPlacements] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_blueprint_wall_placements");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const wallPlacements = activeTab === "admin-test" ? testWallPlacements : blueprintWallPlacements;
  const setWallPlacements = activeTab === "admin-test" ? setTestWallPlacements : setBlueprintWallPlacements;

  // Door placements state
  const [testDoors, setTestDoors] = useState<DoorPlacement[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_test_doors");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [blueprintDoors, setBlueprintDoors] = useState<DoorPlacement[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mp_blueprint_doors");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const doors = activeTab === "admin-test" ? testDoors : blueprintDoors;
  const setDoors = activeTab === "admin-test" ? setTestDoors : setBlueprintDoors;

  // Selected door type for placement
  const [selectedDoor, setSelectedDoor] = useState<(typeof DOOR_CATALOG)[0] | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<{ segment: WallSegment; position: number } | null>(null);

  // Canvas state
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredChunk, setHoveredChunk] = useState<Chunk | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Save placements to localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mp_test_placements", JSON.stringify(testPlacements));
      localStorage.setItem("mp_blueprint_placements", JSON.stringify(blueprintPlacements));
      localStorage.setItem("mp_test_wall_placements", JSON.stringify(testWallPlacements));
      localStorage.setItem("mp_blueprint_wall_placements", JSON.stringify(blueprintWallPlacements));
      localStorage.setItem("mp_test_doors", JSON.stringify(testDoors));
      localStorage.setItem("mp_blueprint_doors", JSON.stringify(blueprintDoors));
    }
  }, [testPlacements, blueprintPlacements, testWallPlacements, blueprintWallPlacements, testDoors, blueprintDoors]);

  // Connectivity graph
  const connectivityGraph = useMemo(() => {
    return buildConnectivityGraph(currentLayout.roomChunks, doors, currentLayout.wallSegments);
  }, [currentLayout.roomChunks, doors, currentLayout.wallSegments]);

  const tileWidth = 40;
  const tileHeight = 20;
  const wallHeight = 180;

  const toIsoLocal = (x: number, y: number) => toIso(x, y, tileWidth, tileHeight);
  const fromIsoLocal = (sx: number, sy: number) => fromIso(sx, sy, tileWidth, tileHeight);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && toolMode === "select") {
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }

    // Update hovered chunk/tile
    if (svgRef.current && (toolMode === "build" || toolMode === "place-furniture")) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * 800 - 400 - offset.x;
      const svgY = ((e.clientY - rect.top) / rect.height) * 600 - 300 - offset.y;
      const gridCoords = fromIsoLocal(svgX, svgY);

      if (toolMode === "build") {
        // Snap to 2x2 chunk grid
        const chunkX = Math.floor(gridCoords.x / 2) * 2;
        const chunkY = Math.floor(gridCoords.y / 2) * 2;
        setHoveredChunk({ cx: chunkX, cy: chunkY });
      } else if (toolMode === "place-furniture") {
        const tileX = Math.floor(gridCoords.x);
        const tileY = Math.floor(gridCoords.y);
        setHoveredTile({ x: tileX, y: tileY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);

    if (toolMode === "build" && hoveredChunk) {
      const isExpandable = currentLayout.expandableChunks.some(
        (c) => c.cx === hoveredChunk.cx && c.cy === hoveredChunk.cy,
      );
      const isExisting = currentLayout.roomChunks.some((c) => c.cx === hoveredChunk.cx && c.cy === hoveredChunk.cy);

      if (isExpandable || currentLayout.roomChunks.length === 0) {
        currentLayout.addChunk(hoveredChunk);
      } else if (isExisting && currentLayout.roomChunks.length > 1) {
        // Could add remove functionality here
      }
    }

    if (toolMode === "place-furniture" && hoveredTile && selectedFurniture) {
      const isValid = isTileActive(currentLayout.activeTiles, hoveredTile.x, hoveredTile.y);
      if (isValid) {
        const newPlacement = {
          id: crypto.randomUUID(),
          furnitureId: selectedFurniture.id,
          x: hoveredTile.x,
          y: hoveredTile.y,
          rotation: draggingRotation,
        };
        setPlacements((prev) => [...prev, newPlacement]);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (toolMode === "place-furniture") {
      setDraggingRotation((prev) => (prev + 1) % 4);
    }
  };

  // Render chunks
  const renderChunks = () => {
    const elements: React.ReactNode[] = [];

    // Render existing chunks
    currentLayout.roomChunks.forEach((chunk, idx) => {
      const tiles = [];
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          const x = chunk.cx + dx;
          const y = chunk.cy + dy;
          const tl = toIsoLocal(x, y);
          const tr = toIsoLocal(x + 1, y);
          const br = toIsoLocal(x + 1, y + 1);
          const bl = toIsoLocal(x, y + 1);

          tiles.push(
            <path
              key={`chunk-${idx}-tile-${dx}-${dy}`}
              d={`M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`}
              fill="#E8D5B7"
              stroke="#C4A882"
              strokeWidth={0.5}
            />,
          );
        }
      }
      elements.push(<g key={`chunk-${idx}`}>{tiles}</g>);
    });

    // Render expandable chunks (ghost preview)
    if (toolMode === "build") {
      currentLayout.expandableChunks.forEach((chunk, idx) => {
        const isHovered = hoveredChunk?.cx === chunk.cx && hoveredChunk?.cy === chunk.cy;
        const tl = toIsoLocal(chunk.cx, chunk.cy);
        const tr = toIsoLocal(chunk.cx + 2, chunk.cy);
        const br = toIsoLocal(chunk.cx + 2, chunk.cy + 2);
        const bl = toIsoLocal(chunk.cx, chunk.cy + 2);

        elements.push(
          <path
            key={`expandable-${idx}`}
            d={`M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`}
            fill={isHovered ? "rgba(52, 211, 153, 0.4)" : "rgba(52, 211, 153, 0.15)"}
            stroke={isHovered ? "#10b981" : "#34d399"}
            strokeWidth={2}
            strokeDasharray={isHovered ? "0" : "6 3"}
            style={{ cursor: "pointer" }}
          />,
        );

        // Plus icon for expandable
        const center = toIsoLocal(chunk.cx + 1, chunk.cy + 1);
        elements.push(
          <g key={`expand-icon-${idx}`} transform={`translate(${center.x}, ${center.y})`}>
            <circle r={12} fill={isHovered ? "#10b981" : "#34d399"} opacity={0.8} />
            <line x1={-5} y1={0} x2={5} y2={0} stroke="white" strokeWidth={2} />
            <line x1={0} y1={-5} x2={0} y2={5} stroke="white" strokeWidth={2} />
          </g>,
        );
      });
    }

    return elements;
  };

  // Render walls with door cutouts
  const renderWalls = () => {
    const { bounds, wallSegments } = currentLayout;
    const elements: React.ReactNode[] = [];

    // Simple wall rendering based on bounds
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ];
    const screenCorners = corners.map((c) => ({ ...c, pos: toIsoLocal(c.x, c.y) }));

    // Find back corner (highest on screen = lowest y)
    let backIdx = 0;
    let minY = Infinity;
    screenCorners.forEach((c, i) => {
      if (c.pos.y < minY) {
        minY = c.pos.y;
        backIdx = i;
      }
    });

    const prevIdx = (backIdx - 1 + 4) % 4;
    const nextIdx = (backIdx + 1) % 4;
    const back = screenCorners[backIdx];
    const prev = screenCorners[prevIdx];
    const next = screenCorners[nextIdx];

    // Check for doors on each wall
    const leftWallDoors = doors.filter((d) => d.segmentId.startsWith("left-"));
    const rightWallDoors = doors.filter((d) => d.segmentId.startsWith("right-"));

    // Calculate door cutout height (70% of wall height)
    const doorHeight = wallHeight * 0.7;
    const doorTopOffset = wallHeight - doorHeight;

    // Left wall - with door cutouts
    if (leftWallDoors.length > 0) {
      // Wall with door cutouts - render as multiple segments
      const wallLength = Math.abs(prev.pos.x - back.pos.x) + Math.abs(prev.pos.y - back.pos.y);
      leftWallDoors.forEach((door, idx) => {
        const doorRatio = door.position / 4; // Assuming 4 tiles per wall segment
        const doorWidthRatio = door.width / 4;

        // Door frame
        const doorStartX = back.pos.x + (prev.pos.x - back.pos.x) * doorRatio;
        const doorStartY = back.pos.y + (prev.pos.y - back.pos.y) * doorRatio;
        const doorEndX = back.pos.x + (prev.pos.x - back.pos.x) * (doorRatio + doorWidthRatio);
        const doorEndY = back.pos.y + (prev.pos.y - back.pos.y) * (doorRatio + doorWidthRatio);

        // Render door frame
        elements.push(
          <g key={`left-door-${idx}`}>
            {/* Door opening (darker background) */}
            <path
              d={`M${doorStartX} ${doorStartY} L${doorEndX} ${doorEndY} L${doorEndX} ${doorEndY - doorHeight} L${doorStartX} ${doorStartY - doorHeight} Z`}
              fill="#2d3748"
              opacity={0.8}
            />
            {/* Door frame */}
            <line
              x1={doorStartX}
              y1={doorStartY}
              x2={doorStartX}
              y2={doorStartY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            <line
              x1={doorEndX}
              y1={doorEndY}
              x2={doorEndX}
              y2={doorEndY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            <line
              x1={doorStartX}
              y1={doorStartY - doorHeight}
              x2={doorEndX}
              y2={doorEndY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            {/* Door panel */}
            <path
              d={`M${doorStartX + 2} ${doorStartY - 2} L${doorEndX - 2} ${doorEndY - 2} L${doorEndX - 2} ${doorEndY - doorHeight + 2} L${doorStartX + 2} ${doorStartY - doorHeight + 2} Z`}
              fill="#A0522D"
              opacity={0.9}
            />
          </g>,
        );
      });

      // Render wall sections around doors
      elements.push(
        <path
          key="left-wall"
          d={`M${back.pos.x} ${back.pos.y} L${prev.pos.x} ${prev.pos.y} L${prev.pos.x} ${prev.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="#5DC9BF"
          opacity={0.95}
          style={{ pointerEvents: "none" }}
        />,
      );
    } else {
      // Left wall without doors
      elements.push(
        <path
          key="left-wall"
          d={`M${back.pos.x} ${back.pos.y} L${prev.pos.x} ${prev.pos.y} L${prev.pos.x} ${prev.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="#5DC9BF"
          opacity={0.95}
        />,
      );
    }

    // Right wall - with door cutouts
    if (rightWallDoors.length > 0) {
      rightWallDoors.forEach((door, idx) => {
        const doorRatio = door.position / 4;
        const doorWidthRatio = door.width / 4;

        const doorStartX = back.pos.x + (next.pos.x - back.pos.x) * doorRatio;
        const doorStartY = back.pos.y + (next.pos.y - back.pos.y) * doorRatio;
        const doorEndX = back.pos.x + (next.pos.x - back.pos.x) * (doorRatio + doorWidthRatio);
        const doorEndY = back.pos.y + (next.pos.y - back.pos.y) * (doorRatio + doorWidthRatio);

        elements.push(
          <g key={`right-door-${idx}`}>
            <path
              d={`M${doorStartX} ${doorStartY} L${doorEndX} ${doorEndY} L${doorEndX} ${doorEndY - doorHeight} L${doorStartX} ${doorStartY - doorHeight} Z`}
              fill="#2d3748"
              opacity={0.8}
            />
            <line
              x1={doorStartX}
              y1={doorStartY}
              x2={doorStartX}
              y2={doorStartY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            <line
              x1={doorEndX}
              y1={doorEndY}
              x2={doorEndX}
              y2={doorEndY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            <line
              x1={doorStartX}
              y1={doorStartY - doorHeight}
              x2={doorEndX}
              y2={doorEndY - doorHeight}
              stroke="#8B4513"
              strokeWidth={3}
            />
            <path
              d={`M${doorStartX + 2} ${doorStartY - 2} L${doorEndX - 2} ${doorEndY - 2} L${doorEndX - 2} ${doorEndY - doorHeight + 2} L${doorStartX + 2} ${doorStartY - doorHeight + 2} Z`}
              fill="#A0522D"
              opacity={0.9}
            />
          </g>,
        );
      });

      elements.push(
        <path
          key="right-wall"
          d={`M${back.pos.x} ${back.pos.y} L${next.pos.x} ${next.pos.y} L${next.pos.x} ${next.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="#4DB6AC"
          opacity={0.95}
          style={{ pointerEvents: "none" }}
        />,
      );
    } else {
      elements.push(
        <path
          key="right-wall"
          d={`M${back.pos.x} ${back.pos.y} L${next.pos.x} ${next.pos.y} L${next.pos.x} ${next.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="#4DB6AC"
          opacity={0.95}
        />,
      );
    }

    // Corner line
    elements.push(
      <line
        key="corner-line"
        x1={back.pos.x}
        y1={back.pos.y}
        x2={back.pos.x}
        y2={back.pos.y - wallHeight}
        stroke="#7DD4CA"
        strokeWidth={2}
      />,
    );

    // Wall click zones for door placement
    if (toolMode === "place-door" && selectedDoor) {
      // Left wall click zone
      elements.push(
        <path
          key="left-wall-zone"
          d={`M${back.pos.x} ${back.pos.y} L${prev.pos.x} ${prev.pos.y} L${prev.pos.x} ${prev.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="rgba(251, 191, 36, 0.3)"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="5 3"
          style={{ cursor: "pointer" }}
          onClick={() => {
            const newDoor: DoorPlacement = {
              id: crypto.randomUUID(),
              segmentId: "left-main",
              position: 1,
              doorType: selectedDoor.id,
              width: selectedDoor.width,
            };
            setDoors((prev) => [...prev, newDoor]);
          }}
        />,
      );

      // Right wall click zone
      elements.push(
        <path
          key="right-wall-zone"
          d={`M${back.pos.x} ${back.pos.y} L${next.pos.x} ${next.pos.y} L${next.pos.x} ${next.pos.y - wallHeight} L${back.pos.x} ${back.pos.y - wallHeight} Z`}
          fill="rgba(251, 191, 36, 0.3)"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="5 3"
          style={{ cursor: "pointer" }}
          onClick={() => {
            const newDoor: DoorPlacement = {
              id: crypto.randomUUID(),
              segmentId: "right-main",
              position: 1,
              doorType: selectedDoor.id,
              width: selectedDoor.width,
            };
            setDoors((prev) => [...prev, newDoor]);
          }}
        />,
      );
    }

    return <g>{elements}</g>;
  };

  // Render furniture placements
  const renderFurniture = () => {
    return placements.map((p) => {
      const item = fullCatalog.find((f) => f.id === p.furnitureId);
      if (!item) return null;

      const [w, d] = item.size;
      const effectiveW = p.rotation % 2 === 0 ? w : d;
      const effectiveD = p.rotation % 2 === 0 ? d : w;
      const center = toIsoLocal(p.x + effectiveW / 2, p.y + effectiveD / 2);

      if (item.type === "sprite" && item.spriteImages) {
        const imgSrc = item.spriteImages[p.rotation % 4];
        const baseSize = Math.max(effectiveW, effectiveD) * 70;
        const scale = item.spriteScale ?? 1;
        const imgWidth = baseSize * scale;

        return (
          <image
            key={p.id}
            href={imgSrc}
            x={center.x - imgWidth / 2 + (item.spriteOffsetX ?? 0)}
            y={center.y - imgWidth + (item.spriteOffsetY ?? 20)}
            width={imgWidth}
            height={imgWidth}
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (toolMode === "remove") {
                setPlacements((prev) => prev.filter((pl) => pl.id !== p.id));
              }
            }}
          />
        );
      }

      // Default box rendering
      const tl = toIsoLocal(p.x, p.y);
      const tr = toIsoLocal(p.x + effectiveW, p.y);
      const br = toIsoLocal(p.x + effectiveW, p.y + effectiveD);
      const bl = toIsoLocal(p.x, p.y + effectiveD);

      return (
        <g
          key={p.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (toolMode === "remove") {
              setPlacements((prev) => prev.filter((pl) => pl.id !== p.id));
            }
          }}
        >
          <path
            d={`M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`}
            fill={item.color || "#94a3b8"}
            stroke="#64748b"
            strokeWidth={1}
          />
          {/* Simple height indicator */}
          <path
            d={`M${tl.x} ${tl.y} L${tl.x} ${tl.y - (item.height || 20)} L${tr.x} ${tr.y - (item.height || 20)} L${tr.x} ${tr.y} Z`}
            fill={item.color || "#94a3b8"}
            opacity={0.8}
          />
        </g>
      );
    });
  };

  // Render ghost furniture preview
  const renderGhostFurniture = () => {
    if (toolMode !== "place-furniture" || !hoveredTile || !selectedFurniture) return null;

    const { x, y } = hoveredTile;
    const item = selectedFurniture;
    const [w, d] = item.size;
    const effectiveW = draggingRotation % 2 === 0 ? w : d;
    const effectiveD = draggingRotation % 2 === 0 ? d : w;

    const isValid = isTileActive(currentLayout.activeTiles, x, y);

    const tl = toIsoLocal(x, y);
    const tr = toIsoLocal(x + effectiveW, y);
    const br = toIsoLocal(x + effectiveW, y + effectiveD);
    const bl = toIsoLocal(x, y + effectiveD);

    return (
      <g style={{ pointerEvents: "none", opacity: 0.6 }}>
        <path
          d={`M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`}
          fill={isValid ? "#34d399" : "#f87171"}
          stroke={isValid ? "#10b981" : "#ef4444"}
          strokeWidth={2}
        />
      </g>
    );
  };

  // Save blueprint
  const handleSaveBlueprint = () => {
    if (!blueprintName.trim()) {
      alert("請輸入藍圖名稱");
      return;
    }

    const blueprintData = {
      name: blueprintName,
      description: blueprintDesc,
      price: blueprintPrice,
      tags: [],
      roomChunks: blueprintLayout.roomChunks,
      floorStyle: { activeFloorId: null },
      wallStyle: { activeWallId: null },
      placements: blueprintPlacements.map((p) => ({
        furnitureId: p.furnitureId,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
      })),
      wallPlacements: blueprintWallPlacements.map((wp) => ({
        furnitureId: wp.furnitureId,
        segmentId: wp.segmentId || "",
        gridPos: wp.gridPos,
        z: wp.z,
      })),
    };

    if (editingBlueprint) {
      updateBlueprint(editingBlueprint.id, blueprintData);
    } else {
      createBlueprint(blueprintData);
    }

    setBlueprintName("");
    setBlueprintDesc("");
    setBlueprintPrice(100);
    setEditingBlueprint(null);
    alert("藍圖已保存！");
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Grid className="text-indigo-600" size={24} />
              空間設計中心
            </h1>
            <p className="text-sm text-slate-500">設計、測試並創建藍圖商品</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("admin-test")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "admin-test" ? "bg-white shadow text-indigo-600" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            管理員測試空間
          </button>
          <button
            onClick={() => setActiveTab("blueprint")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "blueprint" ? "bg-white shadow text-indigo-600" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Package size={16} className="inline mr-2" />
            藍圖商品設計
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left toolbar */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <h3 className="font-semibold text-slate-700 mb-3">工具</h3>

          <div className="space-y-2 mb-6">
            <button
              onClick={() => setToolMode("select")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                toolMode === "select" ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-100"
              }`}
            >
              <Move size={18} />
              <span>移動視角</span>
            </button>
            <button
              onClick={() => setToolMode("build")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                toolMode === "build" ? "bg-green-100 text-green-700" : "hover:bg-slate-100"
              }`}
            >
              <Hammer size={18} />
              <span>擴建地板</span>
            </button>
            <button
              onClick={() => setToolMode("place-furniture")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                toolMode === "place-furniture" ? "bg-blue-100 text-blue-700" : "hover:bg-slate-100"
              }`}
            >
              <Layout size={18} />
              <span>放置家具</span>
            </button>
            <button
              onClick={() => setToolMode("place-door")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                toolMode === "place-door" ? "bg-amber-100 text-amber-700" : "hover:bg-slate-100"
              }`}
            >
              <DoorOpen size={18} />
              <span>放置門</span>
            </button>
            <button
              onClick={() => setToolMode("remove")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                toolMode === "remove" ? "bg-red-100 text-red-700" : "hover:bg-slate-100"
              }`}
            >
              <Trash2 size={18} />
              <span>移除物件</span>
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => currentLayout.undo()}
              disabled={!currentLayout.canUndo}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo size={16} />
              <span className="text-sm">復原</span>
            </button>
            <button
              onClick={() => currentLayout.redo()}
              disabled={!currentLayout.canRedo}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Redo size={16} />
              <span className="text-sm">重做</span>
            </button>
          </div>

          {/* Furniture catalog (when in place mode) */}
          {toolMode === "place-furniture" && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">家具目錄</h3>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {fullCatalog.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedFurniture(item)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      selectedFurniture?.id === item.id
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: item.color || "#94a3b8" }}
                    >
                      {item.icon && typeof item.icon === 'function' ? (
                        <item.icon size={16} className="text-white" />
                      ) : (
                        <Package size={16} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-slate-500">
                        {item.size[0]}x{item.size[1]}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Door catalog (when in place-door mode) */}
          {toolMode === "place-door" && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3">門類型</h3>
              <div className="space-y-1">
                {DOOR_CATALOG.map((door) => (
                  <button
                    key={door.id}
                    onClick={() => setSelectedDoor(door)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      selectedDoor?.id === door.id
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: door.color }}
                    >
                      <DoorOpen size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{door.name}</div>
                      <div className="text-xs text-slate-500">
                        寬度: {door.width} 格 · 💰 {door.cost}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">點擊牆壁放置門。門會在牆壁上挖出開口。</p>
            </div>
          )}

          {/* Blueprint save form (when in blueprint tab) */}
          {activeTab === "blueprint" && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-slate-700 mb-3">保存藍圖</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="藍圖名稱"
                  value={blueprintName}
                  onChange={(e) => setBlueprintName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="number"
                  placeholder="價格"
                  value={blueprintPrice}
                  onChange={(e) => setBlueprintPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <textarea
                  placeholder="描述"
                  value={blueprintDesc}
                  onChange={(e) => setBlueprintDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  rows={2}
                />
                <button
                  onClick={handleSaveBlueprint}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Save size={16} />
                  保存藍圖
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-slate-700 mb-2">空間資訊</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <div>區塊數量: {currentLayout.roomChunks.length}</div>
              <div>地板格數: {currentLayout.activeTiles.size}</div>
              <div>已放家具: {placements.length}</div>
              <div>已放門: {doors.length}</div>
              <div
                className={`flex items-center gap-1 ${connectivityGraph.isFullyConnected ? "text-green-600" : "text-amber-600"}`}
              >
                {connectivityGraph.isFullyConnected ? "✓ 空間連通" : "⚠ 有隔離區域"}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 relative overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        >
          <svg
            ref={svgRef}
            viewBox="-400 -300 800 600"
            className="w-full h-full bg-slate-100"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Patterns */}
            <defs>
              {activeWall?.lightSide && (
                <pattern id="wall-light-pat" patternUnits="userSpaceOnUse" width="100" height="100">
                  <image href={activeWall.lightSide} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
                </pattern>
              )}
              {activeWall?.darkSide && (
                <pattern id="wall-dark-pat" patternUnits="userSpaceOnUse" width="100" height="100">
                  <image href={activeWall.darkSide} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
                </pattern>
              )}
            </defs>

            <g transform={`translate(${offset.x}, ${offset.y})`}>
              {renderWalls()}
              {renderChunks()}
              {renderFurniture()}
              {renderGhostFurniture()}
            </g>
          </svg>

          {/* Tool mode indicator */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm">
            <span className="text-sm font-medium text-slate-700">
              {toolMode === "select" && "🖱️ 拖曳移動視角"}
              {toolMode === "build" && "🔨 點擊綠色區塊擴建"}
              {toolMode === "place-furniture" &&
                (selectedFurniture ? `📦 放置: ${selectedFurniture.name} (右鍵旋轉)` : "📦 請選擇家具")}
              {toolMode === "remove" && "🗑️ 點擊物件移除"}
            </span>
          </div>

          {/* Reset button */}
          <button
            onClick={() => {
              if (confirm("確定要重置空間嗎？")) {
                currentLayout.resetLayout();
                setPlacements([]);
                setWallPlacements([]);
              }
            }}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
          >
            <RotateCcw size={16} />
            重置空間
          </button>
        </div>

        {/* Right panel - Blueprints list (only in blueprint tab) */}
        {activeTab === "blueprint" && (
          <div className="w-72 bg-white border-l p-4 overflow-y-auto">
            <h3 className="font-semibold text-slate-700 mb-3">已保存藍圖</h3>
            {blueprints.length === 0 ? (
              <p className="text-sm text-slate-500">尚無藍圖</p>
            ) : (
              <div className="space-y-3">
                {blueprints.map((bp) => (
                  <div
                    key={bp.id}
                    className={`p-3 border rounded-lg transition-all ${
                      editingBlueprint?.id === bp.id ? "border-indigo-400 bg-indigo-50" : "hover:border-indigo-300"
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => {
                        setBlueprintName(bp.name);
                        setBlueprintDesc(bp.description);
                        setBlueprintPrice(bp.price);
                        setEditingBlueprint(bp);
                        blueprintLayout.setLayout(bp.roomChunks);
                        setBlueprintPlacements(bp.placements.map((p) => ({ ...p, id: crypto.randomUUID() })));
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{bp.name}</div>
                        {bp.isPublished && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已上架</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">💰 {bp.price} 金幣</div>
                      <div className="text-xs text-slate-400">
                        {bp.roomChunks.length} 區塊 · {bp.placements.length} 家具
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      {bp.isPublished ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            unpublishBlueprint(bp.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                        >
                          <X size={12} />
                          下架
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            publishBlueprint(bp.id);
                            alert(`「${bp.name}」已發佈到商店！`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          <Store size={12} />
                          發佈商店
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`確定要刪除「${bp.name}」嗎？`)) {
                            deleteBlueprint(bp.id);
                            if (editingBlueprint?.id === bp.id) {
                              setEditingBlueprint(null);
                              setBlueprintName("");
                              setBlueprintDesc("");
                              setBlueprintPrice(100);
                            }
                          }
                        }}
                        className="px-2 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Published stats */}
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>已發佈:</span>
                  <span className="font-medium">{blueprints.filter((b) => b.isPublished).length} 個</span>
                </div>
                <div className="flex justify-between">
                  <span>草稿:</span>
                  <span className="font-medium">{blueprints.filter((b) => !b.isPublished).length} 個</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
