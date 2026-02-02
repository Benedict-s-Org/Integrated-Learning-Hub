import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useRoomData, RoomData } from "../hooks/useRoomData";
import { useAuth } from "@/context/AuthContext";
import { FURNITURE_CATALOG, FURNITURE_MODELS } from "@/constants/furnitureCatalog";

interface MemoryPalaceContextType extends ReturnType<typeof useRoomData> {
    fullCatalog: any[];
    fullModels: any;
}

const MemoryPalaceContext = createContext<MemoryPalaceContextType | null>(null);

export function MemoryPalaceProvider({ children }: { children: ReactNode }) {
    const roomData = useRoomData();

    const fullCatalog = useMemo(() => {
        return [...FURNITURE_CATALOG, ...roomData.customCatalog];
    }, [roomData.customCatalog]);

    const fullModels = useMemo(() => {
        return { ...FURNITURE_MODELS, ...roomData.customModels };
    }, [roomData.customModels]);

    const value = {
        ...roomData,
        fullCatalog,
        fullModels
    };

    return (
        <MemoryPalaceContext.Provider value={value}>
            {children}
        </MemoryPalaceContext.Provider>
    );
}

export function useMemoryPalaceContext() {
    const context = useContext(MemoryPalaceContext);
    if (!context) {
        throw new Error("useMemoryPalaceContext must be used within a MemoryPalaceProvider");
    }
    return context;
}
