/**
 * Admin Launcher for Local Markdown Pipeline
 * 
 * Note:
 * - This is a launcher page for the standalone pipeline.
 * - It does not replace the standalone UI.
 * - It does not call backend APIs yet.
 * - Future integration may add strict localhost health check and job status polling.
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Shield, Terminal, Play, CheckCircle2, Lock, FileCode2, Link as LinkIcon, RefreshCw, ExternalLink, Activity, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SummaryResponse {
  status: string;
  code?: string;
  has_manifest?: boolean;
  summary?: {
    total_files_found: number;
    supported_files_count: number;
    skipped_files_count: number;
    failed_files_count: number;
  };
  progress?: {
    pending: number;
    success: number;
    failed: number;
    pending_ocr: number;
    converted_with_warning: number;
    ai_review_success: number;
  };
  quality?: {
    average_quality_score: number | null;
    files_with_warnings: number;
  };
  last_updated?: string | null;
}

const AdminLocalMarkdownPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'checking' | 'running' | 'not_running' | 'cors_or_offline'>('unknown');
  const [pipelineStatus, setPipelineStatus] = useState<{is_busy: boolean, active_jobs: Record<string, number>} | null>(null);
  const [statusCheckTime, setStatusCheckTime] = useState<Date | null>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  const [outputPath, setOutputPath] = useState<string>('');
  const [summaryState, setSummaryState] = useState<'unknown' | 'loading' | 'available' | 'invalid_folder' | 'manifest_not_found' | 'manifest_invalid' | 'summary_unavailable' | 'cors_or_offline'>('unknown');
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);

  // Phase L5B state
  const [scanInputPath, setScanInputPath] = useState('');
  const [scanOutputPath, setScanOutputPath] = useState('');
  const [scanConfirm, setScanConfirm] = useState(false);
  const [scanState, setScanState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<{total_files_found: number; supported_files_count: number; skipped_files_count: number} | null>(null);
  const [scanError, setScanError] = useState<string>('');

  // Phase L6B state
  const [convertInputPath, setConvertInputPath] = useState('');
  const [convertOutputPath, setConvertOutputPath] = useState('');
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [convertState, setConvertState] = useState<'idle' | 'starting' | 'queued' | 'running' | 'completed' | 'failed' | 'expired' | 'error'>('idle');
  const [convertSessionToken, setConvertSessionToken] = useState<string>('');
  const [convertResult, setConvertResult] = useState<{total_files_considered: number; converted_count: number; failed_count: number; skipped_count: number; warning_count: number} | null>(null);
  const [convertError, setConvertError] = useState<string>('');

  // Phase L7A Full Clean Execution state
  const [cleanExecOutputPath, setCleanExecOutputPath] = useState('');
  const [cleanExecConfirm, setCleanExecConfirm] = useState(false);
  const [cleanExecState, setCleanExecState] = useState<'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'error'>('idle');
  const [cleanExecJobId, setCleanExecJobId] = useState<string>('');
  const [cleanExecResult, setCleanExecResult] = useState<{total: number; done: number; failures: number} | null>(null);
  const [cleanExecError, setCleanExecError] = useState<string>('');


  // Phase L7B Clean Preview state
  const [cleanInputPath, setCleanInputPath] = useState('');
  const [cleanConfirm, setCleanConfirm] = useState(false);
  const [cleanState, setCleanState] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [cleanJobId, setCleanJobId] = useState<string>('');
  const [cleanResult, setCleanResult] = useState<{eligibility: string; blockedReasons: string[]; warningCategories: string[]; plannedPreviewActions: string[]; nextAllowedStep: string} | null>(null);
  const [cleanError, setCleanError] = useState<string>('');

  // Phase L7B Retry Preview state
  const [retryInputPath, setRetryInputPath] = useState('');
  const [retryStage, setRetryStage] = useState('convert');
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [retryState, setRetryState] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [retryJobId, setRetryJobId] = useState<string>('');
  const [retryResult, setRetryResult] = useState<{eligibility: string; blockedReasons: string[]; warningCategories: string[]; candidateRetryPlan: string[]; nextAllowedStep: string} | null>(null);
  const [retryError, setRetryError] = useState<string>('');

  const fetchSummary = async () => {
    if (!outputPath.trim()) return;
    setSummaryState('loading');
    setSummaryData(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://127.0.0.1:8000/api/summary/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_path: outputPath }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data);
        setSummaryState('available');
      } else {
        if (data.code === 'invalid_output_directory') setSummaryState('invalid_folder');
        else if (data.code === 'manifest_not_found') setSummaryState('manifest_not_found');
        else if (data.code === 'manifest_invalid' || data.code === 'manifest_unreadable') setSummaryState('manifest_invalid');
        else setSummaryState('summary_unavailable');
      }
    } catch (err) {
      setSummaryState('cors_or_offline');
    }
  };

  const runScanPreview = async () => {
    if (!scanConfirm || !scanInputPath.trim() || !scanOutputPath.trim()) return;
    
    setScanState('running');
    setScanError('');
    setScanResult(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // Scans can take a bit longer
      const res = await fetch('http://127.0.0.1:8000/api/controlled/scan-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          job_type: 'scan_preview',
          input_path: scanInputPath,
          output_path: scanOutputPath
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setScanState('success');
        setScanResult(data.summary);
      } else {
        setScanState('error');
        setScanError(data.code || 'unknown_error');
      }
    } catch (err) {
      setScanState('error');
      setScanError('cors_or_offline');
    }
  };

  const checkHealth = async () => {
    setHealthStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://127.0.0.1:8000/health', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setHealthStatus('running');
      } else {
        setHealthStatus('not_running');
      }
    } catch (err) {
      // Fetch fails if offline or CORS blocked
      setHealthStatus('cors_or_offline');
    }
  };

  const checkActivity = async () => {
    setStatusChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://127.0.0.1:8000/api/status', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setPipelineStatus(data);
        setStatusCheckTime(new Date());
      }
    } catch (err) {
      console.error("Failed to check activity", err);
    } finally {
      setStatusChecking(false);
    }
  };

  const runConvertPreview = async () => {
    if (!convertConfirm || !convertInputPath.trim() || !convertOutputPath.trim()) return;
    
    setConvertState('starting');
    setConvertError('');
    setConvertResult(null);
    setConvertSessionToken('');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('http://127.0.0.1:8000/api/controlled/convert-preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          job_type: 'convert_preview',
          input_path: convertInputPath,
          output_path: convertOutputPath,
          confirm: convertConfirm
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok && data.status === 'accepted') {
        setConvertState(data.state || 'queued');
        setConvertSessionToken(data.session_token);
        
        // Clear paths per security rules
        setConvertInputPath('');
        setConvertOutputPath('');
        setConvertConfirm(false);
      } else {
        setConvertState('error');
        setConvertError(data.code || 'unknown_error');
      }
    } catch (err) {
      setConvertState('error');
      setConvertError('cors_or_offline');
    }
  };

  useEffect(() => {
    if (!convertSessionToken || ['completed', 'failed', 'expired', 'error'].includes(convertState)) {
      return;
    }
    
    let isSubscribed = true;
    
    const pollStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/controlled/convert-preview/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            session_token: convertSessionToken
          })
        });
        
        const data = await res.json();
        if (!isSubscribed) return;
        
        if (res.ok && data.status === 'ok') {
          setConvertState(data.state);
          if (data.summary) {
            setConvertResult(data.summary);
          }
        } else {
          setConvertState('error');
          setConvertError(data.code || 'unknown_error');
        }
      } catch (err) {
        if (!isSubscribed) return;
        setConvertState('error');
        setConvertError('cors_or_offline');
      }
    };
    
    const interval = setInterval(pollStatus, 2000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [convertSessionToken, convertState]);


  const runCleanExecution = async () => {
    if (!cleanExecConfirm || !cleanExecOutputPath.trim()) return;
    
    setCleanExecState('starting');
    setCleanExecError('');
    setCleanExecResult(null);
    setCleanExecJobId('');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('http://127.0.0.1:8000/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          output_path: cleanExecOutputPath
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok && data.status === 'started') {
        setCleanExecState('running');
        setCleanExecJobId(data.job_id);
        
        // Clear paths per security rules
        setCleanExecOutputPath('');
        setCleanExecConfirm(false);
      } else {
        setCleanExecState('error');
        setCleanExecError(data.message || data.code || 'unknown_error');
      }
    } catch (err) {
      setCleanExecState('error');
      setCleanExecError('cors_or_offline');
    }
  };

  useEffect(() => {
    if (!cleanExecJobId || ['completed', 'failed', 'error'].includes(cleanExecState)) {
      return;
    }
    
    let isSubscribed = true;
    
    const pollStatus = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/clean/status/${cleanExecJobId}`, {
          method: 'GET'
        });
        
        const data = await res.json();
        if (!isSubscribed) return;
        
        if (res.ok) {
          if (data.status === 'completed') {
            setCleanExecState('completed');
            setCleanExecResult(data.progress || null);
          } else if (data.status === 'error' || data.status === 'failed') {
            setCleanExecState('error');
            setCleanExecError(data.message || 'unknown_error');
          } else {
            setCleanExecState('running');
            if (data.progress) setCleanExecResult(data.progress);
          }
        } else {
          setCleanExecState('error');
          setCleanExecError(data.message || data.code || 'unknown_error');
        }
      } catch (err) {
        if (!isSubscribed) return;
        setCleanExecState('error');
        setCleanExecError('cors_or_offline');
      }
    };
    
    const interval = setInterval(pollStatus, 2000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [cleanExecJobId, cleanExecState]);


  const runCleanPreview = async () => {
    if (!cleanConfirm || !cleanInputPath.trim()) return;
    
    setCleanState('starting');
    setCleanError('');
    setCleanResult(null);
    setCleanJobId('');
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/controlled/clean-preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target_file: cleanInputPath,
          options: { dry_run: true }
        })
      });
      
      const data = await res.json();
      if (res.ok && data.status === 'PENDING') {
        setCleanState('running');
        setCleanJobId(data.job_id);
        setCleanInputPath('');
        setCleanConfirm(false);
      } else {
        setCleanState('error');
        setCleanError(data.code || 'unknown_error');
      }
    } catch (err) {
      setCleanState('error');
      setCleanError('cors_or_offline');
    }
  };

  useEffect(() => {
    if (!cleanJobId || ['completed', 'error'].includes(cleanState)) {
      return;
    }
    
    let isSubscribed = true;
    
    const pollStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/controlled/clean-preview/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: cleanJobId })
        });
        
        const data = await res.json();
        if (!isSubscribed) return;
        
        if (res.ok && data.status === 'COMPLETED') {
          setCleanState('completed');
          setCleanResult({
            eligibility: data.eligibility,
            blockedReasons: data.blockedReasons || [],
            warningCategories: data.warningCategories || [],
            plannedPreviewActions: data.plannedPreviewActions || [],
            nextAllowedStep: data.nextAllowedStep || 'none'
          });
        } else if (!res.ok) {
          setCleanState('error');
          setCleanError(data.code || 'unknown_error');
        }
      } catch (err) {
        if (!isSubscribed) return;
        setCleanState('error');
        setCleanError('cors_or_offline');
      }
    };
    
    const interval = setInterval(pollStatus, 2000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [cleanJobId, cleanState]);

  const runRetryPreview = async () => {
    if (!retryConfirm || !retryInputPath.trim() || !retryStage) return;
    
    setRetryState('starting');
    setRetryError('');
    setRetryResult(null);
    setRetryJobId('');
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/controlled/retry-preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target_file: retryInputPath,
          stage_to_retry: retryStage,
          options: { dry_run: true }
        })
      });
      
      const data = await res.json();
      if (res.ok && data.status === 'PENDING') {
        setRetryState('running');
        setRetryJobId(data.job_id);
        setRetryInputPath('');
        setRetryConfirm(false);
      } else {
        setRetryState('error');
        setRetryError(data.code || 'unknown_error');
      }
    } catch (err) {
      setRetryState('error');
      setRetryError('cors_or_offline');
    }
  };

  useEffect(() => {
    if (!retryJobId || ['completed', 'error'].includes(retryState)) {
      return;
    }
    
    let isSubscribed = true;
    
    const pollStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/controlled/retry-preview/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: retryJobId })
        });
        
        const data = await res.json();
        if (!isSubscribed) return;
        
        if (res.ok && data.status === 'COMPLETED') {
          setRetryState('completed');
          setRetryResult({
            eligibility: data.eligibility,
            blockedReasons: data.blockedReasons || [],
            warningCategories: data.warningCategories || [],
            candidateRetryPlan: data.candidateRetryPlan || [],
            nextAllowedStep: data.nextAllowedStep || 'none'
          });
        } else if (!res.ok) {
          setRetryState('error');
          setRetryError(data.code || 'unknown_error');
        }
      } catch (err) {
        if (!isSubscribed) return;
        setRetryState('error');
        setRetryError('cors_or_offline');
      }
    };
    
    const interval = setInterval(pollStatus, 2000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [retryJobId, retryState]);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
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

          {/* Phase L2: Health Check Bridge */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 flex flex-col">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-4">
              <FileCode2 size={20} className="text-blue-600" />
              Phase L2: Health Check Bridge
            </h3>
            <ul className="space-y-3 text-sm text-blue-800 mb-6 flex-1">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>Health Check Only:</strong> This phase checks server availability only. (僅確認伺服器狀態)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>No Processing:</strong> No file processing is triggered, no documents uploaded, and no AI/OCR job is started. (不觸發文件處理)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                <span><strong>Standalone Operation:</strong> Heavy processing still remains inside the standalone pipeline. (繁重處理保留在獨立管線)</span>
              </li>
            </ul>

            <div className="bg-white border border-blue-100 rounded-lg p-4 mt-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <RefreshCw size={14} className={healthStatus === 'checking' ? 'animate-spin' : ''} />
                  Connection Test
                </h4>
                <button 
                  onClick={checkHealth}
                  disabled={healthStatus === 'checking'}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                >
                  Check Local Pipeline
                </button>
              </div>
              
              <div className="text-xs text-slate-500 font-mono mb-3 bg-slate-50 p-2 rounded">
                GET http://127.0.0.1:8000/health
              </div>
              
              <div className="flex items-center gap-2">
                {healthStatus === 'unknown' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Unknown</span>}
                {healthStatus === 'checking' && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Checking...</span>}
                {healthStatus === 'not_running' && (
                  <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Not running
                  </span>
                )}
                {healthStatus === 'cors_or_offline' && (
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> CORS blocked / setup needed
                  </span>
                )}
                {healthStatus === 'running' && (
                  <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Running
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Phase L3A: Pipeline Activity */}
          <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-6 flex flex-col">
            <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-4">
              <Activity size={20} className="text-purple-600" />
              Pipeline Activity (活動狀態)
            </h3>
            <p className="text-sm text-purple-800 mb-6 flex-1">
              This panel is read-only. It only shows whether the local pipeline is idle or busy. It does not reveal file paths, document names, or document contents.
            </p>

            <div className="bg-white border border-purple-100 rounded-lg p-4 mt-auto">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <RefreshCw size={14} className={statusChecking ? 'animate-spin' : ''} />
                  Status
                </h4>
                <button 
                  onClick={checkActivity}
                  disabled={statusChecking}
                  className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                >
                  Refresh Activity
                </button>
              </div>

              <div className="space-y-2 mb-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-600">State</span>
                  {pipelineStatus ? (
                    <span className={`font-medium ${pipelineStatus.is_busy ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {pipelineStatus.is_busy ? 'Busy' : 'Idle'}
                    </span>
                  ) : (
                    <span className="text-slate-400">Unknown</span>
                  )}
                </div>
                {pipelineStatus && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Active Total</span>
                      <span className="font-medium text-slate-700">
                        {Object.values(pipelineStatus.active_jobs).reduce((a, b) => a + b, 0)}
                      </span>
                    </div>
                    {Object.entries(pipelineStatus.active_jobs).map(([jobType, count]) => (
                      <div key={jobType} className="flex justify-between text-xs pl-2">
                        <span className="text-slate-400 capitalize">{jobType}</span>
                        <span className="text-slate-600">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-[10px] text-slate-400 text-right">
                {statusCheckTime ? `Last checked: ${statusCheckTime.toLocaleTimeString()}` : 'Never checked'}
              </div>
            </div>
          </div>
        </div>

        {/* Phase L4A: Sanitized Output Summary */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-6 mt-6">
          <h3 className="font-bold text-emerald-900 flex items-center gap-2 mb-4">
            <FileText size={20} className="text-emerald-600" />
            Phase L4A: Sanitized Output Summary (管線輸出摘要)
          </h3>
          <p className="text-sm text-emerald-800 mb-4 bg-emerald-100/50 p-3 rounded-lg border border-emerald-200/50">
            <strong>Safety Notice:</strong> This summary is sanitized. The output folder path is sent only to the local pipeline backend at 127.0.0.1 and is not saved in Learning Hub. Only numeric aggregates are returned. Filenames, paths, document contents, OCR text, and AI review comments are never displayed.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline output folder path</label>
              <input 
                type="text" 
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Paste local output folder path"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button 
              onClick={fetchSummary}
              disabled={summaryState === 'loading' || !outputPath.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 shrink-0 h-[38px] flex items-center"
            >
              {summaryState === 'loading' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
              View Sanitized Summary
            </button>
          </div>

          <div className="bg-white border border-emerald-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Status:</span>
              {summaryState === 'unknown' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Unknown</span>}
              {summaryState === 'loading' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Loading...</span>}
              {summaryState === 'available' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Summary available</span>}
              {summaryState === 'invalid_folder' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Invalid folder</span>}
              {summaryState === 'manifest_not_found' && <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">Manifest not found</span>}
              {summaryState === 'manifest_invalid' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Manifest invalid</span>}
              {summaryState === 'summary_unavailable' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Summary unavailable</span>}
              {summaryState === 'cors_or_offline' && <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">CORS / offline</span>}
            </div>

            {summaryData && summaryData.summary && summaryData.progress && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-500 mb-1">Total files</span>
                  <span className="text-lg font-semibold text-slate-800">{summaryData.summary.total_files_found}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-500 mb-1">Supported files</span>
                  <span className="text-lg font-semibold text-slate-800">{summaryData.summary.supported_files_count}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-500 mb-1">Skipped files</span>
                  <span className="text-lg font-semibold text-slate-800">{summaryData.summary.skipped_files_count}</span>
                </div>
                <div className="bg-rose-50 p-3 rounded border border-rose-100 flex flex-col">
                  <span className="text-xs text-rose-500 mb-1">Failed files</span>
                  <span className="text-lg font-semibold text-rose-700">{summaryData.summary.failed_files_count}</span>
                </div>
                <div className="bg-amber-50 p-3 rounded border border-amber-100 flex flex-col">
                  <span className="text-xs text-amber-600 mb-1">Pending</span>
                  <span className="text-lg font-semibold text-amber-700">{summaryData.progress.pending}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100 flex flex-col">
                  <span className="text-xs text-emerald-600 mb-1">Success</span>
                  <span className="text-lg font-semibold text-emerald-700">{summaryData.progress.success}</span>
                </div>
                <div className="bg-purple-50 p-3 rounded border border-purple-100 flex flex-col">
                  <span className="text-xs text-purple-600 mb-1">Pending OCR</span>
                  <span className="text-lg font-semibold text-purple-700">{summaryData.progress.pending_ocr}</span>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100 flex flex-col">
                  <span className="text-xs text-orange-600 mb-1">Converted w/ warning</span>
                  <span className="text-lg font-semibold text-orange-700">{summaryData.progress.converted_with_warning}</span>
                </div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100 flex flex-col">
                  <span className="text-xs text-indigo-600 mb-1">AI review success</span>
                  <span className="text-lg font-semibold text-indigo-700">{summaryData.progress.ai_review_success}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                  <span className="text-xs text-slate-500 mb-1">Avg quality score</span>
                  <span className="text-lg font-semibold text-slate-800">{summaryData.quality?.average_quality_score !== null ? summaryData.quality?.average_quality_score : 'N/A'}</span>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100 flex flex-col">
                  <span className="text-xs text-orange-600 mb-1">Files w/ warnings</span>
                  <span className="text-lg font-semibold text-orange-700">{summaryData.quality?.files_with_warnings || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase L5B: Controlled Scan-Only Wrapper */}
        <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-6 mt-6">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4">
            <Shield size={20} className="text-indigo-600" />
            Phase L5B: Controlled Scan Preview (安全掃描預覽)
          </h3>
          <p className="text-sm text-indigo-800 mb-4 bg-indigo-100/50 p-3 rounded-lg border border-indigo-200/50">
            <strong>Safety Notice:</strong> This action triggers a local-only file scan. It does NOT upload files or modify them. Only aggregate numbers are returned to Learning Hub.
          </p>
          
          <div className="flex flex-col gap-4 mb-6">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Input folder path (to scan)</label>
              <input 
                type="text" 
                value={scanInputPath}
                onChange={(e) => setScanInputPath(e.target.value)}
                placeholder="Local directory to scan"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Output folder path (for local manifest)</label>
              <input 
                type="text" 
                value={scanOutputPath}
                onChange={(e) => setScanOutputPath(e.target.value)}
                placeholder="Local directory for manifest"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <label className="flex items-start gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative flex items-center mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={scanConfirm}
                  onChange={(e) => setScanConfirm(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-4 h-4 border-2 border-slate-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                </div>
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                <strong>I confirm</strong> that I want to trigger a local scan. No files will be uploaded or modified.
              </span>
            </label>
            
            <div className="mt-2">
              <button 
                onClick={runScanPreview}
                disabled={!scanConfirm || !scanInputPath.trim() || !scanOutputPath.trim() || scanState === 'running'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 h-[38px] flex items-center w-fit"
              >
                {scanState === 'running' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                Run Scan Preview
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-indigo-100 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Scan Status:</span>
              {scanState === 'idle' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Ready</span>}
              {scanState === 'running' && <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">Scanning locally...</span>}
              {scanState === 'success' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Scan successful</span>}
              {scanState === 'error' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Error: {scanError}</span>}
             </div>
             
             {scanState === 'success' && scanResult && (
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                   <span className="text-xs text-slate-500 mb-1">Total found</span>
                   <span className="text-lg font-semibold text-slate-800">{scanResult.total_files_found}</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                   <span className="text-xs text-slate-500 mb-1">Supported</span>
                   <span className="text-lg font-semibold text-slate-800">{scanResult.supported_files_count}</span>
                 </div>
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                   <span className="text-xs text-slate-500 mb-1">Skipped</span>
                   <span className="text-lg font-semibold text-slate-800">{scanResult.skipped_files_count}</span>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Phase L6B: Controlled Convert Preview */}
        <div className="bg-sky-50/50 border border-sky-200 rounded-xl p-6 mt-6 mb-8">
          <h3 className="font-bold text-sky-900 flex items-center gap-2 mb-4">
            <Shield size={20} className="text-sky-600" />
            Phase L6B: Controlled Convert Preview (安全轉換預覽)
          </h3>
          <p className="text-sm text-sky-800 mb-4 bg-sky-100/50 p-3 rounded-lg border border-sky-200/50">
            <strong>Safety Notice:</strong> This action triggers local file conversions. It reads local file contents and writes converted outputs locally. <strong>No files are uploaded and nothing is imported into Learning Hub.</strong> Only aggregate numbers are returned to Learning Hub.
          </p>
          
          <div className="flex flex-col gap-4 mb-6">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Input folder path</label>
              <input 
                type="text" 
                value={convertInputPath}
                onChange={(e) => setConvertInputPath(e.target.value)}
                placeholder="Local directory to convert from"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={!!convertSessionToken}
              />
            </div>
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Output folder path (must contain manifest)</label>
              <input 
                type="text" 
                value={convertOutputPath}
                onChange={(e) => setConvertOutputPath(e.target.value)}
                placeholder="Local directory containing _job_manifest.json"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={!!convertSessionToken}
              />
            </div>
            
            <label className="flex items-start gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative flex items-center mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={convertConfirm}
                  onChange={(e) => setConvertConfirm(e.target.checked)}
                  className="peer sr-only"
                  disabled={!!convertSessionToken}
                />
                <div className="w-4 h-4 border-2 border-slate-300 rounded bg-white peer-checked:bg-sky-600 peer-checked:border-sky-600 transition-all flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                </div>
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                <strong>I understand and confirm</strong> that this action will read local file contents and write converted Markdown files locally. I confirm that no files will be uploaded to Learning Hub.
              </span>
            </label>
            
            <div className="mt-2">
              <button 
                onClick={runConvertPreview}
                disabled={!convertConfirm || !convertInputPath.trim() || !convertOutputPath.trim() || !!convertSessionToken}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 h-[38px] flex items-center w-fit"
              >
                {convertState === 'starting' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                Start Convert Preview
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-sky-100 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Convert Status:</span>
              {convertState === 'idle' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Ready</span>}
              {convertState === 'starting' && <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded">Starting...</span>}
              {convertState === 'queued' && <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded">Queued...</span>}
              {convertState === 'running' && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Converting locally...</span>}
              {convertState === 'completed' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Completed</span>}
              {convertState === 'expired' && <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">Session expired</span>}
              {convertState === 'failed' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Job failed</span>}
              {convertState === 'error' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Error: {convertError}</span>}
             </div>
             
             {convertResult && (
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                   <span className="text-xs text-slate-500 mb-1">Total considered</span>
                   <span className="text-lg font-semibold text-slate-800">{convertResult.total_files_considered}</span>
                 </div>
                 <div className="bg-emerald-50 p-3 rounded border border-emerald-100 flex flex-col">
                   <span className="text-xs text-emerald-600 mb-1">Converted</span>
                   <span className="text-lg font-semibold text-emerald-700">{convertResult.converted_count}</span>
                 </div>
                 <div className="bg-rose-50 p-3 rounded border border-rose-100 flex flex-col">
                   <span className="text-xs text-rose-500 mb-1">Failed</span>
                   <span className="text-lg font-semibold text-rose-700">{convertResult.failed_count}</span>
                 </div>
                 <div className="bg-amber-50 p-3 rounded border border-amber-100 flex flex-col">
                   <span className="text-xs text-amber-600 mb-1">Skipped (OCR pending)</span>
                   <span className="text-lg font-semibold text-amber-700">{convertResult.skipped_count}</span>
                 </div>
                 <div className="bg-orange-50 p-3 rounded border border-orange-100 flex flex-col">
                   <span className="text-xs text-orange-600 mb-1">Warnings</span>
                   <span className="text-lg font-semibold text-orange-700">{convertResult.warning_count}</span>
                 </div>
               </div>
             )}
          </div>
        </div>


        {/* Phase L7A: Full Folder Clean Execution */}
        <div className="bg-fuchsia-50/50 border border-fuchsia-200 rounded-xl p-6 mt-6 mb-8">
          <h3 className="font-bold text-fuchsia-900 flex items-center gap-2 mb-4">
            <Shield size={20} className="text-fuchsia-600" />
            Phase L7A: Full Folder Clean (全資料夾清理與格式化)
          </h3>
          <p className="text-sm text-fuchsia-800 mb-4 bg-fuchsia-100/50 p-3 rounded-lg border border-fuchsia-200/50">
            <strong>Safety Notice:</strong> This action triggers local file cleaning and frontmatter generation. It reads local converted Markdown files and writes final `.cleaned.md` and `_index.md` files locally. <strong>No files are uploaded and nothing is imported into Learning Hub.</strong> Only aggregate numbers are returned to Learning Hub.
          </p>
          
          <div className="flex flex-col gap-4 mb-6">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Output folder path (must contain manifest)</label>
              <input 
                type="text" 
                value={cleanExecOutputPath}
                onChange={(e) => setCleanExecOutputPath(e.target.value)}
                placeholder="Local directory containing _job_manifest.json"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                disabled={!!cleanExecJobId}
              />
            </div>
            
            <label className="flex items-start gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative flex items-center mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={cleanExecConfirm}
                  onChange={(e) => setCleanExecConfirm(e.target.checked)}
                  className="peer sr-only"
                  disabled={!!cleanExecJobId}
                />
                <div className="w-4 h-4 border-2 border-slate-300 rounded bg-white peer-checked:bg-fuchsia-600 peer-checked:border-fuchsia-600 transition-all flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                </div>
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                <strong>I understand and confirm</strong> that this action will write cleaned Markdown files and index files locally. I confirm that no files will be uploaded to Learning Hub.
              </span>
            </label>
            
            <div className="mt-2">
              <button 
                onClick={runCleanExecution}
                disabled={!cleanExecConfirm || !cleanExecOutputPath.trim() || !!cleanExecJobId}
                className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 h-[38px] flex items-center w-fit"
              >
                {cleanExecState === 'starting' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                Start Clean Execution
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-fuchsia-100 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Clean Status:</span>
              {cleanExecState === 'idle' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Ready</span>}
              {cleanExecState === 'starting' && <span className="text-xs px-2 py-1 bg-fuchsia-100 text-fuchsia-700 rounded">Starting...</span>}
              {cleanExecState === 'running' && <span className="text-xs px-2 py-1 bg-fuchsia-100 text-fuchsia-700 rounded flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Cleaning locally...</span>}
              {cleanExecState === 'completed' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Completed</span>}
              {cleanExecState === 'failed' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Job failed</span>}
              {cleanExecState === 'error' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Error: {cleanExecError}</span>}
             </div>
             
             {cleanExecResult && (
               <div className="grid grid-cols-3 gap-3">
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col">
                   <span className="text-xs text-slate-500 mb-1">Total items</span>
                   <span className="text-lg font-semibold text-slate-800">{cleanExecResult.total}</span>
                 </div>
                 <div className="bg-emerald-50 p-3 rounded border border-emerald-100 flex flex-col">
                   <span className="text-xs text-emerald-600 mb-1">Cleaned successfully</span>
                   <span className="text-lg font-semibold text-emerald-700">{cleanExecResult.done}</span>
                 </div>
                 <div className="bg-rose-50 p-3 rounded border border-rose-100 flex flex-col">
                   <span className="text-xs text-rose-500 mb-1">Failed</span>
                   <span className="text-lg font-semibold text-rose-700">{cleanExecResult.failures}</span>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Phase L7B: Controlled Clean Preview */}
        <div className="bg-fuchsia-50/50 border border-fuchsia-200 rounded-xl p-6 mt-6 mb-8">
          <h3 className="font-bold text-fuchsia-900 flex items-center gap-2 mb-4">
            <Shield size={20} className="text-fuchsia-600" />
            Phase L7B: Controlled Clean Preview
          </h3>
          <p className="text-sm text-fuchsia-800 mb-4 bg-fuchsia-100/50 p-3 rounded-lg border border-fuchsia-200/50">
            <strong>Safety Notice:</strong> Preview only — no files will be changed. Dry-run only — clean execution remains disabled.
          </p>
          
          <div className="flex flex-col gap-4 mb-6">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target File (Basename only)</label>
              <input 
                type="text" 
                value={cleanInputPath}
                onChange={(e) => setCleanInputPath(e.target.value)}
                placeholder="document.md"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                disabled={!!cleanJobId && cleanState !== 'completed' && cleanState !== 'error'}
              />
            </div>
            
            <label className="flex items-start gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative flex items-center mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={cleanConfirm}
                  onChange={(e) => setCleanConfirm(e.target.checked)}
                  className="peer sr-only"
                  disabled={!!cleanJobId && cleanState !== 'completed' && cleanState !== 'error'}
                />
                <div className="w-4 h-4 border-2 border-slate-300 rounded bg-white peer-checked:bg-fuchsia-600 peer-checked:border-fuchsia-600 transition-all flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                </div>
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                <strong>I understand</strong> this is a dry-run preview. No actual files will be cleaned.
              </span>
            </label>
            
            <div className="mt-2">
              <button 
                onClick={runCleanPreview}
                disabled={!cleanConfirm || !cleanInputPath.trim() || (!!cleanJobId && cleanState !== 'completed' && cleanState !== 'error')}
                className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 h-[38px] flex items-center w-fit"
              >
                {cleanState === 'starting' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                Generate Clean Preview
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-fuchsia-100 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Clean Preview Status:</span>
              {cleanState === 'idle' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Ready</span>}
              {cleanState === 'starting' && <span className="text-xs px-2 py-1 bg-fuchsia-100 text-fuchsia-700 rounded">Starting...</span>}
              {cleanState === 'running' && <span className="text-xs px-2 py-1 bg-fuchsia-100 text-fuchsia-700 rounded flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Generating preview...</span>}
              {cleanState === 'completed' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Completed</span>}
              {cleanState === 'error' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Error: {cleanError}</span>}
             </div>
             
             {cleanResult && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 p-3 rounded border border-slate-100">
                     <span className="block text-xs text-slate-500 mb-1">Eligibility</span>
                     <span className="font-semibold text-slate-800">{cleanResult.eligibility}</span>
                   </div>
                   <div className="bg-slate-50 p-3 rounded border border-slate-100">
                     <span className="block text-xs text-slate-500 mb-1">Next Allowed Step</span>
                     <span className="font-semibold text-slate-800">{cleanResult.nextAllowedStep}</span>
                   </div>
                 </div>
                 
                 {cleanResult.blockedReasons && cleanResult.blockedReasons.length > 0 && (
                   <div className="bg-rose-50 p-3 rounded border border-rose-100">
                     <span className="block text-xs text-rose-600 mb-1">Blocked Reasons</span>
                     <ul className="list-disc pl-4 text-sm text-rose-800">
                       {cleanResult.blockedReasons.map((r, i) => <li key={i}>{r}</li>)}
                     </ul>
                   </div>
                 )}
                 
                 {cleanResult.warningCategories && cleanResult.warningCategories.length > 0 && (
                   <div className="bg-amber-50 p-3 rounded border border-amber-100">
                     <span className="block text-xs text-amber-600 mb-1">Warning Categories</span>
                     <ul className="list-disc pl-4 text-sm text-amber-800">
                       {cleanResult.warningCategories.map((w, i) => <li key={i}>{w}</li>)}
                     </ul>
                   </div>
                 )}
                 
                 <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                   <span className="block text-xs text-emerald-600 mb-1">Planned Preview Actions</span>
                   <ul className="list-disc pl-4 text-sm text-emerald-800">
                     {cleanResult.plannedPreviewActions && cleanResult.plannedPreviewActions.length > 0 ? 
                       cleanResult.plannedPreviewActions.map((a, i) => <li key={i}>{a}</li>) : 
                       <li>None</li>}
                   </ul>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Phase L7B: Controlled Retry Preview */}
        <div className="bg-pink-50/50 border border-pink-200 rounded-xl p-6 mt-6 mb-8">
          <h3 className="font-bold text-pink-900 flex items-center gap-2 mb-4">
            <Shield size={20} className="text-pink-600" />
            Phase L7B: Controlled Retry Preview
          </h3>
          <p className="text-sm text-pink-800 mb-4 bg-pink-100/50 p-3 rounded-lg border border-pink-200/50">
            <strong>Safety Notice:</strong> Preview only — no files will be changed. Dry-run only — retry execution remains disabled.
          </p>
          
          <div className="flex flex-col gap-4 mb-6">
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target File (Basename only)</label>
              <input 
                type="text" 
                value={retryInputPath}
                onChange={(e) => setRetryInputPath(e.target.value)}
                placeholder="document.md"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                disabled={!!retryJobId && retryState !== 'completed' && retryState !== 'error'}
              />
            </div>
            
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stage to Retry</label>
              <select 
                value={retryStage}
                onChange={(e) => setRetryStage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                disabled={!!retryJobId && retryState !== 'completed' && retryState !== 'error'}
              >
                <option value="convert">Convert</option>
                <option value="ocr">OCR</option>
                <option value="review">Review</option>
              </select>
            </div>
            
            <label className="flex items-start gap-2 mt-2 cursor-pointer group w-fit">
              <div className="relative flex items-center mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  checked={retryConfirm}
                  onChange={(e) => setRetryConfirm(e.target.checked)}
                  className="peer sr-only"
                  disabled={!!retryJobId && retryState !== 'completed' && retryState !== 'error'}
                />
                <div className="w-4 h-4 border-2 border-slate-300 rounded bg-white peer-checked:bg-pink-600 peer-checked:border-pink-600 transition-all flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                </div>
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                <strong>I understand</strong> this is a dry-run preview. No actual files will be retried.
              </span>
            </label>
            
            <div className="mt-2">
              <button 
                onClick={runRetryPreview}
                disabled={!retryConfirm || !retryInputPath.trim() || (!!retryJobId && retryState !== 'completed' && retryState !== 'error')}
                className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 h-[38px] flex items-center w-fit"
              >
                {retryState === 'starting' ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                Generate Retry Preview
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-pink-100 rounded-lg p-4">
             <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-slate-700">Retry Preview Status:</span>
              {retryState === 'idle' && <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">Ready</span>}
              {retryState === 'starting' && <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded">Starting...</span>}
              {retryState === 'running' && <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Generating preview...</span>}
              {retryState === 'completed' && <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Completed</span>}
              {retryState === 'error' && <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded">Error: {retryError}</span>}
             </div>
             
             {retryResult && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 p-3 rounded border border-slate-100">
                     <span className="block text-xs text-slate-500 mb-1">Eligibility</span>
                     <span className="font-semibold text-slate-800">{retryResult.eligibility}</span>
                   </div>
                   <div className="bg-slate-50 p-3 rounded border border-slate-100">
                     <span className="block text-xs text-slate-500 mb-1">Next Allowed Step</span>
                     <span className="font-semibold text-slate-800">{retryResult.nextAllowedStep}</span>
                   </div>
                 </div>
                 
                 {retryResult.blockedReasons && retryResult.blockedReasons.length > 0 && (
                   <div className="bg-rose-50 p-3 rounded border border-rose-100">
                     <span className="block text-xs text-rose-600 mb-1">Blocked Reasons</span>
                     <ul className="list-disc pl-4 text-sm text-rose-800">
                       {retryResult.blockedReasons.map((r, i) => <li key={i}>{r}</li>)}
                     </ul>
                   </div>
                 )}
                 
                 {retryResult.warningCategories && retryResult.warningCategories.length > 0 && (
                   <div className="bg-amber-50 p-3 rounded border border-amber-100">
                     <span className="block text-xs text-amber-600 mb-1">Warning Categories</span>
                     <ul className="list-disc pl-4 text-sm text-amber-800">
                       {retryResult.warningCategories.map((w, i) => <li key={i}>{w}</li>)}
                     </ul>
                   </div>
                 )}
                 
                 <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                   <span className="block text-xs text-emerald-600 mb-1">Candidate Retry Plan</span>
                   <ul className="list-disc pl-4 text-sm text-emerald-800">
                     {retryResult.candidateRetryPlan && retryResult.candidateRetryPlan.length > 0 ? 
                       retryResult.candidateRetryPlan.map((a, i) => <li key={i}>{a}</li>) : 
                       <li>None</li>}
                   </ul>
                 </div>
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminLocalMarkdownPipelinePage;
