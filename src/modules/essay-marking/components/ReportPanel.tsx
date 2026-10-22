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
  FileText,
  User,
} from 'lucide-react';
import {
  generateStudentMarkdownReport,
  generateSafeMarkdownFilename,
  downloadMarkdownFile,
} from '../utils/markdownReportGenerator';
import {
  generateStudentDocxBlob,
  generateSafeDocxFilename,
  downloadDocxFile,
} from '../utils/docxReportGenerator';
import {
  generateSafeHtmlReportFilename,
  generateAllStudentsHtmlReport,
  generateStudentHtmlReport,
  generateSafeStudentHtmlReportFilename,
  downloadHtmlFile,
  buildAnnotatedWritingHtml,
  REPORT_ANNOTATION_CSS,
} from '../utils/htmlReportGenerator';

export interface StudentReportCardProps {
  assignment: AssignmentConfig;
  classId: string;
  student: StudentRosterItem;
  studentIndex: number;
  rubric: RubricDimension[];
  transcript?: StudentTranscriptState;
  marking?: StudentMarkingState;
  isSelected: boolean;
  onSelect: () => void;
}

export const StudentReportCard: React.FC<StudentReportCardProps> = ({
  assignment,
  classId,
  student,
  studentIndex,
  rubric,
  transcript,
  marking,
  isSelected,
  onSelect,
}) => {
  const isApproved = marking?.isApproved ?? false;
  const hasMarking = !!marking;
  const hasScores = !!marking && !!marking.scores && Object.keys(marking.scores).length > 0;

  const totalScore =
    marking?.totalScore ??
    (hasScores
      ? rubric.reduce((acc, dim) => acc + (marking?.scores?.[dim.id] ?? 0), 0)
      : 0);
  const maxPossibleScore = rubric.reduce((acc, dim) => acc + dim.maxScore, 0);

  const transcriptText = transcript?.editedText || transcript?.rawOcrText || '';
  const savedLineStructure = (transcript?.linesWithBboxes || []).map((l) => l.text);

  const { html: writingHtml, normalizedFindings } = buildAnnotatedWritingHtml(
    transcriptText,
    marking?.findings || [],
    student.id,
    savedLineStructure
  );

  // Filter notes: use normalizedFindings (which match in-text annotations)
  const approvedFindings = (normalizedFindings || []).filter((f) => {
    if (f.decision === 'rejected') return false;
    if (f.feedbackType === 'improvement' || f.feedbackType === 'clarity') return true;
    if (f.decision === 'needs_review') return false;
    return f.decision === 'accepted' || f.decision === 'edited' || f.decision === 'pending';
  });

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.print();
  };

  const handleExportText = (e: React.MouseEvent) => {
    e.stopPropagation();

    let content = `LEARNING HUB — WRITING FEEDBACK REPORT\n`;
    content += `Assignment: ${assignment.title || 'Untitled Writing'}\n`;
    content += `Class: ${classId} | Student: No. ${String(
      student.classNumber
    ).padStart(2, '0')} ${student.displayName}\n`;
    content += `Status: ${
      isApproved ? 'Teacher Approved' : hasMarking ? 'Draft / Unapproved' : 'Pending Marking'
    }\n`;
    content += `Score: ${hasScores ? `${totalScore} / ${maxPossibleScore}` : `Pending / ${maxPossibleScore}`}\n`;
    content += `--------------------------------------------------\n\n`;

    content += `RUBRIC BREAKDOWN:\n`;
    rubric.forEach((dim) => {
      const dimScore = marking?.scores?.[dim.id];
      content += `- ${dim.name}: ${dimScore !== undefined ? dimScore : '—'} / ${dim.maxScore}\n`;
    });
    content += `\n`;

    if (marking?.assessmentComments) {
      content += `STRUCTURED FEEDBACK:\n`;
      content += `- Positive: ${marking.assessmentComments.positive || '—'}\n`;
      content += `- Relevant: ${marking.assessmentComments.relevant || '—'}\n`;
      content += `- Next Step: ${marking.assessmentComments.finalNextStep || '—'}\n\n`;
    }

    content += `TEACHER FEEDBACK:\n`;
    content += `${marking?.feedbackComment || 'No feedback commentary recorded.'}\n\n`;

    if (approvedFindings.length > 0) {
      content += `REVIEW NOTES:\n`;
      approvedFindings.forEach((f, idx) => {
        const typeBadge =
          f.feedbackType === 'improvement'
            ? `Optional Improvement · ${f.type}`
            : f.feedbackType === 'clarity'
            ? `Clarity / Coherence · ${f.type}`
            : f.type;
        const suggestionText =
          f.feedbackType === 'improvement' || f.feedbackType === 'clarity'
            ? `suggested phrasing: (${f.replacementText})`
            : `"${f.replacementText}"`;

        content += `${idx + 1}. [${typeBadge}] "${f.originalText}" -> ${suggestionText}\n`;
        content += `   Note: ${f.teacherCustomText || f.explanation}\n`;
      });
      content += `\n`;
    }

    if (transcript?.editedText || transcript?.rawOcrText) {
      content += `VERIFIED STUDENT TRANSCRIPT:\n`;
      content += `${transcript.editedText || transcript.rawOcrText}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${classId}_No${String(
      student.classNumber
    ).padStart(2, '0')}_${student.displayName}_Feedback.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();

    const filename = generateSafeMarkdownFilename(
      assignment.title,
      classId,
      student.classNumber,
      student.displayName
    );

    const mdContent = generateStudentMarkdownReport({
      assignmentTitle: assignment.title,
      classId,
      studentNumber: student.classNumber,
      studentName: student.displayName,
      isApproved,
      totalScore: hasScores ? totalScore : 0,
      maxPossibleScore,
      rubric,
      scores: marking?.scores || {},
      feedbackComment: marking?.feedbackComment,
      assessmentComments: marking?.assessmentComments,
      transcriptText: transcript?.editedText || transcript?.rawOcrText || '',
      findings: marking?.findings || [],
    });

    downloadMarkdownFile(filename, mdContent);
  };

  const [isExportingDocx, setIsExportingDocx] = React.useState(false);

  const handleExportDocx = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExportingDocx) return;

    try {
      setIsExportingDocx(true);
      const filename = generateSafeDocxFilename(
        assignment.title,
        classId,
        student.classNumber,
        student.displayName
      );

      const blob = await generateStudentDocxBlob({
        assignmentTitle: assignment.title,
        classId,
        studentNumber: student.classNumber,
        studentName: student.displayName,
        isApproved,
        totalScore: hasScores ? totalScore : 0,
        maxPossibleScore,
        rubric,
        scores: marking?.scores || {},
        feedbackComment: marking?.feedbackComment,
        assessmentComments: marking?.assessmentComments,
        transcriptText: transcript?.editedText || transcript?.rawOcrText || '',
        findings: marking?.findings || [],
      });

      downloadDocxFile(filename, blob);
    } catch (err) {
      console.error('Failed to export DOCX report:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportHtml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = generateSafeStudentHtmlReportFilename(
      assignment.title,
      classId,
      student
    );
    const htmlContent = generateStudentHtmlReport({
      assignment,
      classId,
      student,
      rubric,
      transcript,
      marking,
    });
    downloadHtmlFile(filename, htmlContent);
  };

  return (
    <article
      id={`report-student-${student.id}`}
      data-testid={`student-report-card-${student.id}`}
      onClick={onSelect}
      className={`bg-white rounded-lg border p-6 sm:p-8 shadow-xs w-full max-w-3xl mx-auto scroll-mt-24 transition-all print:border-none print:shadow-none print:p-0 print:break-after-page ${
        isSelected
          ? 'border-blue-400 ring-2 ring-blue-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Student Action & Status Bar */}
      <div
        className={`p-3 mb-6 border rounded-md flex flex-wrap items-center justify-between gap-3 text-xs ${
          isApproved
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : hasMarking
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          {isApproved ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="font-medium">
            {isApproved
              ? '✓ Teacher-approved evaluation. Ready for local export.'
              : hasMarking
              ? 'Teacher approval is incomplete. This draft report cannot be finalized.'
              : 'Marking is pending for this student.'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            title={`Print report for ${student.displayName}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[30px] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportText}
            title={`Export text report for ${student.displayName}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[30px] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Text</span>
          </button>

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-2xs min-h-[30px] transition-colors"
            title={`Export report for ${student.displayName} as a formatted Markdown (.md) file`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export .md</span>
          </button>

          <button
            type="button"
            onClick={handleExportDocx}
            disabled={isExportingDocx}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-semibold shadow-2xs min-h-[30px] transition-colors"
            title={`Export report for ${student.displayName} as a formatted Word (.docx) document`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExportingDocx ? 'Exporting...' : 'Export .docx'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs min-h-[30px] transition-colors"
            title={`Export report for ${student.displayName} as a standalone formatted HTML (.html) file`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export .html</span>
          </button>
        </div>
      </div>

      {/* Report Header */}
      <header className="pb-5 border-b-2 border-slate-800 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
            Learning Hub · Writing Assessment
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            {assignment.title || 'Untitled Writing Task'}
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Class {classId} · No.{' '}
            {String(student.classNumber).padStart(2, '0')} · {student.displayName}
          </p>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold shrink-0 ${
            isApproved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : hasMarking
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {isApproved ? 'Teacher Approved' : hasMarking ? 'Draft Report' : 'Pending Marking'}
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
          {hasScores ? (
            <>
              <span className="text-3xl font-extrabold text-blue-700">{totalScore}</span>
              <span className="text-sm text-slate-400 font-semibold"> / {maxPossibleScore}</span>
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">Scores pending completion of marking</span>
          )}
        </div>
      </div>

      {/* Rubric Breakdown Grid */}
      <div className="py-4 border-b border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Rubric Dimension Breakdown
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {rubric.map((dim) => {
            const scoreVal = marking?.scores?.[dim.id];
            return (
              <div
                key={dim.id}
                className="p-2 bg-slate-50 border border-slate-100 rounded flex justify-between items-center"
              >
                <span className="text-slate-600">{dim.name}</span>
                <span className="font-bold text-slate-800">
                  {scoreVal !== undefined ? scoreVal : '—'} / {dim.maxScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Teacher Feedback Commentary */}
      <div className="py-4 border-b border-slate-100 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Teacher Feedback
        </h4>
        {marking?.assessmentComments && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-md">
              <span className="font-bold text-emerald-800 text-[11px] block mb-1">★ 優點與亮點 (Positive)</span>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {marking.assessmentComments.positive || '—'}
              </p>
            </div>
            <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-md">
              <span className="font-bold text-amber-800 text-[11px] block mb-1">✎ 改進建議 (Relevant)</span>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {marking.assessmentComments.relevant || '—'}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-md">
              <span className="font-bold text-blue-800 text-[11px] block mb-1">➜ 下一步行動 (Next Step)</span>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {marking.assessmentComments.finalNextStep || '—'}
              </p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/60 p-3 rounded-md border border-slate-100">
          {marking?.feedbackComment || 'No written commentary entered yet.'}
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
            {approvedFindings.map((f, idx) => {
              const needsReview = f.decision === 'needs_review';
              const typeLabel =
                f.feedbackType === 'improvement'
                  ? `Optional Improvement · ${f.type}`
                  : f.feedbackType === 'clarity'
                  ? `Clarity / Coherence · ${f.type}`
                  : needsReview
                  ? `Requires Review · ${f.type}`
                  : f.type;
              const badgeColor =
                needsReview
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : f.feedbackType === 'improvement'
                  ? 'text-purple-700 bg-purple-50 border-purple-200'
                  : f.feedbackType === 'clarity'
                  ? 'text-sky-700 bg-sky-50 border-sky-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200';

              return (
                <div key={f.id} className="text-xs text-slate-700 flex items-start gap-1.5">
                  <span className="font-semibold text-slate-500 shrink-0">{idx + 1}.</span>
                  <div>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded border font-semibold text-[10px] uppercase mr-1.5 ${badgeColor}`}
                    >
                      {typeLabel}
                    </span>
                    {(() => {
                      const isInsertion = !f.originalText || f.originalText.trim() === '';
                      const quoteDisplay = isInsertion ? '^' : f.originalText;

                      if (f.feedbackType === 'improvement' || f.feedbackType === 'clarity') {
                        return (
                          <span className="font-medium text-slate-800">
                            "{quoteDisplay}" → suggested phrasing:{' '}
                            <span
                              className={
                                f.feedbackType === 'improvement'
                                  ? 'text-purple-700 font-semibold'
                                  : 'text-sky-700 font-semibold'
                              }
                            >
                              ({f.replacementText})
                            </span>
                          </span>
                        );
                      }

                      return (
                        <span className="font-medium text-slate-800">
                          "{quoteDisplay}" →{' '}
                          <span className="text-emerald-700 font-semibold">"{f.replacementText}"</span>
                        </span>
                      );
                    })()}
                    : <span className="text-slate-600">{f.teacherCustomText || f.explanation}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Annotated Student Writing */}
      <div className="py-4 border-b border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Annotated Student Writing
        </h4>
        {transcriptText ? (
          <>
            <style dangerouslySetInnerHTML={{ __html: REPORT_ANNOTATION_CSS }} />
            <div
              className="annotated-writing-container text-xs overflow-x-auto bg-white p-3 rounded border border-slate-100 font-serif"
              dangerouslySetInnerHTML={{ __html: writingHtml }}
            />
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">No transcript recorded yet for this student.</p>
        )}
      </div>

      {/* Footer Notice & Publishing Guard */}
      <footer className="pt-4 mt-2">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-500 leading-relaxed mb-4">
          <strong>Publication Integration Boundary:</strong> Publishing directly to student or parent
          accounts is disabled in this phase. Real publishing requires administrative database
          integration.
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
  );
};

