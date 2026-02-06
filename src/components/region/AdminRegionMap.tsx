import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDefaultAssets } from '@/hooks/useDefaultAssets';
import type { RegionData, PublicFacility } from '@/types/region';
import { REGION_CONFIG, REGION_THEME_COLORS } from '@/constants/regionConfig';
import { CARTOON_PALETTE } from '@/constants/cityStyleGuide';
import { CityPlot } from './CityPlot';
import { PublicFacilityMarker } from './PublicFacilityMarker';
import { TerrainTransformPanel, TerrainTransformData } from './TerrainTransformPanel';

interface AdminRegionMapProps {
    region: RegionData;
    selectedFacilityId?: string | null;
    onFacilityClick?: (facility: PublicFacility) => void;
    onFacilityDrag?: (id: string, newPosition: { x: number; y: number }) => void;
    onPlotClick?: (plotId: string) => void;
}

export function AdminRegionMap({
    region,
    selectedFacilityId,
    onFacilityClick,
    onFacilityDrag,
    onPlotClick
}: AdminRegionMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { defaultTerrain, refresh: refreshAssets } = useDefaultAssets();

    // Upload state
    const [isUploading, setIsUploading] = useState(false);

    const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(REGION_CONFIG.defaultZoom);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Drag state for facilities
    const [draggingFacility, setDraggingFacility] = useState<string | null>(null);

    // Terrain transform state
    const [showTerrainPanel, setShowTerrainPanel] = useState(false);
    const [terrainTransform, setTerrainTransform] = useState<TerrainTransformData>({
        scale: 2.1,
        offsetX: 0,
        offsetY: 0,
        anchorMultiplier: 0.65,
        scaleX: 100,
        scaleY: 100,
        skewX: 0,
        skewY: 0
    });

    // Load default transform from DB
    useEffect(() => {
        if (defaultTerrain?.config) {
            const config = defaultTerrain.config as any;
            setTerrainTransform(prev => ({
                ...prev,
                scale: config.scale ?? 2.1,
                offsetX: config.offsetX ?? 0,
                offsetY: config.offsetY ?? 0,
                anchorMultiplier: config.anchorMultiplier ?? 0.65,
                scaleX: config.scaleX ?? 100,
                scaleY: config.scaleY ?? 100,
                skewX: config.skewX ?? 0,
                skewY: config.skewY ?? 0,
            }));
        }
    }, [defaultTerrain]);

    const themeColors = REGION_THEME_COLORS[region.theme];
    const { tileWidth, tileHeight, minZoom, maxZoom } = REGION_CONFIG;

    // Coordinate conversion helpers
    const toIso = useCallback((x: number, y: number) => {
        return {
            x: (x - y) * (tileWidth / 2),
            y: (x + y) * (tileHeight / 2),
        };
    }, [tileWidth, tileHeight]);

    const fromIso = useCallback((screenX: number, screenY: number) => {
        const relX = screenX;
        const relY = screenY;

        const gridX = (relX / (tileWidth / 2) + relY / (tileHeight / 2)) / 2;
        const gridY = (relY / (tileHeight / 2) - relX / (tileWidth / 2)) / 2;

        return {
            x: Math.round(gridX),
            y: Math.round(gridY),
        };
    }, [tileWidth, tileHeight]);

    const getSVGCoords = useCallback((e: React.MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgPt = pt.matrixTransform(ctm.inverse());
        return { x: svgPt.x, y: svgPt.y };
    }, []);

    // Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 && !draggingFacility) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const svgCoords = getSVGCoords(e);

        if (draggingFacility && onFacilityDrag) {
            const centerX = (containerRef.current?.clientWidth ?? 0) / 2 + cameraOffset.x;
            const centerY = (containerRef.current?.clientHeight ?? 0) / 2 + cameraOffset.y;

            const relX = (svgCoords.x - centerX) / zoom;
            const relY = (svgCoords.y - centerY) / zoom;

            const gridPos = fromIso(relX, relY);
            onFacilityDrag(draggingFacility, gridPos);
            return;
        }

        if (isPanning) {
            setCameraOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            });
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingFacility(null);
    };

    const handleFacilityMouseDown = (facility: PublicFacility, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onFacilityDrag) {
            setDraggingFacility(facility.id);
        }
        if (onFacilityClick) {
            onFacilityClick(facility);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(Math.max(prev + delta, minZoom), maxZoom));
    };

    const handleTerrainImageUpload = async (file: File) => {
        if (!defaultTerrain?.id || isUploading) return;

        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('city-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('city-assets')
                .getPublicUrl(filePath);

            // 3. Update Database
            const { error: dbError } = await supabase
                .from('city_style_assets')
                .update({ image_url: publicUrl })
                .eq('id', defaultTerrain.id);

            if (dbError) throw dbError;

            // 4. Refresh Assets
            await refreshAssets();

        } catch (error) {
            console.error('Error uploading terrain image:', error);
            alert('Failed to update terrain image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveTerrainTransform = async () => {
        if (!defaultTerrain?.id) return;
        try {
            const config = {
                scale: terrainTransform.scale,
                offsetX: terrainTransform.offsetX,
                offsetY: terrainTransform.offsetY,
                anchorMultiplier: terrainTransform.anchorMultiplier,
                scaleX: terrainTransform.scaleX,
                scaleY: terrainTransform.scaleY,
                skewX: terrainTransform.skewX,
                skewY: terrainTransform.skewY,
            };

            // Merge with existing config to preserve other fields like width/height if any
            const mergedConfig = {
                ...(defaultTerrain.config || {}),
                ...config
            };

            const { error } = await supabase
                .from('city_style_assets')
                .update({ config: mergedConfig })
                .eq('id', defaultTerrain.id);

            if (error) throw error;
            await refreshAssets();
            setShowTerrainPanel(false);
        } catch (e) {
            console.error('Failed to save terrain transform:', e);
            alert('Failed to save terrain settings.');
        }
    };

    // Render ground grid
    const renderGrid = useMemo(() => {
        const lines = [];
        const size = region.gridSize;
        for (let i = 0; i <= size; i++) {
            const p1 = toIso(0, i);
            const p2 = toIso(size, i);
            const p3 = toIso(i, 0);
            const p4 = toIso(i, size);
            lines.push(
                <line key={`h-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={themeColors.road} strokeWidth={0.5} opacity={0.3} />,
                <line key={`v-${i}`} x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} stroke={themeColors.road} strokeWidth={0.5} opacity={0.3} />
            );
        }
        return lines;
    }, [region.gridSize, toIso, themeColors.road]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden bg-slate-900 select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="touch-none"
            >
                <g transform={`translate(${(containerRef.current?.clientWidth ?? 0) / 2 + cameraOffset.x}, ${(containerRef.current?.clientHeight ?? 0) / 2 + cameraOffset.y}) scale(${zoom})`}>
                    <defs>
                        {defaultTerrain && (
                            <pattern
                                id="admin-region-grass-pattern"
                                patternUnits="userSpaceOnUse"
                                width={tileWidth}
                                height={tileHeight}
                                viewBox={`0 0 ${tileWidth} ${tileHeight}`}
                            >
                                <image
                                    href={defaultTerrain.image_url}
                                    width={tileWidth}
                                    height={tileHeight}
                                    preserveAspectRatio="xMidYMid slice"
                                />
                            </pattern>
                        )}
                    </defs>


                    {/* Ground grid */}
                    <g>
                        {Array.from({ length: region.gridSize * region.gridSize }).map((_, i) => {
                            const x = i % region.gridSize;
                            const y = Math.floor(i / region.gridSize);
                            const p1 = toIso(x, y);

                            // Calculate vertices for fallback polygon
                            const p2 = toIso(x + 1, y);
                            const p3 = toIso(x + 1, y + 1);
                            const p4 = toIso(x, y + 1);

                            // Scale factors for the image to handle padding and ensure overlap
                            const masterScale = terrainTransform.scale;
                            const sx = (terrainTransform.scaleX ?? 100) / 100;
                            const sy = (terrainTransform.scaleY ?? 100) / 100;

                            const scaledWidth = tileWidth * masterScale * sx;
                            const scaledHeight = tileHeight * masterScale * sy;

                            // Center the scaled image on the isometric tile
                            // p1 is the top point of the diamond
                            // Push the image down so the base sits on the grid line
                            const imageX = p1.x - scaledWidth / 2 + terrainTransform.offsetX;
                            const imageY = p1.y + tileHeight - scaledHeight * terrainTransform.anchorMultiplier + terrainTransform.offsetY;

                            return (
                                <g key={`ground-${x}-${y}`}>
                                    {defaultTerrain ? (
                                        <image
                                            x={imageX}
                                            y={imageY}
                                            width={scaledWidth}
                                            height={scaledHeight}
                                            href={defaultTerrain.image_url}
                                            preserveAspectRatio="none"
                                            style={{
                                                transformBox: 'fill-box',
                                                transformOrigin: 'center',
                                                transform: `skewX(${terrainTransform.skewX ?? 0}deg) skewY(${terrainTransform.skewY ?? 0}deg)`
                                            }}
                                        />
                                    ) : (
                                        <polygon
                                            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                                            fill={CARTOON_PALETTE.ground.grass}
                                            stroke="rgba(0,0,0,0.1)"
                                            strokeWidth={0.5}
                                        />
                                    )}
                                </g>
                            );
                        })}
                        {renderGrid}
                    </g>

                    {/* Plots */}
                    <g>
                        {region.plots
                            .filter(plot => plot.plotType !== 'empty')
                            .map(plot => (
                                <CityPlot
                                    key={plot.id}
                                    plot={plot}
                                    isSelected={false}
                                    isHovered={false}
                                    onSelect={(id) => onPlotClick?.(id)}
                                    onHover={() => { }}
                                />
                            ))}
                    </g>

                    {/* Map Elements (sorted by zIndex) */}
                    <g>
                        {[...(region.mapElements || [])].sort((a, b) => a.zIndex - b.zIndex).map(element => {
                            const pos = toIso(element.x, element.y);
                            return (
                                <image
                                    key={element.id}
                                    href={element.assetUrl}
                                    x={pos.x - tileWidth / 2} // Center the image approx
                                    y={pos.y - tileHeight} // Adjust vertical anchor
                                    width={tileWidth}
                                    height={tileHeight} // Assume 1x1 tile size for now, layout engine can be smarter later
                                    preserveAspectRatio="xMidYMax meet"
                                    style={{ pointerEvents: 'none' }} // Pass through clicks to plot for now
                                />
                            );
                        })}
                    </g>

                    {/* Facilities */}
                    <g>
                        {region.facilities.map(facility => {
                            const isDragging = draggingFacility === facility.id;
                            return (
                                <g
                                    key={facility.id}
                                    onMouseDown={(e) => handleFacilityMouseDown(facility, e)}
                                    style={{ cursor: 'pointer', opacity: isDragging ? 0.6 : 1 }}
                                >
                                    <PublicFacilityMarker
                                        facility={facility}
                                        isSelected={selectedFacilityId === facility.id}
                                        isHovered={false}
                                        onSelect={() => onFacilityClick?.(facility)}
                                        onHover={() => { }}
                                    />
                                </g>
                            );
                        })}
                    </g>
                </g>
            </svg>

            {/* Admin Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Zoom</div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setZoom(z => Math.max(z - 0.2, minZoom))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold">-</button>
                        <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(z + 0.2, maxZoom))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-bold">+</button>
                    </div>
                </div>
                <button
                    onClick={() => { setCameraOffset({ x: 0, y: 0 }); setZoom(1); }}
                    className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white"
                >
                    Reset View
                </button>
                <button
                    onClick={() => setShowTerrainPanel(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-bold flex items-center gap-2"
                >
                    <Sliders size={14} />
                    草地精細調整
                </button>
            </div>

            {/* Terrain Transform Panel Modal */}
            {showTerrainPanel && (
                <div className="absolute inset-0 z-50 flex">
                    <TerrainTransformPanel
                        terrainName={defaultTerrain?.name || '草地'}
                        terrainImage={defaultTerrain?.image_url}
                        data={terrainTransform}
                        onChange={(changes) => setTerrainTransform(prev => ({ ...prev, ...changes }))}
                        onSave={handleSaveTerrainTransform}
                        onCancel={() => setShowTerrainPanel(false)}
                        onReset={() => setTerrainTransform({ scale: 2.1, offsetX: 0, offsetY: 0, anchorMultiplier: 0.65, scaleX: 100, scaleY: 100, skewX: 0, skewY: 0 })}
                        onImageUpload={handleTerrainImageUpload}
                    />
                    {/* Live preview takes rest of screen - semi-transparent overlay allows seeing map */}
                    <div
                        className="flex-1 bg-black/30 cursor-pointer"
                        onClick={() => setShowTerrainPanel(false)}
                    />
                </div>
            )}
        </div>
    );
}
