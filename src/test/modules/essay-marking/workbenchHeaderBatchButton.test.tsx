import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkbenchHeader } from '@/modules/essay-marking/components/WorkbenchHeader';

/**
 * Batch AI Marking button lives in the WorkbenchHeader (shown only while
 * showMarkingTools is true — EssayMarkingPage sets that on currentStep==='grade',
 * i.e. Step 5 Review Marking). These tests verify the button rendering rules;
 * the wiring `showMarkingTools={currentStep === 'grade'}` +
 * `onOpenBatchModal={() => setIsBatchModalOpen(true)}` is one-line prop passing
 * verified in EssayMarkingPage.tsx (lines 1380/1384).
 */
describe('WorkbenchHeader - Batch AI Marking button (Step 5 Review Marking)', () => {
  const baseProps = {
    title: 'P.4 Wr1',
    stepTitle: 'Marking & Teacher Review',
    stepDescription: 'Review suggestions.',
    onOpenStatusModal: vi.fn(),
    onOpenHelpModal: vi.fn(),
    onResetSession: vi.fn(),
  };

  it('shows a visible, enabled Batch AI Marking button in Review Marking step', () => {
    const onOpenBatchModal = vi.fn();
    render(
      <WorkbenchHeader
        {...baseProps}
        showMarkingTools={true}
        onOpenBatchModal={onOpenBatchModal}
        isBatchRunning={false}
      />
    );

    const btn = screen.getByRole('button', { name: /Batch AI Marking/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    expect(onOpenBatchModal).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the button outside Review Marking (showMarkingTools=false)', () => {
    render(<WorkbenchHeader {...baseProps} showMarkingTools={false} onOpenBatchModal={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Batch AI Marking/i })).toBeNull();
  });

  it('disables the button while a batch is running (prevents simultaneous runs)', () => {
    const onOpenBatchModal = vi.fn();
    render(
      <WorkbenchHeader
        {...baseProps}
        showMarkingTools={true}
        onOpenBatchModal={onOpenBatchModal}
        isBatchRunning={true}
      />
    );

    const btn = screen.getByRole('button', { name: /Batch AI Marking/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onOpenBatchModal).not.toHaveBeenCalled();
  });
});
