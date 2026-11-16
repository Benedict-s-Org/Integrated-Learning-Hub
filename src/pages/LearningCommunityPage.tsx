import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, RefreshCw, Server } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  luantiAuthService,
  type LuantiJoinCredentials,
} from '@/services/luantiAuthService';

interface LearningCommunityPageProps {
  onExit?: () => void;
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-HK', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function LearningCommunityPage({ onExit }: LearningCommunityPageProps) {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<LuantiJoinCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const canAccess =
    !!user &&
    (user.role === 'admin' ||
      user.role === 'class_staff' ||
      user.can_access_learning_hub === true);

  const mint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await luantiAuthService.mintJoin();
      setCredentials(next);
    } catch (err) {
      setCredentials(null);
      setError(err instanceof Error ? err.message : 'Failed to mint join credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      void mint();
    }
  }, [canAccess, mint]);

  const copyValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  if (!user) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <p className="text-slate-600">Sign in to enter My Learning Community.</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">My Learning Community</h1>
        <p className="text-slate-600">
          Your account does not have Learning Community access yet. Ask a teacher or admin to enable it.
        </p>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>
    );
  }

  const address = credentials
    ? `${credentials.serverHost}:${credentials.serverPort}`
    : null;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            My Learning Community
          </h1>
          <p className="text-slate-600 max-w-xl">
            Enter the Luanti world with one-time credentials from Learning Hub. You do not need a
            separate Luanti account password.
          </p>
        </div>
        <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Server className="h-6 w-6" />
        </div>
      </div>

      <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside">
        <li>Install or open the Luanti client on your device.</li>
        <li>Generate join credentials below (valid for about 10 minutes).</li>
        <li>Add a server using the host, port, username, and password shown.</li>
        <li>
          Wait about 3 seconds so the game server can sync your password, then join.
        </li>
        <li>If the password expired or join fails, generate a new one here and try again.</li>
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-medium text-slate-900">Join credentials</h2>
          <button
            type="button"
            onClick={() => void mint()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {credentials ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && !credentials && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing credentials…
            </div>
          )}

          {credentials && (
            <>
              <CredentialRow
                label="Server address"
                value={address || ''}
                fieldKey="address"
                copiedField={copiedField}
                onCopy={copyValue}
              />
              <CredentialRow
                label="Username"
                value={credentials.luantiUsername}
                fieldKey="username"
                copiedField={copiedField}
                onCopy={copyValue}
              />
              <CredentialRow
                label="One-time password"
                value={credentials.password}
                fieldKey="password"
                copiedField={copiedField}
                onCopy={copyValue}
                mono
              />
              <p className="text-xs text-slate-500">
                Expires at {formatExpiry(credentials.expiresAt)} (Hong Kong time). Wait about 3
                seconds after generating before you join. Generating again invalidates the previous
                password. After you join, you can reconnect with the same password until it expires.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
  mono?: boolean;
}) {
  const copied = copiedField === fieldKey;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`mt-1 truncate text-slate-900 ${mono ? 'font-mono text-sm' : 'font-medium'}`}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(fieldKey, value)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default LearningCommunityPage;
