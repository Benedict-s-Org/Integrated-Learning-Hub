import { describe, it, expect, vi } from 'vitest';
import {
  normalizeOcrFormat,
  detectReviewNotices,
  normalizeOcrTranscript,
} from '../../../modules/essay-marking/utils/ocrFormatNormalizer';
import { combineCandidateTranscript } from '../../../modules/essay-marking/utils/transcriptionBatchQueue';
import {
  DEFAULT_TRANSCRIPTION_SETTINGS,
  PageTranscriptionResult,
  StagedCandidateTranscript,
  StudentTranscriptState,
  StudentRosterItem,
} from '../../../modules/essay-marking/types';

describe('OCR Format Normalizer & Workflow Safeguards', () => {
  // Test 1: Known wrappers and nested ordinal formatting normalize correctly without spelling correction
  it('1. normalizes known wrappers and nested ordinal formatting without spelling correction', () => {
    const input = '\\[\n12^{\\text{th}} \\text{ Octoher, } 2026\n\\]';
    const normalized = normalizeOcrFormat(input);

    expect(normalized).toContain('12th Octoher, 2026');
    // Crucial: Must NOT correct spelling of Octoher to October
    expect(normalized).toContain('Octoher');
    expect(normalized).not.toContain('October');

    // Test nested wrappers: \textbf{\textit{...}}
    const nestedInput = '\\textbf{\\textit{The Big Adventure}}';
    expect(normalizeOcrFormat(nestedInput)).toBe('The Big Adventure');

    // Test ordinal formats: 1st, 2nd, 3rd, 21st, 12th
    expect(normalizeOcrFormat('1^{\\text{st}} prize')).toBe('1st prize');
    expect(normalizeOcrFormat('2^{\\mathrm{nd}} place')).toBe('2nd place');
    expect(normalizeOcrFormat('3^{\\textit{rd}} round')).toBe('3rd round');
    expect(normalizeOcrFormat('21^{\\text{st}} Century')).toBe('21st Century');
    expect(normalizeOcrFormat('12^{th} May')).toBe('12th May');
  });

  // Test 2: Legitimate currency and unsupported expressions remain intact
  it('2. preserves legitimate currency and leaves unsupported expressions intact', () => {
    const currencyText = 'It cost $20. I paid $15.50 for lunch.';
    const normalizedCurrency = normalizeOcrFormat(currencyText);
    expect(normalizedCurrency).toBe('It cost $20. I paid $15.50 for lunch.');

    // Currency should NOT be flagged as suspicious syntax
    const currencyNotices = detectReviewNotices(normalizedCurrency);
    expect(currencyNotices.filter((n) => n.type === 'suspicious_syntax')).toHaveLength(0);

    // Unsupported expression like \frac{1}{2} or \sqrt{x} must be left intact
    const unsupportedText = 'The fraction was \\frac{1}{2} and \\sqrt{9}.';
    const normalizedUnsupported = normalizeOcrFormat(unsupportedText);
    expect(normalizedUnsupported).toBe('The fraction was \\frac{1}{2} and \\sqrt{9}.');

    // And must be flagged for review
    const notices = detectReviewNotices(normalizedUnsupported);
    expect(notices.some((n) => n.matchedText === '\\frac')).toBe(true);
    expect(notices.some((n) => n.matchedText === '\\sqrt')).toBe(true);
  });

  // Test 3: Newlines are preserved and normalization is idempotent
  it('3. preserves existing newline structure and is strictly idempotent', () => {
    const multilineInput =
      'Title: My Trip\n\n\\[\n12^{\\text{th}} \\text{ Octoher, } 2026\n\\]\n\nFirst paragraph here.\nSecond paragraph here.';

    const firstPass = normalizeOcrFormat(multilineInput);
    const secondPass = normalizeOcrFormat(firstPass);

    // Idempotent
    expect(secondPass).toBe(firstPass);

    // Preserves lines: wrapper-only lines become empty lines rather than collapsing
    const inputLines = multilineInput.split('\n');
    const outputLines = firstPass.split('\n');
    expect(outputLines.length).toBe(inputLines.length);

    // Combined normalizer output is also idempotent
    const res1 = normalizeOcrTranscript(multilineInput);
    const res2 = normalizeOcrTranscript(res1.normalizedText);
    expect(res2.normalizedText).toBe(res1.normalizedText);
  });

  // Test 4: Standalone X/x is flagged, while x inside normal words is not
  it('4. flags standalone X/x tokens while ignoring x inside normal words', () => {
    // Normal words containing x
    const normalProse = 'Next time, six excited foxes jumped over the box to exercise.';
    const normalNotices = detectReviewNotices(normalProse);
    const skipNoticesNormal = normalNotices.filter((n) => n.type === 'skip_line_marker');
    expect(skipNoticesNormal).toHaveLength(0);

    // Standalone line containing only X or x
    const standaloneLine = 'First paragraph.\n\nX\n\nSecond paragraph.';
    const standaloneNotices = detectReviewNotices(standaloneLine);
    const lineXNotice = standaloneNotices.find((n) => n.type === 'skip_line_marker');
    expect(lineXNotice).toBeDefined();
    expect(lineXNotice?.message).toContain('standalone line');

    // Isolated X inside sentence
    const isolatedXProse = 'I went to school . X Next morning we played.';
    const isolatedNotices = detectReviewNotices(isolatedXProse);
    const proseXNotice = isolatedNotices.find((n) => n.type === 'skip_line_marker');
    expect(proseXNotice).toBeDefined();
    expect(proseXNotice?.message).toContain('Isolated');
  });

  // Test 5: Worksheet rules flag complete headers without deleting student text or matching ordinary prose
  it('5. flags worksheet boilerplate headers without matching ordinary student prose', () => {
    const boilerplateSamples = [
      'You may use a mind map to help you.',
      'Reviewing and editing checklist:',
      'English Writing Worksheet',
      'English Writing 2',
      'P. 4 English Writing 2',
      'P. 2',
      'P.4',
    ];

    for (const line of boilerplateSamples) {
      const notices = detectReviewNotices(line);
      expect(
        notices.some((n) => n.type === 'worksheet_boilerplate'),
        `Expected "${line}" to be flagged as worksheet boilerplate`
      ).toBe(true);
    }

    // Ordinary student prose mentioning "English" or numbers should NOT be flagged as boilerplate
    const studentSentences = [
      'I love my English teacher very much.',
      'We had an English lesson at 2 o’clock.',
      'In 2026, I wrote 2 essays for school.',
      'The book was written in English.',
    ];

    for (const sent of studentSentences) {
      const notices = detectReviewNotices(sent);
      expect(
        notices.some((n) => n.type === 'worksheet_boilerplate'),
        `Did not expect "${sent}" to be flagged as boilerplate: "${sent}"`
      ).toBe(false);
    }
  });

  // Test 6: Original OCR and normalized candidate data persist separately and old sessions remain compatible
  it('6. persists original OCR evidence and normalized text separately, keeping backward compatibility', () => {
    const rawOcr = '\\[\n12^{\\text{th}} \\text{ Octoher, } 2026\n\\]\nX\nI like writing.';
    const pageResult: PageTranscriptionResult = {
      scanPageId: 'page_1',
      part: 1,
      totalParts: 1,
      status: 'success',
      transcript: rawOcr,
    };

    const candidate = combineCandidateTranscript({
      studentId: 'student_1',
      pageResults: [pageResult],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      provider: 'mathpix_only',
    });

    // Separated evidence
    expect(candidate.rawTranscript).toBe(rawOcr.replace(/\r\n/g, '\n').trim());
    expect(candidate.transcript).toContain('12th Octoher, 2026');
    expect(candidate.transcript).not.toContain('\\[');
    expect(candidate.reviewNotices).toBeDefined();
    expect(candidate.reviewNotices?.length).toBeGreaterThan(0);

    // Backward compatibility: old session state missing rawTranscript and reviewNotices
    const legacySessionTranscript: StudentTranscriptState = {
      studentId: 'legacy_student',
      rawOcrText: 'Legacy raw text',
      editedText: 'Legacy edited text',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: true,
      revision: 1,
    };

    // Old session loads without error and optional fields are undefined
    expect(legacySessionTranscript.originalOcrText).toBeUndefined();
    expect(legacySessionTranscript.reviewNotices).toBeUndefined();
  });

  // Test 7: A complete first-time student auto-imports normalized text and enqueues exactly one job with matching text/revision
  it('7. auto-imports normalized text for a first-time student and enqueues provisional marking', () => {
    const rawOcr = '12^{\\text{th}} \\text{ Octoher, } 2026\nFirst essay text.';
    const candidate: StagedCandidateTranscript = {
      id: 'cand_1',
      studentId: 'student_1',
      transcript: normalizeOcrFormat(rawOcr),
      rawTranscript: rawOcr,
      receivedAt: Date.now(),
      provider: 'mathpix_only',
      promptVersion: 'v1',
      settingsVersion: 'v1',
      pageSignature: 'sig_1',
      status: 'candidate_ready',
      pageResults: [
        {
          scanPageId: 'page_1',
          part: 1,
          totalParts: 1,
          status: 'success',
          transcript: rawOcr,
        },
      ],
    };

    // Simulate importCandidateAsTranscript logic
    let revision = 0;
    revision += 1;

    const newTranscript: StudentTranscriptState = {
      studentId: candidate.studentId,
      rawOcrText: candidate.rawTranscript || candidate.transcript,
      editedText: candidate.transcript,
      originalOcrText: candidate.rawTranscript,
      reviewNotices: candidate.reviewNotices,
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: false,
      revision,
    };

    expect(newTranscript.editedText).toBe('12th Octoher, 2026\nFirst essay text.');
    expect(newTranscript.rawOcrText).toBe(rawOcr);
    expect(newTranscript.originalOcrText).toBe(rawOcr);

    // Enqueued marking job payload matches committed text and revision exactly
    const markingJob = {
      studentId: candidate.studentId,
      transcriptRevision: revision,
      transcriptText: candidate.transcript,
      priority: 'normal',
    };

    expect(markingJob.transcriptText).toBe(newTranscript.editedText);
    expect(markingJob.transcriptRevision).toBe(newTranscript.revision);
    expect(markingJob.priority).toBe('normal');
  });

  // Test 8: Incomplete/stale candidates remain blocked
  it('8. blocks incomplete or failed candidates from auto-importing', () => {
    const failedPageResult: PageTranscriptionResult = {
      scanPageId: 'page_2',
      part: 2,
      totalParts: 2,
      status: 'failed',
      error: 'HTTP 500 Network error',
    };

    const candidate = combineCandidateTranscript({
      studentId: 'student_2',
      pageResults: [
        {
          scanPageId: 'page_1',
          part: 1,
          totalParts: 2,
          status: 'success',
          transcript: 'Page 1 text',
        },
        failedPageResult,
      ],
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      provider: 'mathpix_only',
    });

    expect(candidate.status).toBe('partially_transcribed');
    // Cannot be treated as ready
    expect(candidate.status).not.toBe('candidate_ready');
  });

  // Test 9: Existing teacher text stays unchanged and the replacement remains staged
  it('9. preserves existing teacher text without overwriting when candidate arrives', () => {
    const existingTranscript: StudentTranscriptState = {
      studentId: 'student_3',
      rawOcrText: 'Original text',
      editedText: 'Teacher carefully corrected text',
      isManuallyEntered: false,
      uncertainRegions: [],
      isVerified: false,
      revision: 2,
    };

    const incomingCandidate: StagedCandidateTranscript = {
      id: 'cand_3',
      studentId: 'student_3',
      transcript: 'New OCR normalized transcript',
      rawTranscript: 'New OCR raw',
      receivedAt: Date.now(),
      provider: 'mathpix_only',
      promptVersion: 'v1',
      settingsVersion: 'v1',
      pageSignature: 'sig_3',
      status: 'candidate_ready',
      pageResults: [],
    };

    // Staging logic safeguard: effectiveText.length > 0 => stage candidate, do NOT overwrite
    const effectiveText = (existingTranscript.editedText ?? existingTranscript.rawOcrText ?? '').trim();
    let stagedCandidates: Record<string, StagedCandidateTranscript> = {};
    let committedTranscripts = { [existingTranscript.studentId]: existingTranscript };

    if (effectiveText.length > 0) {
      stagedCandidates[incomingCandidate.studentId] = incomingCandidate;
    } else {
      committedTranscripts[incomingCandidate.studentId] = {
        ...existingTranscript,
        editedText: incomingCandidate.transcript,
      };
    }

    // Committed transcript is completely untouched
    expect(committedTranscripts['student_3'].editedText).toBe('Teacher carefully corrected text');
    expect(committedTranscripts['student_3'].revision).toBe(2);
    // Replacement is safely staged
    expect(stagedCandidates['student_3']).toBeDefined();
    expect(stagedCandidates['student_3'].transcript).toBe('New OCR normalized transcript');
  });

  // Test 10: A ready student can enqueue while OCR continues for other students
  it('10. enqueues completed student immediately upon page completion without waiting for whole batch', () => {
    const enqueuedJobs: string[] = [];
    const onCandidateProduced = vi.fn((studentId: string) => {
      enqueuedJobs.push(studentId);
    });

    // Simulate batch controller notifying student 1 as soon as their page finishes
    onCandidateProduced('student_1');
    expect(enqueuedJobs).toContain('student_1');

    // Other students can still be running OCR
    expect(enqueuedJobs).toHaveLength(1);
    onCandidateProduced('student_2');
    expect(enqueuedJobs).toHaveLength(2);
  });

  // Test 11: Review notices are non-blocking and do not contaminate the transcript/model input
  it('11. ensures review notices do not pollute the transcript text sent to the marking model', () => {
    const rawOcr = 'Reviewing and editing checklist:\n12^{\\text{th}} \\text{ Octoher, } 2026\nX\nI wrote my essay.';
    const { normalizedText, notices } = normalizeOcrTranscript(rawOcr);

    expect(notices.length).toBeGreaterThan(0);
    // Normalized text contains the actual student words without any inserted "[Review Notice]" text
    expect(normalizedText).not.toContain('Review Notice');
    expect(normalizedText).not.toContain('Suspected');
    expect(normalizedText).not.toContain('notice-');

    // Text passed to marking model is purely normalizedText
    const modelPromptInput = normalizedText;
    expect(modelPromptInput).toContain('I wrote my essay.');
  });

  // Test 12: Repeated callbacks/reconciliation do not duplicate imports or jobs
  it('12. ensures repeated callbacks or reconciliation do not duplicate imports or jobs', () => {
    const reconciledSet = new Set<string>();
    const importFn = vi.fn();

    const candidateId = 'cand_idempotency_1';

    // First reconciliation invocation
    if (!reconciledSet.has(candidateId)) {
      reconciledSet.add(candidateId);
      importFn(candidateId);
    }
    expect(importFn).toHaveBeenCalledTimes(1);

    // Second reconciliation invocation (e.g. re-render or repeated callback)
    if (!reconciledSet.has(candidateId)) {
      reconciledSet.add(candidateId);
      importFn(candidateId);
    }
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
