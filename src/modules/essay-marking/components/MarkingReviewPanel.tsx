import React, { useState } from 'react';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  MarkingFinding,
  RubricDimension,
  FindingDecision,
} from '../types';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';

interface MarkingReviewPanelProps {
  students: StudentRosterItem[];
  appliedMatching: AppliedMatching;
  activeStudentIndex: number;
  rubric: RubricDimension[];
  markings: Record<string, StudentMarkingState>;
  isRequirementsConfirmed: boolean;
  isTranscriptVerified: boolean;
  onSelectStudent: (index: number) => void;
  onUpdateScores: (studentId: string, scores: Record<string, number>) => void;
  onUpdateFeedback: (studentId: string, feedback: string) => void;
  onAddFinding: (studentId: string, finding: Omit<MarkingFinding, 'id' | 'decision'>) => void;
  onFindingDecision: (studentId: string, findingId: string, decision: FindingDecision, customText?: string) => void;
  onDeleteFinding: (studentId: string, findingId: string) => void;
  onApproveMarking: (studentId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const MarkingReviewPanel: React.FC<MarkingReviewPanelProps> = ({
  students,
  appliedMatching,
  activeStudentIndex,
  rubric,
  markings,
  isRequirementsConfirmed,
  isTranscriptVerified,
  onSelectStudent,
  onUpdateScores,
  onUpdateFeedback,
  onAddFinding,
  onFindingDecision,
  onDeleteFinding,
  onApproveMarking,
  onPrev,
  onNext,
}) => {
  const [showAddFindingModal, setShowAddFindingModal] = useState(false);
  const [newFindingType, setNewFindingType] = useState('Verb tense');
  const [newFindingOriginal, setNewFindingOriginal] = useState('');
  const [newFindingReplacement, setNewFindingReplacement] = useState('');
  const [newFindingExplanation, setNewFindingExplanation] = useState('');

  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [editFindingText, setEditFindingText] = useState('');

  const activeStudent = students[activeStudentIndex];
  const activeStudentId = activeStudent?.id || '';

  const defaultScores: Record<string, number> = {};
  rubric.forEach((r) => {
    defaultScores[r.id] = 3;
  });

  const currentMarking = markings[activeStudentId] || {
    studentId: activeStudentId,
    findings: [],
    scores: defaultScores,
    feedbackComment: '',
    isApproved: false,
  };

  const handleScoreChange = (dimId: string, val: number, maxScore: number) => {
    const clamped = Math.max(0, Math.min(maxScore, val));
    const nextScores = { ...currentMarking.scores, [dimId]: clamped };
    onUpdateScores(activeStudentId, nextScores);
  };

  const totalScore = rubric.reduce(
    (acc, dim) => acc + (currentMarking.scores[dim.id] ?? 0),
    0
  );
  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingOriginal.trim() || !newFindingReplacement.trim()) return;

    onAddFinding(activeStudentId, {
      type: newFindingType,
      originalText: newFindingOriginal.trim(),
      replacementText: newFindingReplacement.trim(),
      explanation: newFindingExplanation.trim(),
    });

    setNewFindingOriginal('');
    setNewFindingReplacement('');
    setNewFindingExplanation('');
    setShowAddFindingModal(false);
  };

  const handleSaveFindingEdit = (findingId: string) => {
    onFindingDecision(activeStudentId, findingId, 'edited', editFindingText);
    setEditingFindingId(null);
    setEditFindingText('');
  };

  return (
    <div className="space-y-4">
      {/* Requirement & Verification Warnings */}
      {!isRequirementsConfirmed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Writing requirements are unconfirmed. Please return to Preparation to confirm assignment scope.
          </span>
        </div>
      )}

