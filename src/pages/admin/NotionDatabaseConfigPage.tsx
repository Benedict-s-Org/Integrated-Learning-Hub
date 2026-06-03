import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronLeft, 
  RefreshCw,
  HelpCircle,
  TrendingUp,
  FileText,
  Calendar,
  AlertTriangle,
  Play,
  FileQuestion
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DbConfigItem {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  defaultValue: string;
  currentValue: string;
  status: 'idle' | 'checking' | 'success' | 'error';
  statusDetails?: string;
}

const DEFAULT_CONFIGS: Omit<DbConfigItem, 'currentValue' | 'status'>[] = [
  {
    key: 'reading_comprehension_db_id',
    label: 'Reading Comprehension Question Bank',
    description: 'Holds reading comprehension MCQ questions and paragraph chunks referenced by student activities.',
    icon: FileQuestion,
    defaultValue: '3249baca6fa3802ea86ec9921032c29b'
  },
  {
    key: 'reading_pdfs_db_id',
    label: 'Reading PDFs & Activities',
    description: 'Links PDF resources, instructions, and levels for student reading comprehension tasks.',
    icon: FileText,
    defaultValue: '3239baca6fa380a9b501deceb133946d'
  },
  {
    key: 'cycle_day_db_id',
    label: 'Cycle Day Page Dates',
    description: 'Tracks date ranges and Cycle Days (e.g. Day 1, Day 2) synced from school calendars.',
    icon: Calendar,
    defaultValue: '2579baca6fa3806f9c6ef193f7d81213'
  },
  {
    key: 'proofreading_db_id',
    label: 'Proofreading Question Bank',
    description: 'Contains default questions, correction alternatives, and passages for proofreading.',
    icon: FileText,
    defaultValue: '7f81157c0c29440ab35fdf4bc862fbc1'
  },
  {
    key: 'anagram_bank_db_id',
    label: 'Anagram Question Bank',
    description: 'Bank of letters, valid scrambles, and word tiers used in the Cognitive Anagram game.',
    icon: Database,
    defaultValue: 'd7ea40d03cde4e54b8a6226ac75130cc'
  },
  {
    key: 'anagram_runs_db_id',
    label: 'Anagram Task Runs',
    description: 'Records participant sessions, total durations, device info, and completions.',
    icon: TrendingUp,
    defaultValue: '9e203ecf9a7946cc8051f0b59329620f'
  },
  {
    key: 'anagram_responses_db_id',
    label: 'Anagram Student Responses',
    description: 'Saves individual word responses, spelling attempts, time metrics, and hints used.',
    icon: Play,
    defaultValue: 'e6d90d25cb7d4ee8938f2e2c61a93d38'
  },
  {
    key: 'help_db_id',
    label: 'Vocabulary Help & Unknowns',
    description: 'Logs student vocabulary help requests, requested terms, and learning context.',
    icon: HelpCircle,
    defaultValue: '2647f405a5a14e9fa6660dc164a3e502'
  }
];

