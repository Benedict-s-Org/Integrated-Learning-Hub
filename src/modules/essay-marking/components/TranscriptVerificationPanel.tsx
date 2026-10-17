import React, { useState } from 'react';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
} from '../types';
import { CheckCircle2, ZoomIn, Info } from 'lucide-react';
import { ScanPreviewModal } from './ScanPreviewModal';

interface TranscriptVerificationPanelProps {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching;
  activeStudentIndex: number;
  transcripts: Record<string, StudentTranscriptState>;
  onSelectStudent: (index: number) => void;
  onUpdateTranscriptText: (studentId: string, text: string) => void;
  onVerifyTranscript: (studentId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const TranscriptVerificationPanel: React.FC<TranscriptVerificationPanelProps> = ({
  students,
  pages,
  appliedMatching,
  activeStudentIndex,
  transcripts,
  onSelectStudent,
  onUpdateTranscriptText,
  onVerifyTranscript,
  onPrev,
  onNext,
}) => {
  const [selectedScanPagePart, setSelectedScanPagePart] = useState<number>(1);
  const [previewModalPage, setPreviewModalPage] = useState<ScanPage | null>(null);

  const activeStudent = students[activeStudentIndex];
  const activeStudentId = activeStudent?.id || '';
  const currentTranscript = transcripts[activeStudentId] || {
    studentId: activeStudentId,
    rawOcrText: null,
    editedText: '',
    isManuallyEntered: true,
    uncertainRegions: [],
    isVerified: false,
  };

  // Find all scan pages assigned to this active student
  const studentPagesWithIndices: { page: ScanPage; part: number; total: number }[] = [];
  appliedMatching.map.forEach((item, pageIndex) => {
    if (item && item.studentIndex === activeStudentIndex && pages[pageIndex]) {
      studentPagesWithIndices.push({
        page: pages[pageIndex],
        part: item.part,
        total: item.total,
      });
    }
  });

  const activePageItem =
    studentPagesWithIndices.find((p) => p.part === selectedScanPagePart) ||
    studentPagesWithIndices[0];

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateTranscriptText(activeStudentId, e.target.value);
  };

  return (
    <div className="space-y-4">
      {/* 3-Column Work Surface: Left Scan, Middle Transcript, Right Student Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_240px] gap-4 items-start">
        {/* Column 1: Original Scan Viewer */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-bold text-slate-800 truncate">
              {activeStudent ? `No. ${String(activeStudent.classNumber).padStart(2, '0')} ${activeStudent.displayName}` : 'Student'} · Original Scan
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              {studentPagesWithIndices.length}{' '}
              {studentPagesWithIndices.length === 1 ? 'page' : 'pages'}
            </span>
          </div>

          {/* Multi-page switcher tabs */}
          {studentPagesWithIndices.length > 1 && (
            <div className="flex items-center gap-1.5 mb-3 bg-slate-100 p-1 rounded-md text-xs">
              {studentPagesWithIndices.map((item) => (
                <button
                  key={item.part}
                  type="button"
                  onClick={() => setSelectedScanPagePart(item.part)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    activePageItem?.part === item.part
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Page {item.part} of {item.total}
                </button>
              ))}
            </div>
          )}

          {/* Scan image render */}
          <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md p-2 flex items-center justify-center relative overflow-hidden group">
            {activePageItem ? (
              <>
                <img
                  src={activePageItem.page.previewUrl}
                  alt={`Student essay scan`}
                  onClick={() => setPreviewModalPage(activePageItem.page)}
                  className="max-h-[580px] w-auto object-contain rounded cursor-zoom-in"
                />
                <button
                  type="button"
                  onClick={() => setPreviewModalPage(activePageItem.page)}
                  className="absolute bottom-3 right-3 px-2 py-1 bg-slate-900/70 hover:bg-slate-900 text-white rounded text-xs flex items-center gap-1 shadow transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Enlarge</span>
                </button>
              </>
            ) : (
              <div className="text-center text-slate-400 py-12 text-xs">
                No scan image assigned to this student.
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-400 text-center">
            Click scan image to enlarge. Preserves original handwriting context.
          </div>
        </section>

        {/* Column 2: Transcript Editor */}
        <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-bold text-slate-800">
              Student Transcript
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                currentTranscript.isVerified
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {currentTranscript.isVerified ? '✓ Verified' : 'Unverified Draft'}
            </span>
          </div>

          {/* Honest OCR Status Notice */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-md text-xs text-blue-800 flex items-start gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Manual Transcription Active:</strong> Automatic OCR service is currently unconfigured. Enter or edit the student's handwritten text manually below.
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-2">
            Preserve student spelling, punctuation, and grammar mistakes faithfully so the rubric evaluation can assess genuine student language.
          </p>

          <textarea
            rows={12}
            value={currentTranscript.editedText}
            onChange={handleTextChange}
            placeholder="Type or paste the student's handwritten text here..."
            className="w-full flex-1 p-3 text-base border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed resize-y font-serif min-h-[260px]"
            aria-label="Student transcript text editor"
          />

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {currentTranscript.editedText.trim()
                ? `${currentTranscript.editedText.trim().split(/\s+/).length} words`
                : 'Empty transcript'}
            </span>

            <button
              type="button"
              onClick={() => onVerifyTranscript(activeStudentId)}
              disabled={!currentTranscript.editedText.trim()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors min-h-[34px] ${
                currentTranscript.isVerified
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : currentTranscript.editedText.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {currentTranscript.isVerified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>✓ Transcript Verified</span>
                </>
              ) : (
                <span>Verify & Mark Next</span>
              )}
            </button>
          </div>
        </section>

        {/* Column 3: Student Roster Queue on Right */}
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
              const transcript = transcripts[student.id];
              const isVerified = transcript?.isVerified;

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
                    {isVerified && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />
                    )}
                  </div>
                  <span
                    className={`block text-[10px] mt-0.5 ${
                      isVerified
                        ? 'text-emerald-600'
                        : transcript?.editedText?.trim()
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {isVerified
                      ? '✓ Transcript verified'
                      : transcript?.editedText?.trim()
                      ? 'Draft transcript'
                      : 'Not transcribed'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Matching
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md min-h-[34px] transition-colors"
        >
          <span>Review Marking →</span>
        </button>
      </div>

      {/* Scan Preview Modal */}
      <ScanPreviewModal
        page={previewModalPage}
        matchInfo={null}
        onClose={() => setPreviewModalPage(null)}
      />
    </div>
  );
};
