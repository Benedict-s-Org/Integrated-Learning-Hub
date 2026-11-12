import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listOpenInterventions,
  markTeacherFollowedUp,
  type OpenInterventionRow,
} from '../../lib/learningSystem/skillStateService';

export const TeacherFollowUpPanel: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<OpenInterventionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOpenInterventions();
      setRows(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not load open interventions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFollowUp = async (interventionId: string) => {
    if (!user?.id) return;
    setActingId(interventionId);
    setError(null);
    try {
      await markTeacherFollowedUp({
        interventionId,
        teacherUserId: user.id,
      });
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not mark teacher follow-up.');
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading interventions…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Teacher follow-up</h2>
        <p className="text-sm text-slate-600 mt-1">
          Students who failed two remediation loops are paused on dense remediation until you
          mark follow-up.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          No open interventions.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {row.student_name || row.user_id}
                  </p>
                  <p className="text-slate-600 truncate">
                    Skill: {row.skill_name || row.skill_id}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Opened {new Date(row.opened_at).toLocaleString()}
                    {row.notify_sent_at ? ' · Notified once' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={actingId === row.id}
                onClick={() => void onFollowUp(row.id)}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {actingId === row.id ? 'Saving…' : 'Teacher followed up'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TeacherFollowUpPanel;
