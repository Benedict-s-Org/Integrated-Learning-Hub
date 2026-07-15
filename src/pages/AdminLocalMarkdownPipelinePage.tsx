/**
 * Admin Launcher for Local Markdown Pipeline
 * 
 * Note:
 * - This is a launcher page for the standalone pipeline.
 * - It does not replace the standalone UI.
 * - It does not call backend APIs yet.
 * - Future integration may add strict localhost health check and job status polling.
 */
import React, { useState } from 'react';
import { ArrowLeft, Server, Shield, Terminal, Play, CheckCircle2, Lock, FileCode2, Link as LinkIcon, RefreshCw, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminLocalMarkdownPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'checking' | 'healthy' | 'offline'>('unknown');

  const checkHealth = () => {
    // Mock health check for now since CORS isn't set up on the pipeline
    setHealthStatus('checking');
    setTimeout(() => {
      setHealthStatus('offline');
      // Could change this when CORS is ready
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button 
              onClick={() => navigate('/')} 
              className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2"
            >
              <ArrowLeft size={16} /> 返回首頁 (Back to Home)
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Local Markdown Pipeline</h1>
            <p className="mt-2 text-lg text-slate-600">
              Open the standalone local-first document-to-Markdown pipeline.
            </p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Server size={18} />
              <span className="font-semibold text-sm">App Type</span>
            </div>
            <p className="text-slate-700 text-sm font-medium">Standalone FastAPI</p>
            <p className="text-slate-500 text-xs">獨立本機伺服器</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Terminal size={18} />
              <span className="font-semibold text-sm">Runtime</span>
            </div>
            <p className="text-slate-700 text-sm font-medium">Local machine / WS</p>
            <p className="text-slate-500 text-xs">本機或工作站運行</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Shield size={18} />
              <span className="font-semibold text-sm">Security</span>
            </div>
            <p className="text-slate-700 text-sm font-medium">localhost-only</p>
            <p className="text-slate-500 text-xs">僅限本機存取</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <LinkIcon size={18} />
              <span className="font-semibold text-sm">Integration</span>
            </div>
            <p className="text-slate-700 text-sm font-medium">Launcher only</p>
            <p className="text-slate-500 text-xs">純啟動器 (目前)</p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Play className="text-blue-500" size={24} />
                Launch Pipeline UI
              </h2>
              <p className="text-slate-600 mt-2 max-w-lg">
                Start the local pipeline server first, then open this link.
                <br />
                <span className="text-sm text-slate-500">請先啟動本機伺服器，再點擊下方按鈕開啟介面。</span>
              </p>
            </div>
            
            <a 
              href="http://127.0.0.1:8000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors"
            >
              Open Local Pipeline
              <ExternalLink size={18} />
            </a>
          </div>

          <div className="bg-slate-50 p-6 md:p-8">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Terminal size={18} className="text-slate-500"/> Start Instructions (啟動步驟)
            </h3>
            <ol className="space-y-3 text-slate-700 text-sm md:text-base list-decimal list-inside marker:text-slate-400 marker:font-mono">
              <li>Open your terminal application (打開終端機)</li>
              <li>Go to pipeline directory: <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-pink-600 font-mono text-sm ml-2">cd local-markdown-pipeline</code></li>
              <li>Activate the virtual environment: <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-pink-600 font-mono text-sm ml-2">source .venv/bin/activate</code></li>
              <li>Start the backend server: <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-pink-600 font-mono text-sm ml-2">python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000</code></li>
              <li>Return here and click the <strong>Open Local Pipeline</strong> button above.</li>
            </ol>
          </div>
        </div>

        {/* Safety & Future Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Safety Panel */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-4">
              <Lock size={20} className="text-amber-600" />
              Safety & Restrictions (安全限制)
            </h3>
            <ul className="space-y-3 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span><strong>Locally Run:</strong> The pipeline runs entirely on your local machine. No data is sent out. (完全在本機運行，不外傳資料)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span><strong>No Auto Upload:</strong> Processed files are NOT automatically uploaded to Learning Hub yet. (目前不會自動上傳至 Learning Hub)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span><strong>No Tokens:</strong> Do not paste Learning Hub API keys or tokens into the local pipeline. (請勿貼上任何 API 金鑰)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span><strong>Hardware:</strong> Heavy OCR (Phase 5) and local AI Review (Phase 6) require WS GPU for speed. (進階功能需要較高硬體規格)</span>
              </li>
            </ul>
          </div>

          {/* Future Integration */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 flex flex-col">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
              <FileCode2 size={20} className="text-blue-600" />
              Future Integration (未來整合計畫)
            </h3>
            <ul className="space-y-3 text-sm text-blue-800 mb-6 flex-1">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>CORS Configuration:</strong> Strict localhost-only CORS to allow API calls from Learning Hub.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>Live Job Status Bridge:</strong> Display pipeline progress directly within Learning Hub UI.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>Import Approval Flow:</strong> Selectively ingest formatted Markdown into the Content Database.</span>
              </li>
            </ul>

            {/* Optional Health Check Placeholder */}
            <div className="bg-white border border-blue-100 rounded-lg p-4 mt-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <RefreshCw size={14} className={healthStatus === 'checking' ? 'animate-spin' : ''} />
                  Connection Test (Mock)
                </h4>
                <button 
                  onClick={checkHealth}
                  disabled={healthStatus === 'checking'}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                >
                  Check Status
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {healthStatus === 'unknown' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Not Checked</span>}
                {healthStatus === 'checking' && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Pinging 127.0.0.1:8000...</span>}
                {healthStatus === 'offline' && (
                  <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Offline (Needs CORS/Start)
                  </span>
                )}
                {healthStatus === 'healthy' && (
                  <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Online
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                * Note: Real API calls are blocked until CORS is configured in backend/main.py.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminLocalMarkdownPipelinePage;
