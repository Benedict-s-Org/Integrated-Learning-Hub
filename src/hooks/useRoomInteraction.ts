import { useState, useCallback } from "react";
import { useMemoryPalaceContext } from "@/contexts/MemoryPalaceContext";
import { FurnitureItem, Placement, WallPlacement } from "@/types/furniture";
import { useNavigate } from "react-router-dom";

export function useRoomInteraction() {
    const {
        placements,
        setPlacements,
        wallPlacements,
        setWallPlacements,
        fullCatalog,
        customCatalog,
    } = useMemoryPalaceContext();

    // navigate needed for furniture clicking navigation legacy support
    const navigate = useNavigate();

    // Local interaction state
    const [draggingItem, setDraggingItem] = useState<FurnitureItem | null>(null);
    const [draggingRotation, setDraggingRotation] = useState(0);
    const [movingPlacementId, setMovingPlacementId] = useState<string | null>(null);
    const [isRemoveMode, setIsRemoveMode] = useState(false);
    const [removalSelectedId, setRemovalSelectedId] = useState<string | null>(null);

    const handleDragStart = useCallback((item: FurnitureItem) => {
        if (!item) return;
        setDraggingItem(item);
        setDraggingRotation(0);
        setMovingPlacementId(null);
    }, []);

    const handleFurnitureMouseDown = useCallback((placement: Placement) => {
        if (isRemoveMode) return;

        const item = fullCatalog.find((f) => f.id === placement.furnitureId);
        if (item) {
            setMovingPlacementId(placement.id);
            setDraggingItem(item);
            setDraggingRotation(placement.rotation);
        }
    }, [isRemoveMode, fullCatalog]);

    const addPlacement = useCallback((furnitureId: string, x: number, y: number, rotation: number) => {
        const newP: Placement = { id: crypto.randomUUID(), furnitureId, x, y, rotation };
        setPlacements((prev) => [...prev, newP]);
    }, [setPlacements]);

    const updatePlacement = useCallback((id: string, x: number, y: number, rotation: number) => {
        setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, x, y, rotation } : p)));
    }, [setPlacements]);

    const removePlacement = useCallback((id: string) => {
        setPlacements((prev) => prev.filter((p) => p.id !== id));
    }, [setPlacements]);

    const removeWallPlacement = useCallback((id: string) => {
        setWallPlacements((prev) => prev.filter((p) => p.id !== id));
    }, [setWallPlacements]);

    const handleCommitPlacement = useCallback(
        (furnitureId: string, x: number, y: number, rotation: number) => {
            if (movingPlacementId) {
                updatePlacement(movingPlacementId, x, y, rotation);
                setMovingPlacementId(null);
            } else {
                addPlacement(furnitureId, x, y, rotation);
            }
            setDraggingItem(null);
        },
        [movingPlacementId, updatePlacement, addPlacement]
    );

    const handleCommitWallPlacement = useCallback(
        (furnitureId: string, gridPos: number, z: number, surface: "left-wall" | "right-wall") => {
            const newP: WallPlacement = {
                id: crypto.randomUUID(),
                furnitureId,
                gridPos,
                z,
                surface,
                rotation: 0
            };
            setWallPlacements((prev) => [...prev, newP]);
            setDraggingItem(null);
        }, [setWallPlacements]
    );

    const toggleRemoveMode = useCallback((active?: boolean) => {
        setIsRemoveMode(prev => active !== undefined ? active : !prev);
        setRemovalSelectedId(null);
    }, []);

    const handleFurnitureClick = useCallback((id: string) => {
        if (isRemoveMode) {
            setRemovalSelectedId(prev => prev === id ? null : id);
        } else {
            // Handle navigation or other actions
            const placement = placements.find(p => p.id === id);
            if (placement) {
                const item = fullCatalog.find(f => f.id === placement.furnitureId);
                if (item && item.navigateTo) {
                    navigate(item.navigateTo);
                }
            }
        }
    }, [isRemoveMode, placements, fullCatalog, navigate]);

    const confirmRemove = useCallback(() => {
        if (!removalSelectedId) return;

        // Check if wall or floor
        const isWall = wallPlacements.some(p => p.id === removalSelectedId);
        if (isWall) {
            removeWallPlacement(removalSelectedId);
        } else {
            removePlacement(removalSelectedId);
        }
        setRemovalSelectedId(null);
    }, [removalSelectedId, wallPlacements, removeWallPlacement, removePlacement]);

    const cancelRemove = useCallback(() => {
        setRemovalSelectedId(null);
    }, []);

    return {
        draggingItem,
        setDraggingItem,
        draggingRotation,
        setDraggingRotation,
        movingPlacementId,
        setMovingPlacementId,
        isRemoveMode,
        toggleRemoveMode,
        removalSelectedId,
        setRemovalSelectedId,
        handleDragStart,
        handleFurnitureMouseDown,
        handleCommitPlacement,
        handleCommitWallPlacement,
        handleFurnitureClick,
        removePlacement,
        removeWallPlacement,
        confirmRemove,
        cancelRemove
    };
}
