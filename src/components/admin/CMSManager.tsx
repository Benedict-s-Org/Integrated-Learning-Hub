import React, { useState, useEffect } from 'react';
import { useCMS } from '../../hooks/useCMS';
import { AppContent } from '../../types';
import { Plus, Search, Edit2, Save, X, FileText, Globe, Info } from 'lucide-react';

export const CMSManager: React.FC = () => {
  const { loading, error, getAllContent, updateContent } = useCMS();
  const [contents, setContents] = useState<AppContent[]>([]);
  const [filter, setFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  
  // Form State
  const [form, setForm] = useState({
    key: '',
    content: '',
    description: ''
  });

  const loadContent = async () => {
    const data = await getAllContent();
    setContents(data);
  };

  useEffect(() => {
    loadContent();
  }, [getAllContent]);

  const handleEdit = (item: AppContent) => {
    setEditingKey(item.key);
    setForm({
      key: item.key,
      content: JSON.stringify(item.content, null, 2),
      description: item.description || ''
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingKey(null);
    setForm({
      key: '',
      content: '{}',
      description: ''
    });
  };

  const handleSave = async () => {
    try {
      let parsedContent;
      try {
        parsedContent = JSON.parse(form.content);
      } catch (e) {
        alert('Invalid JSON format. Please check your syntax.');
        return;
      }

      const success = await updateContent(form.key, parsedContent, form.description);
      if (success) {
        setEditingKey(null);
        setIsAdding(false);
        await loadContent();
      } else {
        alert('Failed to save content.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredContents = contents.filter(c => 
    c.key.toLowerCase().includes(filter.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="text-blue-500" />
            App Content Manager (CMS)
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage UI strings, study information, and customizable component content.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"
        >
          <Plus size={18} />
          <span>Add New Key</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search keys or descriptions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {(isAdding || editingKey) && (
        <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">
              {isAdding ? 'Create New Content' : `Editing: ${editingKey}`}
            </h3>
            <button onClick={() => { setIsAdding(false); setEditingKey(null); }} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key (Unique ID)</label>
              <input
                type="text"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                disabled={!!editingKey}
                placeholder="e.g. anagram_welcome_title"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short note about where this is used..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Content (JSON)</label>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Standard JSON Object</span>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={12}
              className="w-full px-4 py-3 font-mono text-sm bg-slate-900 text-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none border-2 border-slate-800 shadow-inner"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setIsAdding(false); setEditingKey(null); }}
              className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 font-bold"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
              Save Changes
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContents.map((item) => (
          <div 
            key={item.key} 
            className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
            onClick={() => handleEdit(item)}
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 size={16} className="text-blue-500" />
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-800 truncate" title={item.key}>
                  {item.key}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                  {item.description || 'No description provided'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-50">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Last updated: {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'Never'}</span>
                <span className="bg-slate-50 px-2 py-0.5 rounded text-blue-500 font-bold">
                  {Object.keys(item.content || {}).length} Fields
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredContents.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search size={32} />
            </div>
            <h3 className="text-slate-600 font-bold">No content found</h3>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search filter.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 mt-4 text-red-600">
          <Info size={18} className="shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}
    </div>
  );
};
