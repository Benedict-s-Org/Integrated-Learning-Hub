import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreparationPanel } from '@/modules/essay-marking/components/PreparationPanel';
import { AssignmentConfig } from '@/modules/essay-marking/types';

vi.mock('@/modules/essay-marking/components/PdfTemplateRegionEditor', () => ({
  PdfTemplateRegionEditor: ({ onRegionsChange }: any) => (
    <div data-testid="mock-pdf-region-editor">
      <span>Mock PDF Template Region Editor</span>
      <button
        onClick={() =>
          onRegionsChange([
            { id: 'r1', type: 'class', x: 0.1, y: 0.1, width: 0.2, height: 0.05, pageNumber: 1 },
          ])
        }
      >
        Set Mock Region
      </button>
    </div>
  ),
}));

describe('PreparationPanel Component UI & Behavior', () => {
  const baseAssignment: AssignmentConfig = {
    title: 'P3 Writing 01 · A Day at the Park',
    worksheetFileName: null,
    worksheetFile: null,
    worksheetPreviewUrl: null,
    responseFormat: 'worksheet',
    scopePrompt: 'Write 60–80 words about a day at the park.',
    isConfirmed: false,
    rubric: [],
    grade: null,
  };

  it('renders explicit P.1 to P.6 choices and does not silently default to P.3 from title', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    const onNext = vi.fn();

    render(
      <PreparationPanel
        assignment={baseAssignment}
        onChangeAssignment={onChange}
        onConfirmRequirements={onConfirm}
        onNext={onNext}
      />
    );

    // Verify all 6 grade buttons exist
    ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6'].forEach((g) => {
      expect(screen.getByRole('button', { name: g })).toBeInTheDocument();
    });

    // Verification prompt displayed when no grade selected
    expect(
      screen.getByText('Please choose a grade (P.1–P.6) above to display rubric dimensions.')
    ).toBeInTheDocument();
    expect(screen.getByText('Total Points: 0')).toBeInTheDocument();

    // Confirm button is disabled when grade is not selected
    const confirmBtn = screen.getByRole('button', { name: /Confirm Requirements/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('renders two-column layout with Rubric Dimensions on left and Overall Grade on right', () => {
    const onChange = vi.fn();
    render(
      <PreparationPanel
        assignment={baseAssignment}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(screen.getByText('Rubric Dimensions (Max Score)')).toBeInTheDocument();
    expect(screen.getByText('Overall Grade')).toBeInTheDocument();

    // Verify all 6 overall grade tiers
    ['A', 'A−', 'B+', 'B', 'B−', 'C+'].forEach((tier) => {
      expect(screen.getByText(tier)).toBeInTheDocument();
    });

    // Verify the two required notices
    expect(
      screen.getByText('Overall grade will be shown alongside the numerical score.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Score-to-grade mapping is not configured yet.')
    ).toBeInTheDocument();
  });

  it('displays Content 60, Language 40, Total Points: 100 for P.1–P.3 without Organisation', () => {
    const assignmentP2: AssignmentConfig = {
      ...baseAssignment,
      grade: 'P.2',
      rubric: [
        { id: 'content', name: 'Content', maxScore: 60 },
        { id: 'language', name: 'Language', maxScore: 40 },
      ],
    };

    render(
      <PreparationPanel
        assignment={assignmentP2}
        onChangeAssignment={vi.fn()}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('60 pts')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('40 pts')).toBeInTheDocument();
    expect(screen.getByText('Total Points: 100')).toBeInTheDocument();

    // Organisation, Vocabulary, Mechanics must not be present
    expect(screen.queryByText('Organisation')).not.toBeInTheDocument();
    expect(screen.queryByText('Organization')).not.toBeInTheDocument();
    expect(screen.queryByText('Vocabulary')).not.toBeInTheDocument();
    expect(screen.queryByText('Mechanics')).not.toBeInTheDocument();
  });

  it('displays Content 40, Language 40, Organisation 20, Total Points: 100 for P.4–P.6', () => {
    const assignmentP5: AssignmentConfig = {
      ...baseAssignment,
      grade: 'P.5',
      rubric: [
        { id: 'content', name: 'Content', maxScore: 40 },
        { id: 'language', name: 'Language', maxScore: 40 },
        { id: 'organisation', name: 'Organisation', maxScore: 20 },
      ],
    };

    render(
      <PreparationPanel
        assignment={assignmentP5}
        onChangeAssignment={vi.fn()}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getAllByText('40 pts')).toHaveLength(2); // Content & Language
    expect(screen.getByText('Organisation')).toBeInTheDocument();
    expect(screen.getByText('20 pts')).toBeInTheDocument();
    expect(screen.getByText('Total Points: 100')).toBeInTheDocument();

    // Vocabulary & Mechanics must not be present
    expect(screen.queryByText('Vocabulary')).not.toBeInTheDocument();
    expect(screen.queryByText('Mechanics')).not.toBeInTheDocument();
  });

  it('triggers onChangeAssignment with fixed rubric when teacher clicks a grade button', () => {
    const onChange = vi.fn();
    render(
      <PreparationPanel
        assignment={baseAssignment}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    // Click P.4 button
    fireEvent.click(screen.getByRole('button', { name: 'P.4' }));

    expect(onChange).toHaveBeenCalledWith({
      grade: 'P.4',
      rubric: [
        { id: 'content', name: 'Content', maxScore: 40 },
        { id: 'language', name: 'Language', maxScore: 40 },
        { id: 'organisation', name: 'Organisation', maxScore: 20 },
      ],
      isConfirmed: false,
    });
  });

  it('automatically resolves trusted grade when selectedClassId is provided', () => {
    const onChange = vi.fn();
    render(
      <PreparationPanel
        assignment={baseAssignment}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
        selectedClassId="3A"
      />
    );

    expect(onChange).toHaveBeenCalledWith({
      grade: 'P.3',
      rubric: [
        { id: 'content', name: 'Content', maxScore: 60 },
        { id: 'language', name: 'Language', maxScore: 40 },
      ],
    });
  });

  it('initializes assignment title from uploaded PDF filename without extension', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PreparationPanel
        assignment={{ ...baseAssignment, title: '', isTitleCustomized: false }}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const pdfFile = new File(['%PDF-1.4 test content'], 'Writing 1 - Character Profile_Publishing.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Writing 1 - Character Profile_Publishing',
        worksheetFileName: 'Writing 1 - Character Profile_Publishing.pdf',
        isTitleCustomized: false,
      })
    );
  });

  it('prompts user and preserves title if isTitleCustomized is true and user declines overwrite', () => {
    const onChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { container } = render(
      <PreparationPanel
        assignment={{
          ...baseAssignment,
          title: 'My Custom Teacher Title',
          isTitleCustomized: true,
        }}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const newPdf = new File(['%PDF-1.4'], 'New_Worksheet_File.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [newPdf] } });

    expect(confirmSpy).toHaveBeenCalled();
    // Title is NOT overwritten with New_Worksheet_File because teacher declined
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        worksheetFileName: 'New_Worksheet_File.pdf',
        title: 'My Custom Teacher Title',
      })
    );

    confirmSpy.mockRestore();
  });

  it('shows clear warning when a Word document (.docx) is selected', () => {
    const onChange = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(
      <PreparationPanel
        assignment={baseAssignment}
        onChangeAssignment={onChange}
        onConfirmRequirements={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const docxFile = new File(['fake docx'], 'assignment.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(fileInput, { target: { files: [docxFile] } });

    expect(alertSpy).toHaveBeenCalledWith('請先另存為 PDF 再上載。');
    expect(onChange).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});


