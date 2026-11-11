import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  assignLearningSystemPractice,
  fetchStudentsForAssignment,
} from '../../lib/learningSystem/assignmentService';
import type { LearningSystemGradeKey } from '../../lib/learningSystem/types';

const GRADE_OPTIONS: LearningSystemGradeKey[] = ['P.1', 'P.2', 'P.3', 'P.4'];

interface Props {
  onClose: () => void;
}

export const LearningSystemAssignModal: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<
    { id: string; display_name: string | null; username: string; class: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('Learning System practice');
  const [gradeKey, setGradeKey] = useState<LearningSystemGradeKey>('P.3');
  const [dueDate, setDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setStudents(await fetchStudentsForAssignment());
      } catch (err: any) {
        setError(err?.message || 'Could not load students.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const classes = useMemo(
    () =>
      [...new Set(students.map((s) => s.class).filter((c): c is string => Boolean(c)))].sort(),
    [students]
  );

  const filtered = students.filter((s) => {
    const matchesClass =
      classFilter === 'all'
        ? true
        : classFilter === 'unassigned'
          ? !s.class
          : s.class === classFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (s.display_name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q);
    return matchesClass && matchesSearch;
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!user?.id || selected.size === 0) return;
    setAssigning(true);
    setError(null);
    try {
      await assignLearningSystemPractice({
        studentIds: [...selected],
        assignedBy: user.id,
        title,
        gradeKey,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err?.message || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Assign Learning System</h2>
            <p className="text-sm text-slate-500 mt-1">
              Students open one eligible practice set from the hub.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Assigned</h3>
            <p className="text-slate-600 text-sm mt-1">
              Sent to {selected.size} student{selected.size === 1 ? '' : 's'}.
            </p>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3 border-b border-slate-100">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm space-y-1 block">
                  <span className="font-semibold text-slate-700">Title</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="font-semibold text-slate-700">Grade checklist</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                    value={gradeKey}
                    onChange={(e) => setGradeKey(e.target.value as LearningSystemGradeKey)}
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="font-semibold text-slate-700">Due date (optional)</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
                    placeholder="Search students…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="all">All classes</option>
                  <option value="unassigned">Unassigned</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-sm font-semibold text-teal-700"
                  onClick={() => setSelected(new Set(filtered.map((s) => s.id)))}
                >
                  Select filtered
                </button>
              </div>
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[200px]">
              {loading ? (
                <p className="text-sm text-slate-500 p-4">Loading students…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-500 p-4">No students match.</p>
              ) : (
                filtered.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3 ${
                        on
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          on ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {on && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {s.display_name || s.username}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {s.class || 'No class'} · {s.username}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {selected.size} selected
              </p>
              <button
                type="button"
                disabled={assigning || selected.size === 0}
                onClick={() => void handleAssign()}
                className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LearningSystemAssignModal;
