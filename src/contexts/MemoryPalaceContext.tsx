import React, { createContext, useContext, ReactNode, useMemo, useState, useCallback, useEffect } from "react";
import { useRoomData } from "../hooks/useRoomData";
import { FURNITURE_CATALOG, FURNITURE_MODELS } from "@/constants/furnitureCatalog";

import { useStudySession } from "@/hooks/useStudySession";
import { fetchUIBuilderAssets } from "@/utils/assetPersistence";
import { Asset } from "@/types/ui-builder";

interface MemoryPalaceContextType extends ReturnType<typeof useRoomData> {
    fullCatalog: any[];
    fullModels: any;
    // UI States
    uiState: {
        showShop: boolean;
        showStudio: boolean;
        showEditor: boolean;
        showUploader: boolean;
        showMapEditor: boolean;
        showAssetUpload: boolean;
        showSpaceDesign: boolean;
        showFurniturePanel: boolean;
        showHistoryPanel: boolean;
        showMemoryPanel: boolean;
        isMemoryMode: boolean;
        view: "room" | "map" | "region";
        showTransformPanel: boolean;
        transformTargetId: string | null;
        showThemeDesigner: boolean;
    };
    uiAssets: Asset[];
    setUiAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
    // Study Session
    studySession: ReturnType<typeof useStudySession>;
    // UI Setters
    setUiState: React.Dispatch<React.SetStateAction<MemoryPalaceContextType["uiState"]>>;
    toggleShop: () => void;
    toggleStudio: () => void;
    toggleEditor: () => void;
    toggleUploader: () => void;
    toggleMapEditor: () => void;
    toggleAssetUpload: () => void;
    toggleSpaceDesign: () => void;
    toggleThemeDesigner: () => void;
    toggleFurniturePanel: () => void;
    toggleHistoryPanel: () => void;
    toggleMemoryPanel: () => void;
    toggleMemoryMode: () => void;
    toggleTransformPanel: (id: string | null) => void;
    setView: (view: "room" | "map" | "region") => void;
}

const MemoryPalaceContext = createContext<MemoryPalaceContextType | null>(null);

export function MemoryPalaceProvider({ children }: { children: ReactNode }) {
    const roomData = useRoomData();
    const studySession = useStudySession();

    const [uiState, setUiState] = useState({
        showShop: false,
        showStudio: false,
        showEditor: false,
        showUploader: false,
        showMapEditor: false,
        showAssetUpload: false,
        showSpaceDesign: false,
        showThemeDesigner: false,
        showFurniturePanel: false,
        showHistoryPanel: false,
        showMemoryPanel: false,
        isMemoryMode: false,
        view: "room" as "room" | "map" | "region",
        showTransformPanel: false,
        transformTargetId: null as string | null,
    });
    const [uiAssets, setUiAssets] = useState<Asset[]>([]);

    useEffect(() => {
        const loadAssets = async () => {
            const assets = await fetchUIBuilderAssets();
            setUiAssets(assets);
        };
        loadAssets();
    }, []);

    const fullCatalog = useMemo(() => {
        return [...FURNITURE_CATALOG, ...roomData.customCatalog];
    }, [roomData.customCatalog]);

    const fullModels = useMemo(() => {
        return { ...FURNITURE_MODELS, ...roomData.customModels };
    }, [roomData.customModels]);

    const toggleShop = useCallback(() => setUiState(prev => ({ ...prev, showShop: !prev.showShop })), []);
    const toggleStudio = useCallback(() => setUiState(prev => ({ ...prev, showStudio: !prev.showStudio })), []);
    const toggleEditor = useCallback(() => setUiState(prev => ({ ...prev, showEditor: !prev.showEditor })), []);
    const toggleUploader = useCallback(() => setUiState(prev => ({ ...prev, showUploader: !prev.showUploader })), []);
    const toggleMapEditor = useCallback(() => setUiState(prev => ({ ...prev, showMapEditor: !prev.showMapEditor })), []);
    const toggleAssetUpload = useCallback(() => setUiState(prev => ({ ...prev, showAssetUpload: !prev.showAssetUpload })), []);
    const toggleSpaceDesign = useCallback(() => setUiState(prev => ({ ...prev, showSpaceDesign: !prev.showSpaceDesign })), []);
    const toggleThemeDesigner = useCallback(() => setUiState(prev => ({ ...prev, showThemeDesigner: !prev.showThemeDesigner })), []);
    const toggleFurniturePanel = useCallback(() => setUiState(prev => ({ ...prev, showFurniturePanel: !prev.showFurniturePanel })), []);
    const toggleHistoryPanel = useCallback(() => setUiState(prev => ({ ...prev, showHistoryPanel: !prev.showHistoryPanel })), []);
    const toggleMemoryPanel = useCallback(() => setUiState(prev => ({ ...prev, showMemoryPanel: !prev.showMemoryPanel })), []);
    const toggleMemoryMode = useCallback(() => setUiState(prev => ({ ...prev, isMemoryMode: !prev.isMemoryMode })), []);
    const toggleTransformPanel = useCallback((id: string | null) => setUiState(prev => ({
        ...prev,
        showTransformPanel: id !== null,
        transformTargetId: id
    })), []);
    const setView = useCallback((view: "room" | "map" | "region") => setUiState(prev => ({ ...prev, view })), []);

    const value = useMemo(() => ({
        ...roomData,
        fullCatalog,
        fullModels,
        uiState,
        studySession,
        setUiState,
        toggleShop,
        toggleStudio,
        toggleEditor,
        toggleUploader,
        toggleMapEditor,
        toggleAssetUpload,
        toggleSpaceDesign,
        toggleThemeDesigner,
        toggleFurniturePanel,
        toggleHistoryPanel,
        toggleMemoryPanel,
        toggleMemoryMode,
        toggleTransformPanel,
        setView,
        uiAssets,
        setUiAssets
    }), [
        roomData,
        fullCatalog,
        fullModels,
        uiState,
        studySession,
        toggleShop,
        toggleStudio,
        toggleEditor,
        toggleUploader,
        toggleMapEditor,
        toggleAssetUpload,
        toggleSpaceDesign,
        toggleThemeDesigner,
        toggleFurniturePanel,
        toggleHistoryPanel,
        toggleMemoryPanel,
        toggleMemoryMode,
        toggleTransformPanel,
        setView,
        uiAssets
    ]);

    return (
        <MemoryPalaceContext.Provider value={value}>
            {children}
        </MemoryPalaceContext.Provider>
    );
}

export function useMemoryPalace() {
    return useContext(MemoryPalaceContext);
}

export function useMemoryPalaceContext() {
    const context = useContext(MemoryPalaceContext);
    if (!context) {
        throw new Error("useMemoryPalaceContext must be used within a MemoryPalaceProvider");
    }
    return context;
}
