import React from "react";
import { Coins, Brain, ShoppingBag, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SidebarMenuProps {
  coins: number;
  isAdmin: boolean;
  dueCount: number;
  onStart: () => void;
  onShop: () => void;
  onCity: () => void;
  currentPhase: string;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  coins,
  isAdmin,
  dueCount,
  onStart,
  onShop,
  onCity,
  currentPhase,
}) => {
  return (
    <div className="p-4 flex-1 flex flex-col overflow-y-auto animate-fade-in" data-component-name="SidebarMenu" data-source-file="src/components/sidebar/SidebarMenu.tsx">
      <div className="flex-1 space-y-4">
        {/* Currency Display */}
        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-4 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 text-amber-100 text-xs mb-1 font-semibold">
            <Coins size={14} /> 金幣餘額
          </div>
          <div className="text-3xl font-black">{isAdmin ? "♾️" : coins.toLocaleString()}</div>
        </div>

        {/* Main Actions */}
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full py-3"
            onClick={onStart}
            disabled={currentPhase !== "intro"}
            icon={Brain}
          >
            開始訓練
            {dueCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {dueCount}
              </span>
            )}
          </Button>
          <Button variant="secondary" className="w-full" onClick={onShop} icon={ShoppingBag}>
            商店
          </Button>
          <Button variant="secondary" className="w-full" onClick={onCity} icon={Building2}>
            城市地圖
          </Button>
        </div>
      </div>
    </div>
  );
};