export interface ReportPanelProps {
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
  // Build assigned student list in existing queue order
  const assignedIndices =
    appliedMatching?.assignedStudentIndices && appliedMatching.assignedStudentIndices.length > 0
      ? appliedMatching.assignedStudentIndices
      : students.map((_, idx) => idx);

  // Compute approval stats across all assigned students
  const approvedCount = assignedIndices.reduce((count, idx) => {
    const student = students[idx];
    if (student && markings[student.id]?.isApproved) return count + 1;
    return count;
  }, 0);

  const handleQueueClick = (studentIdx: number, studentId: string) => {
    onSelectStudent(studentIdx);
    const element = document.getElementById(`report-student-${studentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [isExportHtmlModalOpen, setIsExportHtmlModalOpen] = React.useState(false);

  const handleConfirmExportAllHtml = () => {
    const filename = generateSafeHtmlReportFilename(
      assignment.title,
      appliedMatching.classId
    );

    const htmlContent = generateAllStudentsHtmlReport({
      assignment,
      classId: appliedMatching.classId,
      students,
      assignedIndices,
      rubric,
      transcripts,
      markings,
    });

    downloadHtmlFile(filename, htmlContent);
    setIsExportHtmlModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Class-Level Summary Banner */}
      <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            Class {appliedMatching.classId} Writing Assessment
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">
            {assignedIndices.length} Student Reports
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-emerald-700 font-medium">
            {approvedCount} of {assignedIndices.length} Approved
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[30px] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print All Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportHtmlModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs min-h-[30px] transition-colors"
            title="Export all students' reports as a standalone offline HTML document"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All Reports .html</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Continuous Layout: Left Continuous Reports, Right Sticky Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px] gap-6 items-start">
        {/* Continuous Vertical Report Stream */}
        <div className="space-y-8 min-w-0" data-testid="continuous-report-stream">
          {assignedIndices.map((studentIdx) => {
            const student = students[studentIdx];
            if (!student) return null;

            return (
              <StudentReportCard
                key={student.id}
                assignment={assignment}
                classId={appliedMatching.classId}
                student={student}
                studentIndex={studentIdx}
                rubric={rubric}
                transcript={transcripts[student.id]}
                marking={markings[student.id]}
                isSelected={studentIdx === activeStudentIndex}
                onSelect={() => onSelectStudent(studentIdx)}
              />
            );
          })}
        </div>

        {/* Student Queue Navigation Sidebar */}
        <aside className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs sticky top-16 print:hidden">
          <div className="pb-2 border-b border-slate-100 mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Student Queue
            </h3>
            <span className="text-[11px] text-slate-400">
              {appliedMatching.classId} • {assignedIndices.length} essays
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
            {assignedIndices.map((studentIdx) => {
              const student = students[studentIdx];
              if (!student) return null;
              const isSelected = studentIdx === activeStudentIndex;
              const marking = markings[student.id];
              const approved = marking?.isApproved;

              return (
                <button
                  key={student.id}
                  type="button"
                  data-testid={`queue-student-btn-${student.id}`}
                  onClick={() => handleQueueClick(studentIdx, student.id)}
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
                      approved
                        ? 'text-emerald-600'
                        : marking
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {approved ? '✓ Approved' : marking ? 'Draft evaluation' : 'Pending marking'}
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

      {/* Export All HTML Confirmation & Privacy Notice Modal */}
      {isExportHtmlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs print:hidden"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Export All Student Reports (.html)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Generate a standalone offline document containing reports for all{' '}
                  <strong>{assignedIndices.length} students</strong> in Class{' '}
                  <strong>{appliedMatching.classId}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Privacy & Distribution Notice</span>
              </div>
              <p className="leading-relaxed">
                This file contains complete student writings, scores, and teacher evaluations. Please store
                and distribute it responsibly in accordance with school data privacy guidelines.
              </p>
              <p className="text-[11px] text-amber-700">
                <strong>Notice:</strong> This is an offline snapshot for reading, printing, and sharing. It
                is not an administrative system backup and cannot be used to restore database state.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExportHtmlModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExportAllHtml}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download HTML File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
