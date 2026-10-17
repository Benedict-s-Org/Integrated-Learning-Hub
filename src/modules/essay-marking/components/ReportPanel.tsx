import React from 'react';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentMarkingState,
  StudentTranscriptState,
  RubricDimension,
  AssignmentConfig,
} from '../types';
import {
  Printer,
  Download,
  Send,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ReportPanelProps {
  assignment: AssignmentConfig;
  students: StudentRosterItem[];
  appliedMatching: AppliedMatching;
  activeStudentIndex: number;
  rubric: RubricDimension[];
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  onSelectStudent: (index: number) => void;
  onPrev: () => void;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({
  assignment,
  students,
  appliedMatching,
  activeStudentIndex,
  rubric,
  transcripts,
  markings,
  onSelectStudent,
  onPrev,
}) => {
  const activeStudent = students[activeStudentIndex];
  const activeStudentId = activeStudent?.id || '';
  const currentMarking = markings[activeStudentId];
  const currentTranscript = transcripts[activeStudentId];

  const isApproved = currentMarking?.isApproved ?? false;

  const totalScore = rubric.reduce(
    (acc, dim) => acc + (currentMarking?.scores[dim.id] ?? 0),
    0
  );
  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  // Filter accepted and teacher-edited findings (exclude rejected)
  const approvedFindings = (currentMarking?.findings || []).filter(
    (f) => f.decision === 'accepted' || f.decision === 'edited'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportText = () => {
    if (!activeStudent) return;

    let content = `LEARNING HUB — WRITING FEEDBACK REPORT\n`;
    content += `Assignment: ${assignment.title || 'Untitled Writing'}\n`;
    content += `Class: ${appliedMatching.classId} | Student: No. ${String(
      activeStudent.classNumber
    ).padStart(2, '0')} ${activeStudent.displayName}\n`;
    content += `Status: ${isApproved ? 'Teacher Approved' : 'Draft / Unapproved'}\n`;
    content += `Score: ${totalScore} / ${maxPossibleScore}\n`;
    content += `--------------------------------------------------\n\n`;

    content += `RUBRIC BREAKDOWN:\n`;
    rubric.forEach((dim) => {
      content += `- ${dim.name}: ${currentMarking?.scores[dim.id] ?? 0} / ${
        dim.maxScore
      }\n`;
    });
    content += `\n`;

    content += `TEACHER FEEDBACK:\n`;
    content += `${currentMarking?.feedbackComment || 'No feedback commentary recorded.'}\n\n`;

    if (approvedFindings.length > 0) {
      content += `REVIEW NOTES:\n`;
      approvedFindings.forEach((f, idx) => {
        content += `${idx + 1}. [${f.type}] "${f.originalText}" -> "${
          f.replacementText
        }"\n`;
        content += `   Note: ${f.teacherCustomText || f.explanation}\n`;
      });
      content += `\n`;
    }

    if (currentTranscript?.editedText) {
      content += `VERIFIED STUDENT TRANSCRIPT:\n`;
      content += `${currentTranscript.editedText}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appliedMatching.classId}_No${String(
      activeStudent.classNumber
    ).padStart(2, '0')}_${activeStudent.displayName}_Feedback.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Draft vs Approved Notice */}
      <div
        className={`p-3 border rounded-md flex items-center justify-between gap-3 text-xs ${
          isApproved
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        <div className="flex items-center gap-2">
          {isApproved ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>
            {isApproved
              ? '✓ Teacher-approved evaluation. Ready for local export.'
              : 'Teacher approval is incomplete. This draft report cannot be finalized.'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[30px] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportText}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[30px] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Text</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout: Left Printable Report Card, Right Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_240px] gap-4 items-start">
        {/* Printable Report Document */}
        <article className="bg-white rounded-lg border border-slate-200 p-8 shadow-xs max-w-3xl mx-auto w-full print:border-none print:shadow-none print:p-0">
          {/* Report Header */}
          <header className="pb-5 border-b-2 border-slate-800 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
                Learning Hub · Writing Assessment
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {assignment.title || 'Untitled Writing Task'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Class {appliedMatching.classId} · No.{' '}
                {activeStudent
                  ? String(activeStudent.classNumber).padStart(2, '0')
                  : '—'}{' '}
                · {activeStudent?.displayName}
              </p>
            </div>

            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold ${
                isApproved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isApproved ? 'Teacher Approved' : 'Draft Report'}
            </span>
          </header>

          {/* Overall Score Section */}
          <div className="py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Overall Score</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {rubric.map((r) => r.name).join(' • ')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold text-blue-700">
                {totalScore}
              </span>
              <span className="text-sm text-slate-400 font-semibold">
                {' '}
                / {maxPossibleScore}
              </span>
            </div>
          </div>

          {/* Rubric Breakdown Grid */}
          <div className="py-4 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Rubric Dimension Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {rubric.map((dim) => (
                <div
                  key={dim.id}
                  className="p-2 bg-slate-50 border border-slate-100 rounded flex justify-between items-center"
                >
                  <span className="text-slate-600">{dim.name}</span>
                  <span className="font-bold text-slate-800">
                    {currentMarking?.scores[dim.id] ?? 0} / {dim.maxScore}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Feedback Commentary */}
          <div className="py-4 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Teacher Feedback
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/60 p-3 rounded-md border border-slate-100">
              {currentMarking?.feedbackComment ||
                'No written commentary entered yet.'}
            </p>
          </div>

          {/* Reviewed Notes */}
          <div className="py-4 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Specific Language & Accuracy Notes
            </h4>
            {approvedFindings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No specific language corrections flagged.
              </p>
            ) : (
              <div className="space-y-2">
                {approvedFindings.map((f, idx) => (
                  <div key={f.id} className="text-xs text-slate-700">
                    <span className="font-semibold text-blue-700">
                      {idx + 1}. [{f.type}]
                    </span>{' '}
                    <span className="font-medium text-slate-800">
                      "{f.originalText}" → "{f.replacementText}":
                    </span>{' '}
                    <span className="text-slate-600">
                      {f.teacherCustomText || f.explanation}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Verified Transcript Excerpt */}
          {currentTranscript?.editedText && (
            <div className="py-4 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Verified Student Writing
              </h4>
              <p className="text-xs font-serif text-slate-700 bg-slate-50/50 p-3 rounded border border-slate-100 whitespace-pre-line leading-relaxed">
                {currentTranscript.editedText}
              </p>
            </div>
          )}

          {/* Footer Notice & Publishing Guard */}
          <footer className="pt-4 mt-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-500 leading-relaxed mb-4">
              <strong>Publication Integration Boundary:</strong> Publishing directly to student or parent accounts is disabled in this phase. Real publishing requires administrative database integration.
            </div>

            <div className="flex justify-end gap-3 print:hidden">
              <button
                type="button"
                disabled={true}
                title="Publishing integration is not yet connected"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publish to Portal (Not Configured)</span>
              </button>
            </div>
          </footer>
        </article>

        {/* Student Queue on the Right */}
        <aside className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs sticky top-14 print:hidden">
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
              const approved = marking?.isApproved;

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
                    {approved && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />
                    )}
                  </div>
                  <span
                    className={`block text-[10px] mt-0.5 ${
                      approved ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {approved ? '✓ Approved' : 'Draft evaluation'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 print:hidden">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Review Marking
        </button>
      </div>
    </div>
  );
};
