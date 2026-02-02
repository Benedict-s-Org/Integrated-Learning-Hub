import React from "react";
import {
  ShieldCheck,
  PenTool,
  Upload,
  Settings,
  Building2,
  Map,
  Layout,
  BarChart3,
  History,
  ArrowLeft,
  FolderUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SidebarAdminProps {
  isOpen: boolean;
  onOpenStudio: () => void;
  onOpenUploader: () => void;
  onOpenEditor: () => void;
  onOpenSpaceDesign: () => void;
  onOpenCityEditor: () => void;
  onOpenAssetUpload: () => void;
  onNavigateToHistory: () => void;
  onNavigateToMenu: () => void;
}

export const SidebarAdmin: React.FC<SidebarAdminProps> = ({
  isOpen,
  onOpenStudio,
  onOpenUploader,
  onOpenEditor,
  onOpenSpaceDesign,
  onOpenCityEditor,
  onOpenAssetUpload,
  onNavigateToHistory,
  onNavigateToMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="p-4 flex flex-col h-full animate-fade-in">
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <ShieldCheck className="text-emerald-500" /> 管理員
        </div>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenStudio}>
            <PenTool size={16} /> 家具設計室 (Parametric)
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenUploader}>
            <Upload size={16} /> 家具裝修上傳管理中心
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenEditor}>
            <Settings size={16} /> 家具編輯
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenSpaceDesign}>
            <Building2 size={16} /> 空間設計中心
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenCityEditor}>
            <Map size={16} /> 城市編輯器
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={onOpenAssetUpload}>
            <FolderUp size={16} /> 多格式上傳資料區
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => (window.location.href = "/admin/ui-builder")}
          >
            <Layout size={16} /> 介面功能板
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => (window.location.href = "/admin/progress")}
          >
            <BarChart3 size={16} /> 使用者進度
          </Button>
          <div className="p-4 bg-slate-100 rounded-xl text-xs text-slate-500">
            管理員權限：
            <br />• 無限資金 (♾️)
            <br />• 自定義家具上架
            <br />• 空間設計藍圖
          </div>
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
        <Button variant="secondary" className="w-full" onClick={onNavigateToHistory}>
          <History size={16} /> 歷史紀錄
        </Button>
        <Button variant="ghost" className="w-full text-slate-500" onClick={onNavigateToMenu}>
          <ArrowLeft size={16} /> 返回主選單
        </Button>
      </div>
    </div>
  );
};
