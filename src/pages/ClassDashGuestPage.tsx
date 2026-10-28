import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClassDashGuestProvider } from '@/context/ClassDashGuestContext';
import { validateClassDashLink } from '@/services/classDashLinkService';
import {
  classDashErrorMessage,
  type ClassDashErrorCode,
} from '@/utils/classDashAccess';
import { ClassDashboardPage } from '@/pages/ClassDashboardPage';

export default function ClassDashGuestPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorCode, setErrorCode] = useState<ClassDashErrorCode>('invalid_link');
  const [targetClass, setTargetClass] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setErrorCode('invalid_link');
        setStatus('error');
        return;
      }
      try {
        const result = await validateClassDashLink(token);
        if (cancelled) return;
        setTargetClass(result.target_class);
        setValidUntil(result.valid_until || null);
        setLinkId(result.link_id);
        setStatus('ready');
      } catch (err: any) {
        if (cancelled) return;
        const code = (err?.code || 'invalid_link') as ClassDashErrorCode;
        setErrorCode(code);
        setStatus('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-medium">Checking class link…</p>
      </div>
    );
  }

  if (status === 'error' || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold text-slate-900">Class Dashboard</h1>
          <p className="text-slate-600">{classDashErrorMessage(errorCode)}</p>
        </div>
      </div>
    );
  }

  return (
    <ClassDashGuestProvider
      token={token}
      targetClass={targetClass}
      validUntil={validUntil}
      linkId={linkId}
    >
      <ClassDashboardPage />
    </ClassDashGuestProvider>
  );
}
