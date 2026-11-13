import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  startLearningSystemSession,
  type BuiltLsSession,
} from '../../lib/learningSystem/sessionService';
import { recordLearningSystemAttempt } from '../../lib/learningSystem/attemptService';
import {
  finalizeLearningSystemSet,
  type RemediationLoopOutcomeLabel,
} from '../../lib/learningSystem/skillStateService';
import {
  fetchTipsForMissedSkills,
  markLearningSystemAssignmentComplete,
} from '../../lib/learningSystem/assignmentService';
import { parseLearningSystemGradeKey, isLearningSystemGradeKey } from '../../lib/learningSystem/gradeKey';
import type { LearningSystemGradeKey } from '../../lib/learningSystem/types';
import type { LsSessionQuestion } from '../../lib/learningSystem/sessionService';
import type { LsProofreadingQuestion } from '../../lib/learningSystem/proofreadingConceptCheck';
import {
  formatProofreadingCorrectionAlternatives,
  scoreProofreadingItem,
} from '../../utils/proofreadingScore';

type Phase = 'ready' | 'loading' | 'active' | 'revealed' | 'summary' | 'error';

function isProofreadingQuestion(question: LsSessionQuestion): question is LsProofreadingQuestion {
  return 'kind' in question && question.kind === 'proofreading';
}

function sentenceTokens(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean);
}

type ProofPageAnswer = { wordIndex: number | null; correction: string; notSure: boolean };

function emptyProofAnswer(): ProofPageAnswer {
  return { wordIndex: null, correction: '', notSure: false };
}

const GRADE_OPTIONS: LearningSystemGradeKey[] = ['P.1', 'P.2', 'P.3', 'P.4'];
const DEFAULT_GRADE: LearningSystemGradeKey = 'P.3';

export interface LearningSystemPracticeProps {
  onExit: () => void;
  assignmentId?: string | null;
  assignmentGradeKey?: string | null;
  autoStart?: boolean;
}