      {!isTranscriptVerified && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            The transcript for {activeStudent?.displayName} has not been confirmed yet. Verifying transcript first prevents misinterpreting handwriting ambiguity as student language errors.
          </span>
        </div>
      )}

      {/* 3-Column Layout: Left Findings, Middle Scores & Feedback, Right Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_220px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_240px] gap-4 items-start">
        {/* Column 1: Findings & Suggestions */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Marking Findings & Feedback Notes
              </h2>
              <span className="text-[11px] text-slate-400">
                {currentMarking.findings.length} findings for {activeStudent?.displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddFindingModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Finding</span>
            </button>
          </div>

          {/* AI Unconfigured Notice */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-md text-xs text-blue-800 flex items-start gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>AI Marking Unconfigured:</strong> Automatic suggestions from Qwen3-VL-32B are not connected. You can add manual teacher findings and adjustments below.
            </div>
          </div>

          {/* Findings List */}
          <div className="flex-1 space-y-3 overflow-y-auto">
            {currentMarking.findings.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No specific error findings noted. Click <strong>Add Finding</strong> above to highlight spelling, grammar, or vocabulary feedback.
              </div>
            ) : (
              currentMarking.findings.map((f, j) => (
                <div
                  key={f.id}
                  className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">
                      {j + 1}. {f.type}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        f.decision === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : f.decision === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : f.decision === 'edited'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {f.decision === 'edited'
                        ? 'Teacher Edited'
                        : f.decision}
                    </span>
                  </div>

                  <blockquote className="p-2 bg-white border-l-2 border-slate-300 rounded text-slate-800 font-serif text-xs">
                    <span className="line-through text-rose-600 mr-1">
                      {f.originalText}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      {f.replacementText}
                    </span>
                  </blockquote>

                  {editingFindingId === f.id ? (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        value={editFindingText}
                        onChange={(e) => setEditFindingText(e.target.value)}
                        placeholder="Custom teacher explanation..."
                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveFindingEdit(f.id)}
                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFindingId(null)}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-600 text-[11px]">
                      {f.teacherCustomText || f.explanation}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onFindingDecision(activeStudentId, f.id, 'accepted')
                        }
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFindingId(f.id);
                          setEditFindingText(f.teacherCustomText || f.explanation);
                        }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onFindingDecision(activeStudentId, f.id, 'rejected')
                        }
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        Reject
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteFinding(activeStudentId, f.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                      title="Delete finding"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Column 2: Scores & Feedback */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-bold text-slate-800">
              Rubric Scores & Feedback
            </h2>
            <div className="text-right">
              <span className="text-lg font-bold text-blue-700">
                {totalScore}
              </span>
              <span className="text-xs text-slate-400">
                {' '}
                / {maxPossibleScore} pts
              </span>
            </div>
          </div>

          {/* Rubric Score Inputs */}
          <div className="space-y-2 mb-4">
            {rubric.map((dim) => {
              const currentScore = currentMarking.scores[dim.id] ?? 0;
              return (
                <div
                  key={dim.id}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-50 border border-slate-200 text-xs"
                >
                  <label
                    htmlFor={`dim-${dim.id}`}
                    className="font-medium text-slate-700"
                  >
                    {dim.name}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id={`dim-${dim.id}`}
                      type="number"
                      min="0"
                      max={dim.maxScore}
                      value={currentScore}
                      onChange={(e) =>
                        handleScoreChange(
                          dim.id,
                          parseInt(e.target.value, 10) || 0,
                          dim.maxScore
                        )
                      }
                      className="w-12 text-center py-0.5 px-1 border border-slate-300 rounded bg-white text-xs font-semibold"
                    />
                    <span className="text-slate-400">/ {dim.maxScore}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feedback Commentary */}
          <div className="flex-1 flex flex-col mb-4">
            <label
              htmlFor="studentFeedback"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Teacher Written Feedback
            </label>
            <textarea
              id="studentFeedback"
              rows={6}
              value={currentMarking.feedbackComment}
              onChange={(e) =>
                onUpdateFeedback(activeStudentId, e.target.value)
              }
              placeholder="Provide constructive feedback highlighting strengths and next writing steps..."
              className="w-full flex-1 p-2.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed resize-y"
            />
          </div>

          {/* Approval Action */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {currentMarking.isApproved
                ? 'Approved by teacher.'
                : 'Pending teacher approval.'}
            </span>

            <button
              type="button"
              onClick={() => onApproveMarking(activeStudentId)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                currentMarking.isApproved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
              }`}
            >
              {currentMarking.isApproved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>✓ Teacher Approved</span>
                </>
              ) : (
                <span>Approve Scores & Feedback</span>
              )}
            </button>
          </div>
        </section>

        {/* Column 3: Student Queue */}
        <aside className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs sticky top-14">
          <div className="pb-2 border-b border-slate-100 mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Student Queue
            </h3>
            <span className="text-[11px] text-slate-400">
              {appliedMatching.classId} • {appliedMatching.assignedStudentIndices.length} essays
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[calc(100vh-240px)] overflow-y-auto">
            {appliedMatching.assignedStudentIndices.map((studentIdx) => {
              const student = students[studentIdx];
              if (!student) return null;
              const isSelected = studentIdx === activeStudentIndex;
              const marking = markings[student.id];
              const isApproved = marking?.isApproved;

              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onSelectStudent(studentIdx)}
                  className={`w-full text-left p-2 rounded-md transition-colors my-0.5 text-xs ${
                    isSelected
                      ? 'bg-blue-50 text-blue-800 font-semibold border border-blue-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">
                      {String(student.classNumber).padStart(2, '0')} · {student.displayName}
                    </span>
                    {isApproved && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />
                    )}
                  </div>
                  <span
                    className={`block text-[10px] mt-0.5 ${
                      isApproved
                        ? 'text-emerald-600'
                        : marking?.feedbackComment
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {isApproved
                      ? '✓ Teacher approved'
                      : marking?.feedbackComment
                      ? 'Draft review'
                      : 'Pending review'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Add Finding Modal */}
      {showAddFindingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Add Marking Finding for {activeStudent?.displayName}
            </h3>
            <form onSubmit={handleCreateFinding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Finding Category
                </label>
                <select
                  value={newFindingType}
                  onChange={(e) => setNewFindingType(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                >
                  <option>Verb tense</option>
                  <option>Spelling</option>
                  <option>Punctuation</option>
                  <option>Vocabulary</option>
                  <option>Sentence structure</option>
                  <option>Paragraphing</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Original Student Text
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. I goed to the park"
                  value={newFindingOriginal}
                  onChange={(e) => setNewFindingOriginal(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Suggested Replacement
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. I went to the park"
                  value={newFindingReplacement}
                  onChange={(e) => setNewFindingReplacement(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teacher Explanation / Rule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Use went as the past tense of go."
                  value={newFindingExplanation}
                  onChange={(e) => setNewFindingExplanation(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFindingModal(false)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs"
                >
                  Save Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Transcripts
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[34px] transition-colors"
        >
          <span>Export Report →</span>
        </button>
      </div>
    </div>
  );
};
