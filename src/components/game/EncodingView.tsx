import React from "react";
import { Brain, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Locus {
  id: string;
  name?: string;
  isFurniture?: boolean;
}

interface EncodingViewProps {
  items: string[];
  loci: Locus[];
  associations: Record<string, string>;
  onAssociate: (locId: string, item: string) => void;
  onNext: () => void;
}

export const EncodingView: React.FC<EncodingViewProps> = ({
  items,
  loci,
  associations,
  onAssociate,
  onNext,
}) => {
  const allAssigned = Object.keys(associations).length >= Math.min(items.length, loci.length);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-indigo-50 to-white">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full mb-4">
          <Brain size={20} />
          <span className="font-bold">編碼階段</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">將詞彙與位置連結</h2>
        <p className="text-slate-500">拖曳詞彙到對應的位置，建立你的記憶宮殿</p>
      </div>

      <div className="flex gap-12 mb-8 max-w-4xl w-full">
        {/* Items List */}
        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">待記憶詞彙</h3>
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => {
              const isUsed = Object.values(associations).includes(item);
              return (
                <div
                  key={idx}
                  draggable={!isUsed}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all cursor-grab active:cursor-grabbing ${
                    isUsed
                      ? "bg-green-100 text-green-700 opacity-60"
                      : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  }`}
                >
                  {item}
                </div>
              );
            })}
          </div>
        </div>

        {/* Loci List */}
        <div className="flex-1 bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">記憶位置</h3>
          <div className="space-y-3">
            {loci.slice(0, items.length).map((loc, idx) => {
              const assignedItem = associations[loc.id];
              return (
                <div
                  key={loc.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const item = e.dataTransfer.getData("text/plain");
                    if (item) onAssociate(loc.id, item);
                  }}
                  className={`p-4 rounded-xl border-2 border-dashed transition-all ${
                    assignedItem
                      ? "border-green-400 bg-green-50"
                      : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      #{idx + 1} {loc.name || `位置 ${idx + 1}`}
                    </span>
                    {assignedItem && (
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {assignedItem}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        onClick={onNext}
        disabled={!allAssigned}
        className="px-8 py-3 text-lg"
        icon={ArrowRight}
      >
        完成編碼，進入回憶階段
      </Button>
      {!allAssigned && (
        <p className="text-slate-400 text-sm mt-3">請將所有詞彙都放置到位置上</p>
      )}
    </div>
  );
};
