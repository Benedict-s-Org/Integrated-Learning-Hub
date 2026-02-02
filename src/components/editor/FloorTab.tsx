import React, { useState, useEffect } from "react";
import { Grid, Upload, DollarSign, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImageToSupabase } from "@/utils/storageUpload";

interface CustomFloor {
  id: string;
  name: string;
  price?: number;
  image: string;
}

interface FloorTabProps {
  customFloors: CustomFloor[];
  onUpdateFloor: (floor: CustomFloor) => void;
  onDeleteFloor: (id: string) => void;
  onClose: () => void;
}

export const FloorTab: React.FC<FloorTabProps> = ({
  customFloors,
  onUpdateFloor,
  onDeleteFloor,
  onClose,
}) => {
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [floorName, setFloorName] = useState("");
  const [floorPrice, setFloorPrice] = useState(0);
  const [floorImage, setFloorImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Load floor data when selected
  useEffect(() => {
    if (!selectedFloorId) return;
    const floor = customFloors?.find((f) => f.id === selectedFloorId);
    if (floor) {
      setFloorName(floor.name || "");
      setFloorPrice(floor.price || 0);
      setFloorImage(floor.image || "");
    }
  }, [selectedFloorId, customFloors]);

  const handleFloorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const url = await uploadImageToSupabase(file, 'floors');
    setIsUploading(false);
    
    if (url) {
      setFloorImage(url);
    }
  };

  const handleSave = () => {
    if (!selectedFloorId || !floorName) {
      alert("請選擇地板並輸入名稱");
      return;
    }
    const updatedFloor: CustomFloor = {
      id: selectedFloorId,
      name: floorName,
      price: parseInt(String(floorPrice)) || 0,
      image: floorImage,
    };
    onUpdateFloor(updatedFloor);
    onClose();
  };

  return (
    <div className="flex-1 flex gap-4 p-2 overflow-hidden relative">
      {/* Upload loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center rounded-xl">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-slate-700 font-medium">上傳中...</span>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Grid size={16} /> 選擇地板
          </h3>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="w-full border rounded p-2 text-sm"
          >
            <option value="">-- 請選擇要編輯的地板 --</option>
            {customFloors?.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
        </div>

        {selectedFloorId && (
          <>
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                <Grid size={16} /> 地板貼圖
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-xl aspect-video flex flex-col items-center justify-center relative bg-gray-50 hover:bg-white transition-colors max-w-md mx-auto">
                {floorImage ? (
                  <img src={floorImage} alt="地板" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center">
                    <Upload size={32} className="mb-2" />
                    <span className="text-sm">上傳地板貼圖</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFloorImageUpload}
                  disabled={isUploading}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 block mb-1">地板名稱</label>
                  <input
                    type="text"
                    value={floorName}
                    onChange={(e) => setFloorName(e.target.value)}
                    placeholder="給地板取個名字..."
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs font-bold text-slate-500 block mb-1">定價</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={floorPrice}
                      onChange={(e) => setFloorPrice(parseInt(e.target.value) || 0)}
                      className="w-full border rounded p-2 pl-6 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-between">
                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`確定要刪除「${floorName}」嗎？此操作無法復原。`)) {
                      onDeleteFloor(selectedFloorId);
                      setSelectedFloorId("");
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-1" /> 刪除地板
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleSave} icon={Grid} disabled={isUploading}>
                    儲存變更
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {!selectedFloorId && customFloors?.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Grid size={48} className="mx-auto mb-4 opacity-50" />
            <p>尚無上傳的地板樣式</p>
            <p className="text-sm mt-2">請先在上傳管理中心上傳地板</p>
          </div>
        )}
      </div>
    </div>
  );
};
