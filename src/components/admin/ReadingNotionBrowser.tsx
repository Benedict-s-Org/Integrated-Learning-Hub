import React, { useState, useEffect } from 'react';
import { Database, Search, Loader2, Book, ArrowRight, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ReadingNotionBrowserProps {
  onSelect: (pdfUrl: string, title: string) => void;
  onCancel: () => void;
}

interface Activity {
  id: string;
  name: string;
  pdfUrl?: string | null;
}

export const ReadingNotionBrowser: React.FC<ReadingNotionBrowserProps> = ({ onSelect, onCancel }) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const DATABASE_ID = "3239baca6fa380a9b501deceb133946d";

  useEffect(() => {
    fetchNotionData();
  }, []);

  const fetchNotionData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[ReadingNotionBrowser] Debug Info:', {
        url: (supabase as any).functions.url,
        functionName: 'reading-api'
      });
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/reading-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ 
          action: 'list-activities',
          databaseId: DATABASE_ID 
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[ReadingNotionBrowser] Notion API Response:', data);

      setActivities(data.activities || []);
    } catch (err: any) {
      console.error('Error fetching Notion activities:', err);
      setError(err.message || 'Failed to connect to Notion.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = activities.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full mx-auto shadow-2xl border border-slate-100 max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Select from Notion</h2>
            <p className="text-slate-500 text-sm">Choose a practice to import PDF</p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="mt-4 text-slate-500 font-medium">Fetching your Notion library...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="font-bold text-red-900 mb-1">Connection Error</p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button 
              onClick={fetchNotionData}
              className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Book className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">No matching practices found in Notion.</p>
          </div>
        ) : (
          filtered.map(activity => (
            <button
              key={activity.id}
              onClick={() => {
                if (activity.pdfUrl) {
                  onSelect(activity.pdfUrl, activity.name);
                } else {
                  alert('This Notion entry has no PDF in the "Source PDF" column.');
                }
              }}
              disabled={!activity.pdfUrl}
              className={`w-full p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                activity.pdfUrl 
                  ? 'border-slate-100 bg-white hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-50/50' 
                  : 'border-slate-50 bg-slate-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                <div className={`p-3 rounded-xl ${activity.pdfUrl ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 truncate max-w-sm">{activity.name}</h4>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                    {activity.pdfUrl ? 'PDF Available' : 'No PDF linked'}
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 transition-transform ${activity.pdfUrl ? 'text-indigo-600 group-hover:translate-x-1' : 'text-slate-200'}`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
};
