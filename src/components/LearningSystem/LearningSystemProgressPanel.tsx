import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { buildTwentyItemPie } from '../../lib/learningSystem/charts';
import { fetchActiveGrammarSkills } from '../../lib/learningSystem/checklistService';
import { setTeacherRemediationPin } from '../../lib/learningSystem/skillStateService';
import {
  loadLearningSystemChartModel,
  loadTeacherSkillFlags,
  type LsChartModel,
  type LsTeacherSkillFlag,
} from '../../lib/learningSystem/chartData';

const SKILL_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#4d7c0f',
  '#a16207',
];

function skillColor(skillId: string, palette: Map<string, string>): string {
  const existing = palette.get(skillId);
  if (existing) return existing;
  const color = SKILL_COLORS[palette.size % SKILL_COLORS.length];
  palette.set(skillId, color);
  return color;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const LearningSystemProgressPanel: React.FC<{
  userId: string;
  /** Teacher analytics only. Students never receive skill-state flags. */
  showTeacherFields?: boolean;
}> = ({ userId, showTeacherFields = false }) => {
  const [model, setModel] = useState<LsChartModel | null>(null);
  const [flags, setFlags] = useState<LsTeacherSkillFlag[]>([]);
  const [pinSkills, setPinSkills] = useState<{ id: string; name: string }[]>([]);
  const [pinSaving, setPinSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const chart = await loadLearningSystemChartModel(userId);
        const teacherFlags = showTeacherFields ? await loadTeacherSkillFlags(userId) : [];
        const skills = showTeacherFields
          ? (await fetchActiveGrammarSkills()).map((skill) => ({ id: skill.id, name: skill.name }))
          : [];
        if (cancelled) return;
        setModel(chart);
        setFlags(teacherFlags);
        setPinSkills(skills);
        setSelectedBar(0);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load Learning System progress.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, showTeacherFields]);

  const palette = useMemo(() => new Map<string, string>(), [model]);
  if (model) {
    for (const series of model.series) skillColor(series.skillId, palette);
    for (const bar of model.bars) {
      for (const skillId of Object.keys(bar.correctBySkill)) skillColor(skillId, palette);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Learning System progress…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
    );
  }

  if (!model || (model.series.length === 0 && model.bars.length === 0)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No valid Learning System answers yet. Finish a practice set to see scores here.
      </div>
    );
  }

  const activeWindow = model.barWindows[selectedBar];
  const pie = activeWindow && activeWindow.length === 20 ? buildTwentyItemPie(activeWindow) : [];
  const names = new Map(model.series.map((s) => [s.skillId, s.name]));

  return (
    <div className="space-y-6">
      {model.latestSet && (
        <p className="text-sm text-slate-700">
          Latest set: <span className="font-semibold">{model.latestSet.correct}</span> of{' '}
          <span className="font-semibold">{model.latestSet.total}</span> correct.
          Tips for missed skills appear at the end of a set.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Accuracy every 25 answers</h3>
          <p className="text-sm text-slate-600 mt-1">
            One point per 25 valid answers on that skill. The date is when the batch finished.
            A batch under 25 answers does not draw a point.
          </p>
        </div>
        {model.series.map((series) => (
          <div key={series.skillId} className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{series.name}</p>
            {series.points.length === 0 ? (
              <p className="text-sm text-slate-500">
                {series.pendingInBatch} of 25 answers in the current batch. No point yet.
              </p>
            ) : (
              <>
                <LineChart
                  points={series.points.map((p) => ({
                    label: formatWhen(p.completedAt),
                    accuracy: p.accuracy,
                    detail: `Batch ${p.batchIndex}: ${p.correctCount} of 25 correct (${Math.round(p.accuracy * 100)}%), finished ${formatWhen(p.completedAt)}`,
                  }))}
                  color={skillColor(series.skillId, palette)}
                />
                <ul className="text-xs text-slate-600 space-y-0.5">
                  {series.points.map((p) => (
                    <li key={p.batchIndex}>
                      Batch {p.batchIndex}: {p.correctCount} of 25 correct ({Math.round(p.accuracy * 100)}
                      %), finished {formatWhen(p.completedAt)}
                    </li>
                  ))}
                  {series.pendingInBatch > 0 && (
                    <li>{series.pendingInBatch} answers waiting for the next point.</li>
                  )}
                </ul>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Two sets, 20 answers</h3>
          <p className="text-sm text-slate-600 mt-1">
            Each bar is two finished sets. Bar height is correct answers out of 20. Colored
            parts are correct answers by skill. The empty part of the track is incorrect.
          </p>
        </div>
        {model.bars.length === 0 ? (
          <p className="text-sm text-slate-500">Finish two sets to draw the first bar.</p>
        ) : (
          <>
            <div className="flex items-end gap-3 h-48" role="list">
              {model.bars.map((bar, index) => {
                const segments = Object.entries(bar.correctBySkill);
                return (
                  <button
                    key={bar.barIndex}
                    type="button"
                    role="listitem"
                    aria-pressed={selectedBar === index}
                    aria-label={`Bar ${bar.barIndex}: ${bar.correctCount} of 20 correct (${Math.round(bar.heightRatio * 100)} percent)`}
                    onClick={() => setSelectedBar(index)}
                    className={`flex flex-col items-center flex-1 max-w-[72px] h-full justify-end gap-1 ${
                      selectedBar === index ? 'opacity-100' : 'opacity-80'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-700">{bar.correctCount}/20</span>
                    <div className="w-full flex-1 bg-slate-100 rounded-t border border-slate-200 flex flex-col justify-end overflow-hidden">
                      <div
                        className="w-full flex flex-col justify-end"
                        style={{ height: `${Math.max(bar.heightRatio * 100, bar.correctCount > 0 ? 4 : 0)}%` }}
                      >
                        {segments.map(([skillId, count]) => (
                          <div
                            key={skillId}
                            style={{
                              flexGrow: count,
                              backgroundColor: skillColor(skillId, palette),
                            }}
                            title={`${names.get(skillId) || skillId}: ${count} correct`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500">#{bar.barIndex}</span>
                  </button>
                );
              })}
            </div>
            <ul className="text-xs text-slate-600 space-y-0.5">
              {model.bars.map((bar) => (
                <li key={bar.barIndex}>
                  Bar {bar.barIndex}: {bar.correctCount} of 20 correct ({Math.round(bar.heightRatio * 100)}%).{' '}
                  {Object.entries(bar.correctBySkill)
                    .map(([skillId, count]) => `${names.get(skillId) || skillId} ${count} correct`)
                    .join('; ') || 'No correct answers.'}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {pie.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Bar {selectedBar + 1} as a pie</h3>
            <p className="text-sm text-slate-600 mt-1">
              Same 20 answers. Each answer is 5%. Correct slices are listed first, then incorrect.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div
              className="w-40 h-40 rounded-full border border-slate-200 shrink-0"
              style={{
                background: `conic-gradient(${pie
                  .map((slice, i) => {
                    const start = pie.slice(0, i).reduce((s, x) => s + x.ratio, 0) * 100;
                    const end = start + slice.ratio * 100;
                    const color = slice.isCorrect
                      ? skillColor(slice.skillId, palette)
                      : '#94a3b8';
                    return `${color} ${start}% ${end}%`;
                  })
                  .join(', ')})`,
              }}
              role="img"
              aria-label={`Pie for bar ${selectedBar + 1}`}
            />
            <ul className="text-sm text-slate-700 space-y-1">
              {pie.map((slice) => (
                <li key={`${slice.skillId}-${slice.isCorrect}`}>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle"
                    style={{
                      backgroundColor: slice.isCorrect ? skillColor(slice.skillId, palette) : '#94a3b8',
                    }}
                  />
                  {names.get(slice.skillId) || slice.skillId} — {slice.isCorrect ? 'Correct' : 'Incorrect'} —{' '}
                  {slice.count} of 20 ({Math.round(slice.ratio * 100)}%)
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {showTeacherFields && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Teacher view</h3>
            <p className="text-sm text-slate-600 mt-1">
              Weakness, remediation loop, pause, and open follow-up. Students do not see this table.
              The next remediation set uses the pinned skill. With no pin, it uses the lowest accuracy.
            </p>
          </div>
          <label className="block text-sm max-w-md space-y-1">
            <span className="font-semibold text-slate-800">Remediation pin</span>
            <select
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
              disabled={pinSaving}
              value={flags.find((flag) => flag.teacherPin)?.skillId ?? ''}
              onChange={(event) => {
                const skillId = event.target.value || null;
                setPinSaving(true);
                setError(null);
                void setTeacherRemediationPin({ studentUserId: userId, skillId })
                  .then(() => loadTeacherSkillFlags(userId))
                  .then((next) => setFlags(next))
                  .catch((err: any) => setError(err?.message || 'Could not save the pin.'))
                  .finally(() => setPinSaving(false));
              }}
            >
              <option value="">None — use lowest accuracy</option>
              {pinSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </label>
          {flags.some((flag) => flag.teacherPin && (flag.remediationPaused || flag.teacherInterventionOpen)) && (
            <p className="text-sm text-amber-900">
              This pin stays saved, but dense remediation waits until Teacher followed up.
            </p>
          )}
          {flags.length === 0 ? (
            <p className="text-sm text-slate-600">No skill state recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Skill</th>
                    <th className="py-2 pr-3 font-semibold">Potential weakness</th>
                    <th className="py-2 pr-3 font-semibold">Loop</th>
                    <th className="py-2 pr-3 font-semibold">Paused</th>
                    <th className="py-2 pr-3 font-semibold">Follow-up open</th>
                    <th className="py-2 font-semibold">Pin</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((flag) => (
                    <tr key={flag.skillId} className="border-t border-amber-100">
                      <td className="py-2 pr-3 text-slate-900">{flag.name}</td>
                      <td className="py-2 pr-3">{flag.potentialWeakness ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-3">{flag.remediationLoop}</td>
                      <td className="py-2 pr-3">{flag.remediationPaused ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-3">{flag.teacherInterventionOpen ? 'Yes' : 'No'}</td>
                      <td className="py-2">{flag.teacherPin ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

function LineChart({
  points,
  color,
}: {
  points: { label: string; accuracy: number; detail: string }[];
  color: string;
}) {
  const width = 320;
  const height = 120;
  const pad = 16;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - p.accuracy * (height - pad * 2);
    return { ...p, x, y };
  });
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md h-32" role="img" aria-label={points.map((p) => p.detail).join('. ')}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
      {coords.map((c) => (
        <circle key={c.detail} cx={c.x} cy={c.y} r="4" fill={color}>
          <title>{c.detail}</title>
        </circle>
      ))}
    </svg>
  );
}

export default LearningSystemProgressPanel;
