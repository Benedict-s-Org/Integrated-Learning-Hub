import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MagnifierLens, MagnifierState } from '@/modules/essay-marking/components/MagnifierLens';
import { StagedCandidateBox } from '@/modules/essay-marking/components/StagedCandidateBox';
import { TranscriptVerificationPanel } from '@/modules/essay-marking/components/TranscriptVerificationPanel';
import {
  combineCandidateTranscript,
} from '@/modules/essay-marking/utils/transcriptionBatchQueue';
import {
  DEFAULT_TRANSCRIPTION_SETTINGS,
  ScanPage,
  StudentRosterItem,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  StagedCandidateTranscript,
} from '@/modules/essay-marking/types';

describe('Stage 4 Scan Magnifier & Faithful Line-Break Preservation', () => {
  const sampleTwoParagraphText = `Yesterday, I visited the city library with my sister.
We chose several interesting storybooks to read together.

After reading, we had a delicious lunch at the cafe nearby.
It was a meaningful and joyful weekend afternoon.`;

  describe('A. MagnifierLens Component', () => {
    it('does not render when visible is false or imgSrc is empty', () => {
      const stateHidden: MagnifierState = {
        visible: false,
        x: 100,
        y: 100,
        imgSrc: 'data:image/png;base64,AAAA',
        bgWidth: 600,
        bgHeight: 800,
        bgX: -50,
        bgY: -50,
        zoomLevel: 3.0,
      };

      const { container } = render(<MagnifierLens state={stateHidden} />);
      expect(container.firstChild).toBeNull();

      const stateNoImg: MagnifierState = {
        ...stateHidden,
        visible: true,
        imgSrc: '',
      };
      const { container: container2 } = render(<MagnifierLens state={stateNoImg} />);
      expect(container2.firstChild).toBeNull();
    });

    it('renders with pointer-events-none, high z-index, and displays 3.0x badge when visible', () => {
      const stateVisible: MagnifierState = {
        visible: true,
        x: 150,
        y: 200,
        imgSrc: 'data:image/png;base64,AAAA',
        bgWidth: 900,
        bgHeight: 1200,
        bgX: -100,
        bgY: -150,
        zoomLevel: 3.0,
      };

      render(<MagnifierLens state={stateVisible} />);
      const badge = screen.getByText('3.0×');
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('Handwriting Lens')).toBeInTheDocument();

      const lensContainer = badge.closest('div[style*="fixed"]');
      expect(lensContainer).toBeInTheDocument();
      expect(lensContainer).toHaveStyle({
        position: 'fixed',
        left: '150px',
        top: '200px',
        pointerEvents: 'none',
        zIndex: '9999',
      });
    });
  });

  describe('B. Candidate Transcript Combination & Formatting', () => {
    it('preserves exact line breaks and paragraph breaks from model output without collapsing whitespace', () => {
      const candidate = combineCandidateTranscript({
        studentId: 's1',
        studentIndex: 0,
        tasksForStudent: [
          {
            taskId: 't1',
            studentId: 's1',
            studentIndex: 0,
            studentName: 'Chan Tai Man',
            classNumber: 1,
            scanPage: {
              id: 'p1',
              fileId: 'f1',
              fileName: 'scan.png',
              sourcePageNumber: 1,
              previewUrl: 'data:image/png;base64,AAAA',
              orderIndex: 0,
            },
            part: 1,
            totalParts: 1,
            regions: [],
            status: 'success',
            transcript: sampleTwoParagraphText,
          },
        ],
        settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      });

      expect(candidate.transcript).toBe(sampleTwoParagraphText);
      expect(candidate.transcript).toContain('\n\n'); // Two paragraphs
      const lines = candidate.transcript.split('\n');
      expect(lines).toHaveLength(5); // 4 text lines + 1 empty line
      expect(candidate.wordCount).toBe(36); // Exact word count across lines
    });

    it('joins multi-page transcripts without inventing empty paragraph lines between pages', () => {
      const page1Text = `Title: My Holiday\nParagraph 1 line 1\nParagraph 1 line 2`;
      const page2Text = `Paragraph 2 line 1\nParagraph 2 line 2`;

      const candidate = combineCandidateTranscript({
        studentId: 's1',
        studentIndex: 0,
        tasksForStudent: [
          {
            taskId: 't1',
            studentId: 's1',
            studentIndex: 0,
            studentName: 'Chan Tai Man',
            classNumber: 1,
            scanPage: {
              id: 'p1',
              fileId: 'f1',
              fileName: 'scan.png',
              sourcePageNumber: 1,
              previewUrl: 'data:image/png;base64,AAAA',
              orderIndex: 0,
            },
            part: 1,
            totalParts: 2,
            regions: [],
            status: 'success',
            transcript: page1Text,
          },
          {
            taskId: 't2',
            studentId: 's1',
            studentIndex: 0,
            studentName: 'Chan Tai Man',
            classNumber: 1,
            scanPage: {
              id: 'p2',
              fileId: 'f1',
              fileName: 'scan.png',
              sourcePageNumber: 2,
              previewUrl: 'data:image/png;base64,BBBB',
              orderIndex: 1,
            },
            part: 2,
            totalParts: 2,
            regions: [],
            status: 'success',
            transcript: page2Text,
          },
        ],
        settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      });

      // Joined with '\n' so page boundary does not fabricate a blank-line paragraph
      expect(candidate.transcript).toBe(`${page1Text}\n${page2Text}`);
      expect(candidate.pageResults).toHaveLength(2);
      expect(candidate.pageResults[0].transcript).toBe(page1Text);
      expect(candidate.pageResults[1].transcript).toBe(page2Text);
    });

    it('supports positional call signature without throwing', () => {
      const candidate = combineCandidateTranscript(
        'student_abc',
        [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'success',
            transcript: sampleTwoParagraphText,
          },
        ],
        DEFAULT_TRANSCRIPTION_SETTINGS,
        'local_qwen_vl',
        'sig_123',
        'asg_456'
      );

      expect(candidate.studentId).toBe('student_abc');
      expect(candidate.transcript).toBe(sampleTwoParagraphText);
      expect(candidate.assignmentId).toBe('asg_456');
      expect(candidate.pageSignature).toBe('sig_123');
    });
  });

  describe('C. StagedCandidateBox Rendering & Actions', () => {
    it('renders single-page candidate preserving newlines with whitespace-pre-wrap', () => {
      const candidate: StagedCandidateTranscript = {
        id: 'c1',
        studentId: 's1',
        transcript: sampleTwoParagraphText,
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.1',
        settingsVersion: 'v1.0',
        pageSignature: 'sig1',
        status: 'candidate_ready',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 1,
            status: 'success',
            transcript: sampleTwoParagraphText,
          },
        ],
        hasUnreadable: false,
        wordCount: 32,
      };

      const { container } = render(
        <StagedCandidateBox
          candidate={candidate}
          studentId="s1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      const textBox = container.querySelector('.whitespace-pre-wrap');
      expect(textBox).toBeInTheDocument();
      expect(textBox).toHaveClass('break-words');
      expect(textBox?.textContent).toContain('Yesterday, I visited the city library with my sister.');
      expect(textBox?.textContent).toContain('It was a meaningful and joyful weekend afternoon.');
    });

    it('renders multi-page candidate with distinct visual page boundaries outside student text', () => {
      const candidate: StagedCandidateTranscript = {
        id: 'c2',
        studentId: 's1',
        transcript: 'Page 1 line 1\nPage 1 line 2\nPage 2 line 1\nPage 2 line 2',
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.1',
        settingsVersion: 'v1.0',
        pageSignature: 'sig2',
        status: 'candidate_ready',
        pageResults: [
          {
            scanPageId: 'p1',
            part: 1,
            totalParts: 2,
            status: 'success',
            transcript: 'Page 1 line 1\nPage 1 line 2',
          },
          {
            scanPageId: 'p2',
            part: 2,
            totalParts: 2,
            status: 'success',
            transcript: 'Page 2 line 1\nPage 2 line 2',
          },
        ],
        hasUnreadable: false,
        wordCount: 16,
      };

      render(
        <StagedCandidateBox
          candidate={candidate}
          studentId="s1"
          isStale={false}
          onApply={vi.fn()}
          onCopy={vi.fn()}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      // Distinct visual boundary outside student text
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Page 2 line 2/)).toBeInTheDocument();
    });

    it('Copy and Apply actions emit the student-authored text without UI page labels', () => {
      const onCopy = vi.fn();
      const onApply = vi.fn();

      const candidate: StagedCandidateTranscript = {
        id: 'c3',
        studentId: 's1',
        transcript: sampleTwoParagraphText,
        receivedAt: Date.now(),
        provider: 'local_qwen_vl',
        promptVersion: 'v1.1',
        settingsVersion: 'v1.0',
        pageSignature: 'sig3',
        status: 'candidate_ready',
        pageResults: [],
        hasUnreadable: false,
        wordCount: 32,
      };

      render(
        <StagedCandidateBox
          candidate={candidate}
          studentId="s1"
          isStale={false}
          onApply={onApply}
          onCopy={onCopy}
          onDiscard={vi.fn()}
          isCopied={false}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Copy Candidate/i });
      fireEvent.click(copyBtn);
      expect(onCopy).toHaveBeenCalled();

      const applyBtn = screen.getByRole('button', { name: /Apply Candidate to Editor/i });
      fireEvent.click(applyBtn);
      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('D. TranscriptVerificationPanel Live Magnifier & Text Verification', () => {
    const mockStudents: StudentRosterItem[] = [
      { id: 's1', displayName: 'Chan Tai Man', classNumber: 1, className: '3A' },
      { id: 's2', displayName: 'Wong Ka Yan', classNumber: 2, className: '3A' },
    ];

    const mockPages: ScanPage[] = [
      {
        id: 'p1',
        fileId: 'f1',
        fileName: 'scan1.png',
        sourcePageNumber: 1,
        previewUrl: 'data:image/png;base64,AAAA',
        orderIndex: 0,
      },
      {
        id: 'p2',
        fileId: 'f1',
        fileName: 'scan2.png',
        sourcePageNumber: 2,
        previewUrl: 'data:image/png;base64,BBBB',
        orderIndex: 1,
      },
    ];

    const mockAppliedMatching: AppliedMatching = {
      classId: '3A',
      counts: [1, 1],
      assignedStudentIndices: [0, 1],
      map: [
        { studentIndex: 0, studentId: 's1', studentName: 'Chan Tai Man', classNumber: 1, part: 1, total: 1 },
        { studentIndex: 1, studentId: 's2', studentName: 'Wong Ka Yan', classNumber: 2, part: 1, total: 1 },
      ],
    };

    const mockTranscripts: Record<string, StudentTranscriptState> = {
      s1: {
        studentId: 's1',
        rawOcrText: null,
        editedText: 'Teacher confirmed text.\nSecond line.',
        isManuallyEntered: true,
        uncertainRegions: [],
        isVerified: true,
      },
      s2: {
        studentId: 's2',
        rawOcrText: null,
        editedText: '',
        isManuallyEntered: true,
        uncertainRegions: [],
        isVerified: false,
      },
    };

    const mockAssignment: AssignmentConfig = {
      title: 'Writing Task',
      worksheetFileName: null,
      worksheetFile: null,
      worksheetPreviewUrl: null,
      responseFormat: 'worksheet',
      scopePrompt: 'Write an essay.',
      isConfirmed: true,
      rubric: [],
      templateRegions: [
        { id: 'wa1', type: 'writing_area', pageNumber: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      ],
    };

    it('displays English help text and handles pointer movement over scan image', () => {
      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      // Verify suggested English help text
      expect(
        screen.getByText('Hover over the scan to magnify handwriting. Click Enlarge for a larger view.')
      ).toBeInTheDocument();

      const scanImg = screen.getByAltText('Student essay scan');
      expect(scanImg).toBeInTheDocument();

      // Mock getBoundingClientRect and natural dimensions for coordinate math
      vi.spyOn(scanImg, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 100,
        width: 400,
        height: 500,
        right: 500,
        bottom: 600,
        x: 100,
        y: 100,
        toJSON: () => {},
      });
      Object.defineProperty(scanImg, 'naturalWidth', { value: 800 });
      Object.defineProperty(scanImg, 'naturalHeight', { value: 1000 });

      // Move pointer over center of scan image
      fireEvent.pointerMove(scanImg, {
        clientX: 300,
        clientY: 350,
        pointerType: 'mouse',
      });

      // Handwriting lens should now be in the DOM
      expect(screen.getByText('Handwriting Lens')).toBeInTheDocument();
      expect(screen.getByText('3.0×')).toBeInTheDocument();

      // Pointer leaves image -> hides lens
      fireEvent.pointerLeave(scanImg);
      expect(screen.queryByText('Handwriting Lens')).not.toBeInTheDocument();
    });

    it('preserves existing teacher text and does not modify it without teacher action', () => {
      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={mockTranscripts}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      const textarea = screen.getByLabelText('Student transcript text editor') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Teacher confirmed text.\nSecond line.');
    });

    it('renders line bounding boxes and synchronizes click-to-highlight with transcript lines', () => {
      const transcriptsWithBboxes = {
        s1: {
          ...mockTranscripts.s1,
          linesWithBboxes: [
            { text: 'First line with box.', bbox: [150, 200, 800, 250] as [number, number, number, number], pageNumber: 1, scanPageId: 'p1' },
            { text: 'Second line short.', bbox: [150, 260, 350, 310] as [number, number, number, number], pageNumber: 1, scanPageId: 'p1' },
            { text: 'Unboxed line.', bbox: null, pageNumber: 1, scanPageId: 'p1' },
          ],
        },
      };

      render(
        <TranscriptVerificationPanel
          students={mockStudents}
          pages={mockPages}
          appliedMatching={mockAppliedMatching}
          activeStudentIndex={0}
          transcripts={transcriptsWithBboxes}
          assignment={mockAssignment}
          onSelectStudent={vi.fn()}
          onUpdateTranscriptText={vi.fn()}
          onVerifyTranscript={vi.fn()}
          onPrev={vi.fn()}
          onNext={vi.fn()}
        />
      );

      // Verify line overlay badges are rendered on scan image
      const line1Box = screen.getByTitle('Line 1: First line with box.');
      const line2Box = screen.getByTitle('Line 2: Second line short.');
      expect(line1Box).toBeInTheDocument();
      expect(line2Box).toBeInTheDocument();

      // Check percentage-based responsive scaling coordinates (0-1000 converted to % with 1% display padding)
      expect(line1Box).toHaveStyle({
        left: '14%', // 15% - 1% display padding
        top: '20%',
        width: '67%', // 65% + 2% (1% left + 1% right display padding)
        height: '5%', // (250 - 200) / 10 = 5%
      });

      // Short line 2 width is bounded with display padding: (360 - 140) / 10 = 22%
      expect(line2Box).toHaveStyle({
        left: '14%',
        top: '26%',
        width: '22%',
        height: '5%',
      });

      // Unboxed line (bbox: null) does not produce a scan box
      expect(screen.queryByTitle(/Unboxed line/)).not.toBeInTheDocument();

      // Clicking line 1 box highlights it and shows active highlight bar
      fireEvent.click(line1Box);
      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('"First line with box."')).toBeInTheDocument();

      // Clicking line 2 box switches highlight to Line 2
      fireEvent.click(line2Box);
      expect(screen.getByText('Line 2')).toBeInTheDocument();
      expect(screen.getByText('"Second line short."')).toBeInTheDocument();

      // Clear button clears active highlight
      fireEvent.click(screen.getByText('Clear'));
      expect(screen.queryByText('"Second line short."')).not.toBeInTheDocument();
    });
  });
});
