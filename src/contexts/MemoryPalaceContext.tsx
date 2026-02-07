import React, { createContext, useContext, ReactNode, useMemo, useState } from "react";
import { useRoomData, RoomData } from "../hooks/useRoomData";
import { useAuth } from "@/context/AuthContext";
import { FURNITURE_CATALOG, FURNITURE_MODELS } from "@/constants/furnitureCatalog";

import { useStudySession } from "@/hooks/useStudySession";

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
    };
    // Study Session
    studySession: ReturnType<typeof useStudySession>;
    // UI Setters
    setUiState: React.Dispatch<React.SetStateAction<{
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
    }>>;
    toggleShop: () => void;
    toggleStudio: () => void;
    toggleEditor: () => void;
    toggleUploader: () => void;
    toggleMapEditor: () => void;
    toggleAssetUpload: () => void;
    toggleSpaceDesign: () => void;
    toggleFurniturePanel: () => void;
    toggleHistoryPanel: () => void;
    toggleMemoryPanel: () => void;
    toggleMemoryMode: () => void;
    setView: (view: "room" | "map" | "region") => void;
}

const MemoryPalaceContext = createContext<MemoryPalaceContextType | null>(null);

export function MemoryPalaceProvider({ children }: { children: ReactNode }) {
    const roomData = useRoomData();
    const studySession = useStudySession();

    // UI State
    const [uiState, setUiState] = useState({
        showShop: false,
        showStudio: false,
        showEditor: false,
        showUploader: false,
        showMapEditor: false,
        showAssetUpload: false,
        showSpaceDesign: false,
        showFurniturePanel: false,
        showHistoryPanel: false,
        showMemoryPanel: false,
        isMemoryMode: false,
        view: "room" as "room" | "map" | "region",
    });

    const fullCatalog = useMemo(() => {
        return [...FURNITURE_CATALOG, ...roomData.customCatalog];
    }, [roomData.customCatalog]);

    const fullModels = useMemo(() => {
        return { ...FURNITURE_MODELS, ...roomData.customModels };
    }, [roomData.customModels]);

    const toggleShop = () => setUiState(prev => ({ ...prev, showShop: !prev.showShop }));
    const toggleStudio = () => setUiState(prev => ({ ...prev, showStudio: !prev.showStudio }));
    const toggleEditor = () => setUiState(prev => ({ ...prev, showEditor: !prev.showEditor }));
    const toggleUploader = () => setUiState(prev => ({ ...prev, showUploader: !prev.showUploader }));
    const toggleMapEditor = () => setUiState(prev => ({ ...prev, showMapEditor: !prev.showMapEditor }));
    const toggleAssetUpload = () => setUiState(prev => ({ ...prev, showAssetUpload: !prev.showAssetUpload }));
    const toggleSpaceDesign = () => setUiState(prev => ({ ...prev, showSpaceDesign: !prev.showSpaceDesign }));
    const toggleFurniturePanel = () => setUiState(prev => ({ ...prev, showFurniturePanel: !prev.showFurniturePanel }));
    const toggleHistoryPanel = () => setUiState(prev => ({ ...prev, showHistoryPanel: !prev.showHistoryPanel }));
    const toggleMemoryPanel = () => setUiState(prev => ({ ...prev, showMemoryPanel: !prev.showMemoryPanel }));
    const toggleMemoryMode = () => setUiState(prev => ({ ...prev, isMemoryMode: !prev.isMemoryMode }));
    const setView = (view: "room" | "map" | "region") => setUiState(prev => ({ ...prev, view }));

    const value = {
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
        toggleFurniturePanel,
        toggleHistoryPanel,
        toggleMemoryPanel,
        toggleMemoryMode,
        setView
    };

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
