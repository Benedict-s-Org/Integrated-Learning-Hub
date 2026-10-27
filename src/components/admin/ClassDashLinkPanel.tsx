import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, Ban, Loader2 } from 'lucide-react';
import {
  classDashUrlForToken,
  manageClassDashLink,
  type ClassDashLinkRow,
} from '@/services/classDashLinkService';

interface Props {
  className: string;
}

export function ClassDashLinkPanel({ className }: Props) {
  const [link, setLink] = useState<ClassDashLinkRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!className || className === 'all') {
      setLink(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await manageClassDashLink('get', className);
      setLink(result.link || null);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load link');
      setLink(null);
    } finally {
      setLoading(false);
    }
  }, [className]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (action: 'generate' | 'regenerate' | 'disable') => {
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'disable') {
        await manageClassDashLink('disable', className);
        setLink(null);
        setMessage('Link disabled.');
      } else {
        const result = await manageClassDashLink(action, className);
        setLink(result.link || null);
        setMessage(action === 'generate' ? 'Link generated.' : 'Link regenerated. Old URL is invalid.');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link?.token) return;
    try {
      await navigator.clipboard.writeText(classDashUrlForToken(link.token));
      setMessage('Copied to clipboard.');
    } catch {
      setMessage('Could not copy. Select the URL manually.');
    }
  };

  if (!className || className === 'all') return null;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Link2 size={16} className="text-blue-500 shrink-0" />
            Guest class link
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mon–Fri 07:30–15:30 HKT · locked to {className}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!link && (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => run('generate')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Generate link
            </button>
          )}
          {link && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={copy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Copy size={14} /> Copy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Regenerate this link? The current URL will stop working immediately.')) {
                    run('regenerate');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Regenerate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Disable this link now?')) run('disable');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Ban size={14} /> Disable
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-2 text-xs text-slate-400 inline-flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      )}

      {link?.token && (
        <code className="mt-2 block text-[11px] md:text-xs break-all bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-slate-700">
          {classDashUrlForToken(link.token)}
        </code>
      )}

      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
    </div>
  );
}