export const NotionDatabaseConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<DbConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load configs from system_config on mount
  useEffect(() => {
    const fetchConfigs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('system_config' as any)
          .select('value')
          .eq('key', 'notion_database_ids')
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        let parsed: Record<string, string> = {};
        if (data?.value) {
          try {
            parsed = JSON.parse(data.value);
          } catch (e) {
            console.error('Failed to parse database configuration JSON:', e);
          }
        }

        // Initialize state mapping DB values to definitions
        const loadedConfigs = DEFAULT_CONFIGS.map(def => ({
          ...def,
          currentValue: parsed[def.key] || def.defaultValue,
          status: 'idle' as const
        }));

        setConfigs(loadedConfigs);
      } catch (err) {
        console.error('Error fetching notion database config:', err);
        setMessage({ text: 'Failed to load configurations from database.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  // Save changes back to Supabase system_config
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configMap: Record<string, string> = {};
      configs.forEach(cfg => {
        configMap[cfg.key] = cfg.currentValue.trim();
      });

      const { error } = await supabase
        .from('system_config' as any)
        .upsert({ 
          key: 'notion_database_ids', 
          value: JSON.stringify(configMap) 
        }, { onConflict: 'key' } as any);

      if (error) throw error;

      setMessage({ text: 'Notion Database configuration saved successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Failed to save config:', err);
      setMessage({ text: 'Failed to save configurations. Ensure you have admin privileges.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Reset all fields to default values
  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all Notion Database IDs to standard defaults? (Remember to save afterward)')) {
      setConfigs(prev => prev.map(cfg => ({
        ...cfg,
        currentValue: cfg.defaultValue,
        status: 'idle',
        statusDetails: undefined
      })));
    }
  };

  // Reset a specific field to default
  const handleResetSingle = (key: string) => {
    setConfigs(prev => prev.map(cfg => {
      if (cfg.key === key) {
        return { ...cfg, currentValue: cfg.defaultValue, status: 'idle', statusDetails: undefined };
      }
      return cfg;
    }));
  };

  // Update input text state
  const handleInputChange = (key: string, val: string) => {
    setConfigs(prev => prev.map(cfg => {
      if (cfg.key === key) {
        return { ...cfg, currentValue: val, status: 'idle', statusDetails: undefined };
      }
      return cfg;
    }));
  };

  // Live health check by fetching Notion DB Schema via Edge Function
  const checkConnection = async (key: string, dbId: string) => {
    if (!dbId || dbId.trim().length < 10) {
      setConfigs(prev => prev.map(cfg => {
        if (cfg.key === key) {
          return { ...cfg, status: 'error', statusDetails: 'Invalid ID format' };
        }
        return cfg;
      }));
      return;
    }

    setConfigs(prev => prev.map(cfg => {
      if (cfg.key === key) {
        return { ...cfg, status: 'checking', statusDetails: undefined };
      }
      return cfg;
    }));

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data, error } = await supabase.functions.invoke('reading-api', {
        body: {
          action: 'get-db-schema',
          databaseId: dbId.trim()
        }
      });

      if (error || data?.error) {
        const errorMsg = error?.message || data?.error || 'Access denied';
        setConfigs(prev => prev.map(cfg => {
          if (cfg.key === key) {
            return { 
              ...cfg, 
              status: 'error', 
              statusDetails: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg 
            };
          }
          return cfg;
        }));
      } else {
        const dbTitle = data?.title?.[0]?.plain_text || 'Active Database';
        setConfigs(prev => prev.map(cfg => {
          if (cfg.key === key) {
            return { 
              ...cfg, 
              status: 'success', 
              statusDetails: `Connected: "${dbTitle}"` 
            };
          }
          return cfg;
        }));
      }
    } catch (err: any) {
      setConfigs(prev => prev.map(cfg => {
        if (cfg.key === key) {
          return { ...cfg, status: 'error', statusDetails: err.message || 'Connection failed' };
        }
        return cfg;
      }));
    }
  };

  if (loading) {
    return (
      <div className="db-config-loader">
        <style>{`
          .db-config-loader {
            min-height: 100vh;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          .loader-spin {
            animation: spin 1s linear infinite;
            color: #6366f1;
            width: 48px;
            height: 48px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <Loader2 className="loader-spin" />
        <p style={{ marginTop: '16px', color: '#475569', fontWeight: '500' }}>Loading Notion Database IDs Matrix...</p>
      </div>
    );
  }

  return (
    <div className="db-config-page">
      <style>{`
        .db-config-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1e293b;
          padding: 24px;
          box-sizing: border-box;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        /* Glassmorphism Header */
        .header {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 24px;
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
          flex-wrap: wrap;
          gap: 16px;
        }
        .header-title-container {
          display: flex;
          flex-direction: column;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 6px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .back-link:hover {
          color: #475569;
        }
        .header-title {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          background: linear-gradient(to right, #4f46e5, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-secondary {
          background: #ffffff;
          color: #475569;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .btn-primary {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35);
        }
        .btn-primary:active {
          transform: translateY(0);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* Message Banner */
        .message-banner {
          padding: 16px 24px;
          border-radius: 16px;
          margin-bottom: 24px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .message-success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .message-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Config Cards Grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }
        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.08);
          border-color: #cbd5e1;
        }
        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
        }
        .card-icon-container {
          background: #e0e7ff;
          color: #4f46e5;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }
        .card-desc {
          margin: 4px 0 0 0;
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.4;
        }
        .input-group {
          margin-top: 16px;
        }
        .input-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 6px;
          letter-spacing: 0.05em;
        }
        .input-container {
          display: flex;
          gap: 8px;
        }
        .input-field {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          font-family: monospace;
          color: #334155;
          outline: none;
          transition: all 0.2s;
        }
        .input-field:focus {
          border-color: #6366f1;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .btn-icon {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #64748b;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .btn-icon:hover {
          background: #e2e8f0;
          color: #334155;
        }

        /* Health Check Area */
        .health-section {
          margin-top: 20px;
          border-top: 1px solid #f1f5f9;
          padding-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .btn-test {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-test:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        .btn-test-checking {
          cursor: not-allowed;
          opacity: 0.8;
        }
        .checking-spin {
          animation: spin 1s linear infinite;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-idle {
          background: #f1f5f9;
          color: #64748b;
        }
        .status-success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .status-error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        .status-error-tooltip {
          font-size: 10px;
          color: #991b1b;
          margin-top: 4px;
          width: 100%;
          font-family: monospace;
          background: #fff5f5;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid #fee2e2;
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 80px;
        }

        /* Footer Info */
        .footer-note {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
      `}</style>
      
      <div className="container">
        {/* Header Block */}
        <div className="header">
          <div className="header-title-container">
            <div className="back-link" onClick={() => navigate('/admin/users')}>
              <ChevronLeft size={14} />
              <span>Back to Admin Panel</span>
            </div>
            <h1 className="header-title">
              <Database size={26} />
              Notion Database Configuration
            </h1>
            <p className="header-subtitle">
              Monitor, validate, and edit all Notion Database IDs configured for school schedules, games, and reading modules.
            </p>
          </div>

          <div className="action-buttons">
            <button 
              onClick={handleResetToDefaults}
              className="btn btn-secondary"
              title="Reset all fields to system defaults"
            >
              <RotateCcw size={16} />
              <span>Reset all</span>
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? <Loader2 size={16} className="loader-spin" /> : <Save size={16} />}
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`message-banner ${message.type === 'success' ? 'message-success' : 'message-error'}`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Configurations Grid */}
        <div className="cards-grid">
          {configs.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <div key={cfg.key} className="card">
                <div>
                  <div className="card-header">
                    <div className="card-icon-container">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="card-title">{cfg.label}</h3>
                      <p className="card-desc">{cfg.description}</p>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Database ID</label>
                    <div className="input-container">
                      <input 
                        type="text" 
                        value={cfg.currentValue}
                        onChange={(e) => handleInputChange(cfg.key, e.target.value)}
                        className="input-field"
                        placeholder="Enter 32-character Notion Database ID"
                      />
                      <button 
                        onClick={() => handleResetSingle(cfg.key)}
                        className="btn-icon" 
                        title={`Reset to default: ${cfg.defaultValue}`}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="health-section">
                    <button 
                      onClick={() => checkConnection(cfg.key, cfg.currentValue)}
                      disabled={cfg.status === 'checking'}
                      className={`btn-test ${cfg.status === 'checking' ? 'btn-test-checking' : ''}`}
                    >
                      {cfg.status === 'checking' ? (
                        <Loader2 size={13} className="checking-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                      <span>{cfg.status === 'checking' ? 'Checking...' : 'Check Connection'}</span>
                    </button>

                    {cfg.status === 'idle' && (
                      <span className="status-badge status-idle">Not Tested</span>
                    )}

                    {cfg.status === 'success' && (
                      <span className="status-badge status-success" title={cfg.statusDetails}>
                        <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                        {cfg.statusDetails || 'Connected'}
                      </span>
                    )}

                    {cfg.status === 'error' && (
                      <span className="status-badge status-error" title={cfg.statusDetails}>
                        <XCircle size={12} style={{ marginRight: '4px' }} />
                        Access Error
                      </span>
                    )}
                  </div>
                  {cfg.status === 'error' && cfg.statusDetails && (
                    <div className="status-error-tooltip">
                      {cfg.statusDetails}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info banner */}
        <div className="footer-note">
          <AlertTriangle size={14} />
          <span>Updates here modify configurations dynamically for both client rendering and Deno API cloud functions.</span>
        </div>
      </div>
    </div>
  );
};

export default NotionDatabaseConfigPage;