export const LearningSystemPractice: React.FC<LearningSystemPracticeProps> = ({
  onExit,
  assignmentId = null,
  assignmentGradeKey = null,
  autoStart = false,
}) => {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'class_staff';
  const derivedGrade = parseLearningSystemGradeKey(user?.class ?? null);
  const assignmentGrade =
    assignmentGradeKey && isLearningSystemGradeKey(assignmentGradeKey)
      ? assignmentGradeKey
      : null;

  const [gradeKey, setGradeKey] = useState<LearningSystemGradeKey>(
    () => assignmentGrade ?? derivedGrade ?? DEFAULT_GRADE
  );

  // Profile/class may load after first paint — prefer assignment grade, then class.
  useEffect(() => {
    if (assignmentGrade) setGradeKey(assignmentGrade);
    else if (derivedGrade) setGradeKey(derivedGrade);
  }, [assignmentGrade, derivedGrade]);
  const [phase, setPhase] = useState<Phase>(autoStart ? 'loading' : 'ready');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<BuiltLsSession | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correction, setCorrection] = useState('');
  const [notSure, setNotSure] = useState(false);
  const [pageAnswers, setPageAnswers] = useState<Record<string, ProofPageAnswer>>({});
  const [savedScores, setSavedScores] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [validRecorded, setValidRecorded] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [results, setResults] = useState<
    { questionId: string; skillId: string; correct: boolean }[]
  >([]);
  const [remediationOutcome, setRemediationOutcome] =
    useState<RemediationLoopOutcomeLabel | null>(null);
  const [tips, setTips] = useState<{ skillId: string; name: string; tip: string }[]>([]);
  const [assignmentDone, setAssignmentDone] = useState(false);
  const autoStartedRef = React.useRef(false);
  const submittingRef = React.useRef(false);

  const current: LsSessionQuestion | null = session?.questions[index] ?? null;
  const isRemediation = session?.mode === 'remediation';

  const isConceptSheet =
    session?.mode === 'concept_check' && session.questions.every(isProofreadingQuestion);

  const progressLabel = useMemo(() => {
    if (!session) return '';
    if (session.mode === 'concept_check' && session.conceptProgress) {
      return `Set ${session.conceptProgress.setIndex + 1} of ${session.conceptProgress.setCount}`;
    }
    return `${index + 1} / ${session.questions.length}`;
  }, [index, session]);

  const start = useCallback(async () => {
    if (!user?.id) {
      setError('You must be signed in to practice.');
      setPhase('error');
      return;
    }
    setPhase('loading');
    setError(null);
    try {
      const built = await startLearningSystemSession({
        userId: user.id,
        className: user.class,
        // Always pass an explicit grade so missing class metadata cannot block practice.
        gradeKeyOverride: gradeKey,
        assignmentId: assignmentId ?? null,
      });
      if (built.questions.length === 0) {
        throw new Error(
          built.composition.gaps.join(' ') ||
            'No eligible questions. Mark more skills taught or wait for the question bank.'
        );
      }
      setSession(built);
      setIndex(0);
      setSelected(null);
      setCorrection('');
      setNotSure(false);
      setPageAnswers({});
      setSavedScores({});
      setRevealed(false);
      setValidRecorded(false);
      setResults([]);
      setRemediationOutcome(null);
      setTips([]);
      setAssignmentDone(false);
      setStartedAt(Date.now());
      setPhase('active');
      if (!built.composition.ok) {
        console.warn('[LearningSystem] Set gaps:', built.composition.gaps);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not start a Learning System set.');
      setPhase('error');
    }
  }, [user, gradeKey, assignmentId]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  const submitAnswer = useCallback(async () => {
    if (!user?.id || !session || !current) return;
    const proof = isProofreadingQuestion(current) ? current : null;
    if (!proof && selected == null) return;
    if (proof && !notSure && (selected == null || correction.trim().length === 0)) return;

    const scored = proof
      ? scoreProofreadingItem({
          userWordIndex: notSure ? undefined : selected ?? undefined,
          userCorrection: notSure ? '' : correction,
          expectedWordIndex: proof.errorWordIndex,
          expectedCorrection: proof.corrected,
          isNotSure: notSure,
        })
      : null;
    const mcqOptions = 'options' in current ? current.options : [];
    const mcqCorrectIndex = 'correctIndex' in current ? current.correctIndex : -1;
    const isCorrect = proof ? Boolean(scored?.isCorrect) : selected === mcqCorrectIndex;
    const answerText = proof
      ? notSure
        ? "不知道 (Not Sure)"
        : correction.trim()
      : mcqOptions[selected ?? 0] ?? '';
    const countInSummary = !validRecorded && !revealed;
    const isValid = proof ? false : countInSummary;

    try {
      await recordLearningSystemAttempt({
        userId: user.id,
        setId: session.setId,
        skillId: current.skillId,
        questionId: current.id,
        selectedAnswer: answerText,
        isCorrect,
        isValid,
        isRemediation,
        isDemonstration: false,
        responseTimeMs: Date.now() - startedAt,
        channel: proof ? 'proofreading' : 'srs',
        detectionCorrect: scored?.detectionCorrect ?? null,
        correctionCorrect: scored?.correctionCorrect ?? null,
      });
      if (countInSummary) {
        setValidRecorded(true);
        setResults((prev) => [
          ...prev,
          { questionId: current.id, skillId: current.skillId, correct: isCorrect },
        ]);
      }
      setRevealed(true);
      setPhase('revealed');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not save attempt.');
    }
  }, [user, session, current, selected, correction, notSure, validRecorded, revealed, isRemediation, startedAt]);

  const submitConceptPage = useCallback(async () => {
    if (!user?.id || !session || revealed || submittingRef.current) return;
    submittingRef.current = true;
    const questions = session.questions.filter(isProofreadingQuestion);
    const elapsed = Date.now() - startedAt;
    const pageResults: { questionId: string; skillId: string; correct: boolean }[] = [];

    try {
      for (const question of questions) {
        const answer = pageAnswers[question.id] ?? emptyProofAnswer();
        if (question.id in savedScores) {
          pageResults.push({
            questionId: question.id,
            skillId: question.skillId,
            correct: savedScores[question.id],
          });
          continue;
        }
        const incomplete =
          !answer.notSure &&
          (answer.wordIndex == null || answer.correction.trim().length === 0);
        const scored = scoreProofreadingItem({
          userWordIndex: answer.notSure ? undefined : answer.wordIndex ?? undefined,
          userCorrection: answer.notSure ? '' : answer.correction,
          expectedWordIndex: question.errorWordIndex,
          expectedCorrection: question.corrected,
          isNotSure: answer.notSure,
          isIncomplete: incomplete,
        });
        await recordLearningSystemAttempt({
          userId: user.id,
          setId: session.setId,
          skillId: question.skillId,
          questionId: question.id,
          selectedAnswer: answer.notSure ? '不知道 (Not Sure)' : answer.correction.trim(),
          isCorrect: scored.isCorrect,
          isValid: false,
          isRemediation: false,
          isDemonstration: false,
          responseTimeMs: elapsed,
          channel: 'proofreading',
          detectionCorrect: scored.detectionCorrect,
          correctionCorrect: scored.correctionCorrect,
        });
        pageResults.push({
          questionId: question.id,
          skillId: question.skillId,
          correct: scored.isCorrect,
        });
        setSavedScores((prev) => ({ ...prev, [question.id]: scored.isCorrect }));
      }
      setResults(pageResults);
      setRevealed(true);
      setPhase('revealed');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not save this set.');
    } finally {
      submittingRef.current = false;
    }
  }, [user, session, revealed, pageAnswers, startedAt, savedScores]);

  const goNext = useCallback(async () => {
    if (!session || !user?.id) return;
    if (session.mode === 'concept_check' || index + 1 >= session.questions.length) {
      try {
        const finalResults = results;
        const fin = await finalizeLearningSystemSet({
          userId: user.id,
          setId: session.setId,
          mode: session.mode,
          targetSkillId: session.targetSkillId,
          orderedResults: finalResults.map((r) => ({
            skillId: r.skillId,
            correct: r.correct,
          })),
        });
        setRemediationOutcome(fin.remediationOutcome ?? null);

        const missed = finalResults.filter((r) => !r.correct).map((r) => r.skillId);
        try {
          setTips(await fetchTipsForMissedSkills(missed));
        } catch (tipErr) {
          console.warn(tipErr);
        }

        if (assignmentId && session.mode !== 'concept_check') {
          try {
            const ok = await markLearningSystemAssignmentComplete(assignmentId);
            setAssignmentDone(ok);
          } catch (asgErr) {
            console.error(asgErr);
          }
        }
        const moreSets =
          session.mode === 'concept_check' &&
          session.conceptProgress != null &&
          session.conceptProgress.setIndex + 1 < session.conceptProgress.setCount;
        if (moreSets) {
          await start();
          return;
        }
      } catch (err) {
        console.error(err);
      }
      setPhase('summary');
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setCorrection('');
    setNotSure(false);
    setRevealed(false);
    setValidRecorded(false);
    setStartedAt(Date.now());
    setPhase('active');
  }, [session, index, user, results, assignmentId, start]);

  const correctCount = results.filter((r) => r.correct).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to hub
        </button>
        {session && phase !== 'summary' && (
          <span className="text-sm font-medium text-slate-500">{progressLabel}</span>
        )}
      </div>

      {(phase === 'ready' || phase === 'error') && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            {assignmentId ? 'Assigned Learning System set' : 'Start practice'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The first proofreading is one page of 10 sentences. Each sentence is drawn at random
            from a different micro-skill. Finish that page, then the next set of 10. Regular
            practice starts after every set is finished. A P.4 class at unit A4 finishes 6 sets.
            The check does not change your review schedule.
          </p>
          {(isStaff || !derivedGrade) && (
            <label className="block text-sm space-y-1 max-w-xs">
              <span className="font-semibold text-slate-700">Grade for eligibility</span>
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
              {!derivedGrade && (
                <span className="text-xs text-slate-500">
                  No class on your profile — pick the grade checklist to use.
                </span>
              )}
            </label>
          )}
          {derivedGrade && !isStaff && (
            <p className="text-sm text-slate-600">
              Grade from class: <span className="font-semibold">{derivedGrade}</span>
            </p>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Start practice
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex items-center gap-2 text-slate-600 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Building eligible set…
        </div>
      )}

      {(phase === 'active' || phase === 'revealed') && isConceptSheet && session && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {`Proofreading check · Set ${(session.conceptProgress?.setIndex ?? 0) + 1} of ${session.conceptProgress?.setCount ?? 1}`}
            </span>
            <p className="text-sm text-slate-600">Click the wrong word, then type the correct word.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 w-12">#</th>
                  <th className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Sentence</th>
                  <th className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 w-64">Your answer</th>
                  <th className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 w-40">Correct answer</th>
                </tr>
              </thead>
              <tbody>
                {session.questions.filter(isProofreadingQuestion).map((question, rowIndex) => {
                  const answer = pageAnswers[question.id] ?? emptyProofAnswer();
                  const scored = revealed
                    ? scoreProofreadingItem({
                        userWordIndex: answer.notSure ? undefined : answer.wordIndex ?? undefined,
                        userCorrection: answer.notSure ? '' : answer.correction,
                        expectedWordIndex: question.errorWordIndex,
                        expectedCorrection: question.corrected,
                        isNotSure: answer.notSure,
                        isIncomplete:
                          !answer.notSure &&
                          (answer.wordIndex == null || answer.correction.trim().length === 0),
                      })
                    : null;
                  const rowTone = !scored
                    ? ''
                    : scored.isCorrect
                      ? 'bg-emerald-50'
                      : answer.notSure
                        ? 'bg-yellow-50'
                        : 'bg-red-50';
                  return (
                    <tr key={question.id} className={rowTone}>
                      <td className="border border-slate-300 px-3 py-3 text-center text-sm font-medium text-slate-700">
                        {rowIndex + 1}
                      </td>
                      <td className="border border-slate-300 px-3 py-3">
                        <p className="text-base leading-relaxed text-slate-900">
                          {sentenceTokens(question.sentence).map((token, tokenIndex) => {
                            const picked = answer.wordIndex === tokenIndex;
                            const showError = revealed && tokenIndex === question.errorWordIndex;
                            const showWrongPick = revealed && picked && tokenIndex !== question.errorWordIndex;
                            return (
                              <button
                                key={`${question.id}-${tokenIndex}`}
                                type="button"
                                disabled={revealed || answer.notSure}
                                onClick={() =>
                                  setPageAnswers((prev) => ({
                                    ...prev,
                                    [question.id]: {
                                      ...(prev[question.id] ?? emptyProofAnswer()),
                                      wordIndex: tokenIndex,
                                    },
                                  }))
                                }
                                className={`mx-0.5 inline-block rounded px-1 py-0.5 ${
                                  showError
                                    ? 'bg-emerald-200 text-emerald-950'
                                    : showWrongPick
                                      ? 'bg-red-200 text-red-950'
                                      : picked
                                        ? 'bg-red-200 text-slate-900'
                                        : revealed || answer.notSure
                                          ? 'text-slate-900'
                                          : 'text-slate-900 hover:bg-blue-100'
                                }`}
                              >
                                {token}
                              </button>
                            );
                          })}
                        </p>
                      </td>
                      <td className="border border-slate-300 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={answer.notSure ? '不知道 (Not Sure)' : answer.correction}
                            disabled={revealed || answer.notSure}
                            placeholder="Type correction"
                            onChange={(event) =>
                              setPageAnswers((prev) => ({
                                ...prev,
                                [question.id]: {
                                  ...(prev[question.id] ?? emptyProofAnswer()),
                                  correction: event.target.value,
                                },
                              }))
                            }
                            className={`w-full rounded-md border border-slate-300 px-2 py-2 text-sm ${
                              answer.notSure ? 'bg-slate-100 italic text-slate-500' : 'bg-white'
                            }`}
                          />
                          {!revealed && (
                            <button
                              type="button"
                              title="I'm not sure"
                              aria-label="I'm not sure"
                              onClick={() =>
                                setPageAnswers((prev) => {
                                  const currentAnswer = prev[question.id] ?? emptyProofAnswer();
                                  return {
                                    ...prev,
                                    [question.id]: { ...currentAnswer, notSure: !currentAnswer.notSure },
                                  };
                                })
                              }
                              className={`shrink-0 rounded-md border px-2 py-2 text-xs font-bold ${
                                answer.notSure
                                  ? 'border-yellow-300 bg-yellow-100 text-yellow-700'
                                  : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              不知道
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-300 px-3 py-3 text-sm">
                        {revealed ? (
                          <span className="font-medium text-blue-700">
                            {formatProofreadingCorrectionAlternatives(question.corrected)}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Hidden</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          {!revealed ? (
            <button
              type="button"
              onClick={() => void submitConceptPage()}
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Check answers
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void goNext()}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {session.conceptProgress &&
              session.conceptProgress.setIndex + 1 < session.conceptProgress.setCount
                ? 'Next set'
                : 'Finish set'}
            </button>
          )}
        </div>
      )}

      {(phase === 'active' || phase === 'revealed') && !isConceptSheet && current && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              {session?.mode === 'concept_check'
                ? `Proofreading check · Set ${(session.conceptProgress?.setIndex ?? 0) + 1} of ${session.conceptProgress?.setCount ?? 1}`
                : session?.mode.replace('_', ' ')}
            </span>
            {session?.composition.ok === false && (
              <span className="rounded-full bg-amber-50 text-amber-800 px-2.5 py-1">
                Partial set ({session.questions.length})
              </span>
            )}
          </div>
          {isProofreadingQuestion(current) ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Click the wrong word, then type the correct word.</p>
              <p className="text-lg md:text-xl leading-relaxed text-slate-900">
                {sentenceTokens(current.sentence).map((token, i) => {
                  const isSel = selected === i;
                  const showError = revealed && i === current.errorWordIndex;
                  const showWrongPick = revealed && isSel && i !== current.errorWordIndex;
                  return (
                    <button
                      key={`${current.id}-${i}`}
                      type="button"
                      disabled={revealed || notSure}
                      onClick={() => setSelected(i)}
                      className={`mx-0.5 rounded px-1 py-0.5 font-semibold ${
                        showError
                          ? 'bg-emerald-100 text-emerald-900'
                          : showWrongPick
                            ? 'bg-red-100 text-red-900'
                            : isSel
                              ? 'bg-teal-100 text-teal-900'
                              : 'hover:bg-slate-100'
                      }`}
                    >
                      {token}
                    </button>
                  );
                })}
              </p>
              <div className="flex items-end gap-2 max-w-md">
                <label className="block text-sm space-y-1 flex-1">
                  <span className="font-semibold text-slate-700">Correct word</span>
                  <input
                    type="text"
                    value={notSure ? '不知道 (Not Sure)' : correction}
                    disabled={revealed || notSure}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="Type the correct word"
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${
                      notSure ? 'bg-slate-100 italic text-slate-500' : ''
                    }`}
                  />
                </label>
                {!revealed && (
                  <button
                    type="button"
                    title="I'm not sure"
                    aria-label="I'm not sure"
                    onClick={() => setNotSure((value) => !value)}
                    className={`mb-0.5 rounded-md border px-3 py-2 text-sm font-bold transition-colors ${
                      notSure
                        ? 'border-yellow-300 bg-yellow-100 text-yellow-700'
                        : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    不知道
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-lg md:text-xl font-semibold text-slate-900 leading-snug">
                {current.stem}
              </p>
              <div className="grid gap-2">
                {current.options.map((opt, i) => {
                  const isSel = selected === i;
                  const showCorrect = revealed && i === current.correctIndex;
                  const showWrong = revealed && isSel && i !== current.correctIndex;
                  return (
                    <button
                      key={`${current.id}-${i}`}
                      type="button"
                      disabled={revealed}
                      onClick={() => setSelected(i)}
                      className={`text-left rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                        showCorrect
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                          : showWrong
                            ? 'border-red-300 bg-red-50 text-red-900'
                            : isSel
                              ? 'border-teal-500 bg-teal-50 text-teal-900'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {!revealed ? (
            <button
              type="button"
              disabled={
                isProofreadingQuestion(current)
                  ? !notSure && (selected == null || correction.trim().length === 0)
                  : selected == null
              }
              onClick={() => void submitAnswer()}
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
            >
              Check answer
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {(isProofreadingQuestion(current)
                ? scoreProofreadingItem({
                    userWordIndex: notSure ? undefined : selected ?? undefined,
                    userCorrection: notSure ? '' : correction,
                    expectedWordIndex: current.errorWordIndex,
                    expectedCorrection: current.corrected,
                    isNotSure: notSure,
                  }).isCorrect
                : selected === current.correctIndex) ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Correct
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-red-700 text-sm font-semibold">
                  <XCircle className="w-4 h-4" />
                  {isProofreadingQuestion(current)
                    ? notSure
                      ? `Not sure. The wrong word is "${current.error}" and the correct word is "${formatProofreadingCorrectionAlternatives(current.corrected)}".`
                      : `Not quite. The wrong word is "${current.error}" and the correct word is "${formatProofreadingCorrectionAlternatives(current.corrected)}".`
                    : 'Not quite'}
                </span>
              )}
              <button
                type="button"
                onClick={() => void goNext()}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {index + 1 >= (session?.questions.length ?? 0) ? 'Finish set' : 'Next'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'summary' && session && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Set complete</h2>
          <p className="text-sm text-slate-600">
            {session.mode === 'concept_check'
              ? `Set ${(session.conceptProgress?.setIndex ?? 0) + 1} of ${session.conceptProgress?.setCount ?? 1}: ${correctCount} correct out of ${results.length}. This check does not change your review schedule.`
              : `Valid answers: ${correctCount} correct out of ${results.length}. Tips and skill charts will appear on the Progress page in a later step.`}
          </p>
          {remediationOutcome === 'pass' && (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Remediation focus passed. Keep practicing ordinary sets.
            </p>
          )}
          {remediationOutcome === 'fail_continue' && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Remediation focus not yet passed. Another focused set may follow.
            </p>
          )}
          {remediationOutcome === 'fail_intervene' && (
            <p className="text-sm text-slate-800 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              A teacher has been notified. Continue with ordinary review until they follow up.
            </p>
          )}
          {assignmentId && (
            <p className="text-sm text-teal-900 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
              {assignmentDone
                ? 'Assignment marked complete. Coins are awarded if this was your first completion.'
                : 'Assignment completion could not be recorded. Ask a teacher if it still shows open.'}
            </p>
          )}
          {tips.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Review tips</h3>
              <ul className="space-y-2">
                {tips.map((t) => (
                  <li
                    key={t.skillId}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-slate-800">{t.name}</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{t.tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {session.composition.gaps.length > 0 && (
            <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 list-disc list-inside">
              {session.composition.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const moreSets =
                  session.conceptProgress != null &&
                  session.conceptProgress.setIndex + 1 < session.conceptProgress.setCount;
                setSession(null);
                setError(null);
                if (moreSets) void start();
                else setPhase('ready');
              }}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {session.conceptProgress &&
              session.conceptProgress.setIndex + 1 < session.conceptProgress.setCount
                ? 'Next set'
                : 'Practice again'}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningSystemPractice;
