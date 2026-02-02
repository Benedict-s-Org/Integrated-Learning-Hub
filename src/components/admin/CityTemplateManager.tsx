import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Upload,
  Save,
  Trash2,
  FileJson,
  FolderOpen,
  Plus,
  Check,
  X,
  Copy,
  AlertCircle,
} from "lucide-react";
import type { Building, CityDecoration } from "@/types/city";

// Template structure
export interface CityTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  cityLevel: number;
  buildings: Building[];
  decorations: CityDecoration[];
}

interface CityTemplateManagerProps {
  buildings: Building[];
  decorations: CityDecoration[];
  cityLevel: number;
  onApplyTemplate: (template: CityTemplate) => void;
}

const STORAGE_KEY = "mp_city_templates";

export function CityTemplateManager({
  buildings,
  decorations,
  cityLevel,
  onApplyTemplate,
}: CityTemplateManagerProps) {
  const [templates, setTemplates] = useState<CityTemplate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    }
  }, []);

  // Save templates to localStorage
  const saveTemplates = useCallback((newTemplates: CityTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
      setTemplates(newTemplates);
    } catch (err) {
      console.error("Error saving templates:", err);
    }
  }, []);

  // Show success message
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // Create new template from current layout
  const handleCreateTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return;

    const template: CityTemplate = {
      id: `template_${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
      cityLevel,
      buildings: JSON.parse(JSON.stringify(buildings)), // Deep clone
      decorations: JSON.parse(JSON.stringify(decorations)),
    };

    saveTemplates([...templates, template]);
    setNewTemplateName("");
    setNewTemplateDesc("");
    setIsCreating(false);
    showSuccess(`模板 "${template.name}" 已儲存`);
  }, [newTemplateName, newTemplateDesc, cityLevel, buildings, decorations, templates, saveTemplates, showSuccess]);

  // Delete template
  const handleDeleteTemplate = useCallback((id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;

    if (window.confirm(`確定要刪除模板 "${template.name}" 嗎？`)) {
      saveTemplates(templates.filter((t) => t.id !== id));
      showSuccess("模板已刪除");
    }
  }, [templates, saveTemplates, showSuccess]);

  // Apply template to current layout
  const handleApplyTemplate = useCallback((template: CityTemplate) => {
    if (window.confirm(`確定要載入模板 "${template.name}" 嗎？這將覆蓋當前的城市佈局。`)) {
      onApplyTemplate(template);
      showSuccess(`已載入模板 "${template.name}"`);
    }
  }, [onApplyTemplate, showSuccess]);

  // Export template as JSON file
  const handleExportTemplate = useCallback((template: CityTemplate) => {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "_")}_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("模板已匯出");
  }, [showSuccess]);

  // Export current layout as JSON
  const handleExportCurrent = useCallback(() => {
    const data = {
      cityLevel,
      buildings,
      decorations,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `city_layout_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("城市佈局已匯出");
  }, [cityLevel, buildings, decorations, showSuccess]);

  // Import template from JSON file
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        // Validate the imported data
        if (!data.buildings || !Array.isArray(data.buildings)) {
          throw new Error("無效的格式：缺少建築數據");
        }
        if (!data.decorations || !Array.isArray(data.decorations)) {
          throw new Error("無效的格式：缺少裝飾數據");
        }

        // Check if it's a template or just layout data
        if (data.id && data.name && data.createdAt) {
          // It's a full template
          const existingIndex = templates.findIndex((t) => t.id === data.id);
          if (existingIndex >= 0) {
            // Replace existing
            if (window.confirm(`模板 "${data.name}" 已存在，要覆蓋嗎？`)) {
              const newTemplates = [...templates];
              newTemplates[existingIndex] = data;
              saveTemplates(newTemplates);
              showSuccess("模板已更新");
            }
          } else {
            // Add new
            saveTemplates([...templates, data]);
            showSuccess(`模板 "${data.name}" 已匯入`);
          }
        } else {
          // It's just layout data, create a template from it
          const template: CityTemplate = {
            id: `template_${Date.now()}`,
            name: file.name.replace(/\.json$/i, "").replace(/_/g, " "),
            createdAt: new Date().toISOString(),
            cityLevel: data.cityLevel ?? 0,
            buildings: data.buildings,
            decorations: data.decorations,
          };
          saveTemplates([...templates, template]);
          showSuccess(`已從檔案創建模板 "${template.name}"`);
        }
      } catch (err: any) {
        setImportError(err.message || "匯入失敗：無效的 JSON 格式");
      }
    };
    reader.onerror = () => {
      setImportError("讀取檔案失敗");
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = "";
  }, [templates, saveTemplates, showSuccess]);

  // Copy current layout JSON to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    const data = {
      cityLevel,
      buildings,
      decorations,
      exportedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      showSuccess("已複製到剪貼板");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [cityLevel, buildings, decorations, showSuccess]);

  return (
    <div className="space-y-4">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/20 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}
      {importError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportCurrent}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          匯出佈局
        </button>
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <Copy className="w-4 h-4" />
          複製 JSON
        </button>
        <label className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          匯入檔案
          <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </label>
      </div>

      {/* Save as Template */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Save className="w-4 h-4" />
          儲存為模板
        </h4>
        {isCreating ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="模板名稱"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
              autoFocus
            />
            <textarea
              value={newTemplateDesc}
              onChange={(e) => setNewTemplateDesc(e.target.value)}
              placeholder="描述 (可選)"
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                儲存
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTemplateName("");
                  setNewTemplateDesc("");
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 w-full px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            將當前佈局儲存為模板
          </button>
        )}
      </div>

      {/* Saved Templates */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          已儲存的模板 ({templates.length})
        </h4>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">尚無儲存的模板</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-3 bg-slate-800 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm truncate">{template.name}</h5>
                    {template.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{template.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span>Lv.{template.cityLevel}</span>
                      <span>•</span>
                      <span>{template.buildings.length} 建築</span>
                      <span>•</span>
                      <span>{template.decorations.length} 裝飾</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-700">
                  <button
                    onClick={() => handleApplyTemplate(template)}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded text-xs transition-colors"
                  >
                    <FolderOpen className="w-3 h-3" />
                    載入
                  </button>
                  <button
                    onClick={() => handleExportTemplate(template)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                  >
                    <FileJson className="w-3 h-3" />
                    匯出
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="flex items-center gap-1 px-2 py-1 ml-auto bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
