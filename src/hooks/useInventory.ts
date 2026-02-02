import { useCallback } from "react";
import { useMemoryPalaceContext } from "@/contexts/MemoryPalaceContext";

export function useInventory() {
    const {
        coins,
        setCoins,
        inventory,
        setInventory,
        isAdmin,
    } = useMemoryPalaceContext();

    const buyItem = useCallback((item: { id: string; name: string; cost: number }) => {
        if (coins >= item.cost && !inventory.includes(item.id)) {
            if (isAdmin) {
                setInventory((i) => [...i, item.id]);
            } else {
                setCoins((c) => c - item.cost);
                setInventory((i) => [...i, item.id]);
            }
            return true;
        }
        return false;
    }, [coins, inventory, isAdmin, setCoins, setInventory]);

    return {
        coins,
        inventory,
        buyItem,
        isAdmin
    };
}
