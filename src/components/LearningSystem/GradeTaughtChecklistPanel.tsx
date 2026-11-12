import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchGradeTaughtChecklist,
  setSkillTaught,
} from '../../lib/learningSystem/checklistService';
import { fetchNotionMicroSkills } from '../../lib/learningSystem/notionCatalog';
import type { GrammarMicroSkill, LearningSystemGradeKey } from '../../lib/learningSystem/types';

const GRADE_OPTIONS: LearningSystemGradeKey[] = ['P.1', 'P.2', 'P.3', 'P.4'];

export const GradeTaughtChecklistPanel: React.FC = () => {
  const { user } = useAuth();
  const [gradeKey, setGradeKey] = useState<LearningSystemGradeKey>('P.3');
  const [skills, setSkills] = useState<GrammarMicroSkill[]>([]);
  const [taughtMap, setTaughtMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillRows, checklistRows] = await Promise.all([
        fetchNotionMicroSkills(),
        fetchGradeTaughtChecklist(gradeKey),
      ]);
      setSkills(skillRows.filter((skill) => skill.chapter_ref?.startsWith(gradeKey)));
      const map: Record<string, boolean> = {};
      checklistRows.forEach((row) => {
        map[row.skill_id] = row.taught;
      });
      setTaughtMap(map);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Could not load checklist. Apply the Learning System migration if tables are missing.'
      );
      setSkills([]);
      setTaughtMap({});
    } finally {
      setLoading(false);
    }
  }, [gradeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const taughtCount = useMemo(
    () => skills.filter((s) => taughtMap[s.id]).length,
    [skills, taughtMap]
  );

  const handleToggle = async (skillId: string, nextTaught: boolean) => {
    if (!user?.id) return;
    setSavingId(skillId);
    setError(null);
    const prev = taughtMap[skillId] ?? false;
    setTaughtMap((m) => ({ ...m, [skillId]: nextTaught }));
    try {
      await setSkillTaught({
        gradeKey,
        skillId,
        taught: nextTaught,
        userId: user.id,
      });
    } catch (err: any) {
      console.error(err);
      setTaughtMap((m) => ({ ...m, [skillId]: prev }));
      setError(err?.message || 'Failed to update taught status.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Grade taught checklist</h2>
          <p className="text-sm text-slate-600 mt-1">
            Shared per grade (for example all P.3 classes). Only taught skills may appear in Learning
            System practice. Curriculum suggestions do not auto-tick these boxes.
          </p>
        </div>
        <label className="flex flex-col text-sm font-medium text-slate-700 gap-1">
          Grade
          <select
            value={gradeKey}
            onChange={(e) => setGradeKey(e.target.value as LearningSystemGradeKey)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white min-w-[120px]"
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span>
          {taughtCount} / {skills.length} marked taught for {gradeKey}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading skills…
        </div>
      ) : skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
          No active micro-skills found. Seed skills load from the Learning System migration until
          Notion sync is connected.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {skills.map((skill) => {
            const taught = Boolean(taughtMap[skill.id]);
            const busy = savingId === skill.id;
            return (
              <li key={skill.id} className="p-4 hover:bg-slate-50/80 flex gap-4 items-start">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  checked={taught}
                  disabled={busy || !user?.id}
                  onChange={(e) => void handleToggle(skill.id, e.target.checked)}
                  aria-label={`Mark ${skill.name} as taught for ${gradeKey}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{skill.name}</p>
                    {skill.chapter_ref && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {skill.chapter_ref}
                      </span>
                    )}
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 break-all">{skill.id}</p>
                  <p className="text-sm text-slate-600 mt-2">{skill.measures}</p>
                  {skill.boundary && (
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-semibold">Boundary:</span> {skill.boundary}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
