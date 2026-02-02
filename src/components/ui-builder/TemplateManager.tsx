// Template Manager - Save, load, and manage UI templates
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Save, 
  FolderOpen, 
  Download, 
  Upload, 
  Trash2, 
  Copy,
  FileJson,
  Sparkles,
  X,
  Check,
  BookTemplate
} from 'lucide-react';
import type { UITemplate, UIElement, PRESET_TEMPLATES } from '@/types/ui-builder';

interface TemplateManagerProps {
  elements: UIElement[];
  onApplyTemplate: (elements: UIElement[]) => void;
  presetTemplates: UITemplate[];
}

const STORAGE_KEY = 'ui_builder_templates';

export function TemplateManager({ 
  elements, 
  onApplyTemplate,
  presetTemplates 
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<UITemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  // Save templates to localStorage
  const saveToStorage = useCallback((newTemplates: UITemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
      setTemplates(newTemplates);
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }, []);

  // Show message
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Save current design as template
  const handleSaveTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      showMessage('error', '請輸入模板名稱');
      return;
    }

    if (elements.length === 0) {
      showMessage('error', '沒有元素可儲存');
      return;
    }

    const template: UITemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || undefined,
      elements: JSON.parse(JSON.stringify(elements)), // Deep clone
      createdAt: new Date().toISOString(),
    };

    saveToStorage([...templates, template]);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setShowSaveForm(false);
    showMessage('success', `已儲存模板「${template.name}」`);
  }, [newTemplateName, newTemplateDesc, elements, templates, saveToStorage]);

  // Apply template
  const handleApplyTemplate = useCallback((template: UITemplate) => {
    if (window.confirm(`確定要載入模板「${template.name}」嗎？這將覆蓋目前的設計。`)) {
      // Generate new IDs for all elements to avoid conflicts
      const clonedElements = JSON.parse(JSON.stringify(template.elements));
      regenerateIds(clonedElements);
      onApplyTemplate(clonedElements);
      showMessage('success', `已載入模板「${template.name}」`);
    }
  }, [onApplyTemplate]);

  // Delete template
  const handleDeleteTemplate = useCallback((id: string) => {
    if (window.confirm('確定要刪除此模板嗎？')) {
      const updated = templates.filter(t => t.id !== id);
      saveToStorage(updated);
      showMessage('success', '模板已刪除');
    }
  }, [templates, saveToStorage]);

  // Export template as JSON
  const handleExportTemplate = useCallback((template: UITemplate) => {
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('success', `已匯出模板「${template.name}」`);
  }, []);

  // Export current design
  const handleExportCurrent = useCallback(() => {
    if (elements.length === 0) {
      showMessage('error', '沒有元素可匯出');
      return;
    }

    const template: UITemplate = {
      id: `export-${Date.now()}`,
      name: '未命名設計',
      elements: elements,
      createdAt: new Date().toISOString(),
    };

    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ui-design-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('success', '設計已匯出');
  }, [elements]);

  // Import template from file
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const template = JSON.parse(event.target?.result as string) as UITemplate;
        
        if (!template.elements || !Array.isArray(template.elements)) {
          throw new Error('無效的模板格式');
        }

        // Add as new template with new ID
        const newTemplate: UITemplate = {
          ...template,
          id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        };

        saveToStorage([...templates, newTemplate]);
        showMessage('success', `已匯入模板「${newTemplate.name}」`);
      } catch (error) {
        showMessage('error', '無法解析 JSON 檔案');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [templates, saveToStorage]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <BookTemplate className="w-4 h-4" />
          模板管理
        </h3>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-2 text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        <button
          onClick={() => setShowSaveForm(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Save className="w-4 h-4" />
          儲存為模板
        </button>
        <button
          onClick={handleExportCurrent}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
        >
          <Download className="w-4 h-4" />
          匯出設計
        </button>
        <label className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          匯入模板
          <input
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </label>
      </div>

      {/* Save Form */}
      {showSaveForm && (
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">模板名稱 *</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="輸入模板名稱..."
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">說明（選填）</label>
              <textarea
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                placeholder="模板說明..."
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveForm(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preset Templates */}
        {presetTemplates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              預設模板
            </h4>
            <div className="space-y-2">
              {presetTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onApply={() => handleApplyTemplate(template)}
                  isPreset
                />
              ))}
            </div>
          </div>
        )}

        {/* User Templates */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FolderOpen className="w-3 h-3" />
            我的模板 ({templates.length})
          </h4>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              尚未儲存任何模板
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onApply={() => handleApplyTemplate(template)}
                  onExport={() => handleExportTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TEMPLATE CARD
// =============================================================================

function TemplateCard({
  template,
  onApply,
  onExport,
  onDelete,
  isPreset = false,
}: {
  template: UITemplate;
  onApply: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  isPreset?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isPreset ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
      }`}>
        {isPreset ? <Sparkles className="w-5 h-5" /> : <FileJson className="w-5 h-5" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h5 className="text-sm font-medium text-foreground truncate">{template.name}</h5>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {template.elements.length} 個元素
          {!isPreset && template.createdAt && (
            <> · {new Date(template.createdAt).toLocaleDateString()}</>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onApply}
          className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
          title="套用模板"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        {onExport && (
          <button
            onClick={onExport}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="匯出"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function regenerateIds(elements: UIElement[]): void {
  for (const element of elements) {
    element.id = `${element.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (element.children) {
      regenerateIds(element.children);
    }
  }
}

export default TemplateManager;
