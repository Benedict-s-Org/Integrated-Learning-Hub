import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  StudentRosterItem,
  ScanPage,
  AppliedMatching,
  StudentTranscriptState,
  AssignmentConfig,
  AssignmentTranscriptionSettings,
  TranscriptionProvider,
  StagedCandidateTranscript,
  normalizeTranscriptionSettings,
  PageTranscriptionResult,
  LineWithBbox,
} from '../types';
import { essayServices } from '../services/essayServiceRegistry';
import { prepareOcrImageFromRegions, prepareOcrRegionsInReadingOrder } from '../utils/regionAwareOcr';
import {
  BatchQueueProgress,
  BatchTranscriptionQueueController,
  buildBatchTasks,
  combineCandidateTranscript,
  computeStudentPageSignature,
  resolveWritingAreasForPage,
} from '../utils/transcriptionBatchQueue';

export type ConfirmDialogType =
  | { type: 'pre_flight_transcribe'; targetStudentId: string }
  | { type: 'apply_candidate_overwrite'; targetStudentId: string; candidateText: string; linesWithBboxes?: LineWithBbox[] }
  | { type: 'qwen_unavailable_choice'; targetStudentId: string }
  | null;

export interface UseEssayTranscriptionOptions {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching | null;
  activeStudentIndex: number;
  transcripts: Record<string, StudentTranscriptState>;
  assignment: AssignmentConfig;
  onUpdateTranscriptText: (studentId: string, text: string, linesWithBboxes?: LineWithBbox[]) => void;
  onVerifyTranscript?: (studentId: string) => void;
  onUpdateAssignmentSettings?: (settings: AssignmentTranscriptionSettings) => void;
  stagedCandidates: Record<string, StagedCandidateTranscript>;
  onSetStagedCandidates: React.Dispatch<React.SetStateAction<Record<string, StagedCandidateTranscript>>>;
  onCandidateProduced?: (studentId: string, candidate: StagedCandidateTranscript) => void;
  onApplyCandidateTranscript?: (studentId: string, candidate: StagedCandidateTranscript) => void;
}

export function useEssayTranscription({
  students,
  pages,
  appliedMatching,
  activeStudentIndex,
  transcripts,
  assignment,
  onUpdateTranscriptText,
  onVerifyTranscript,
  onUpdateAssignmentSettings,
  stagedCandidates,
  onSetStagedCandidates,
  onCandidateProduced,
  onApplyCandidateTranscript,
}: UseEssayTranscriptionOptions) {
  // In-flight guard to prevent duplicate concurrent submissions
  const [isTranscribingSingle, setIsTranscribingSingle] = useState(false);
  const inFlightRef = useRef(false);
  const transcriptsRef = useRef(transcripts);
  transcriptsRef.current = transcripts;

  const handleCandidateOutcome = (targetStudentId: string, candidate: StagedCandidateTranscript) => {
    if (onCandidateProduced) {
      onCandidateProduced(targetStudentId, candidate);
    } else {
      onSetStagedCandidates((prev) => ({
        ...prev,
        [targetStudentId]: candidate,
      }));
    }
  };

  // Status feedback notice
  const [notice, setNotice] = useState<{
    type: 'info' | 'error' | 'success' | 'warning';
    text: string;
  } | null>(null);

  // OCR Mode: Default to Mathpix OCR Only
  const [selectedProvider, setSelectedProvider] = useState<TranscriptionProvider>('mathpix_only');

  // Page level running state
  const [pageStage, setPageStage] = useState<
    'ready' | 'ocr_running' | 'vl_running' | 'completed' | 'failed' | 'verification_pending'
  >('ready');

  // Per-page individual retry loading tracker
  const [perPageLoading, setPerPageLoading] = useState<Record<string, boolean>>({});

  // Retrying Qwen verification state
  const [isRetryingQwen, setIsRetryingQwen] = useState<boolean>(false);

  // Batch transcription queue states
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchQueueProgress | null>(null);
  const batchControllerRef = useRef<BatchTranscriptionQueueController | null>(null);

  // Service health and safety states
  const [isDryRun, setIsDryRun] = useState<boolean>(true);
  const [isMathpixConfigured, setIsMathpixConfigured] = useState<boolean>(true);
  const [qwenStatus, setQwenStatus] = useState<'available' | 'error' | 'checking' | null>(null);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);

  // Assignment Transcription Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const templateRegions = useMemo(
    () => (Array.isArray(assignment?.templateRegions) ? assignment.templateRegions : []),
    [assignment?.templateRegions]
  );
  const currentSettings = useMemo(
    () => normalizeTranscriptionSettings(assignment?.transcriptionSettings),
    [assignment?.transcriptionSettings]
  );
  const writingAreas = useMemo(
    () => templateRegions.filter((r) => r && r.type === 'writing_area'),
    [templateRegions]
  );
  const hasWritingAreas = assignment?.responseFormat === 'worksheet' ? writingAreas.length > 0 : true;

  // Active student info
  const activeStudent = students[activeStudentIndex];
  const activeStudentId = activeStudent?.id || '';
  const currentTranscript = transcripts[activeStudentId] || {
    studentId: activeStudentId,
    rawOcrText: null,
    editedText: '',
    isManuallyEntered: false,
    uncertainRegions: [],
    isVerified: false,
  };

  // Derive scan pages for active student
  const studentPagesWithIndices = useMemo(() => {
    if (!appliedMatching || !appliedMatching.map) return [];
    const result: { page: ScanPage; part: number; total: number; pageIndex: number }[] = [];
    appliedMatching.map.forEach((item, pageIndex) => {
      if (item && item.studentIndex === activeStudentIndex && pages[pageIndex]) {
        result.push({
          page: pages[pageIndex],
          part: (item as any).partIndex || (item as any).part || result.length + 1,
          total: (item as any).totalParts || (item as any).total || 1,
          pageIndex,
        });
      }
    });
    return result;
  }, [appliedMatching, activeStudentIndex, pages]);

  // Current student page signature
  const currentStudentSignature = useMemo(() => {
    return computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
  }, [activeStudentIndex, appliedMatching, pages]);

  const activeCandidate = stagedCandidates[activeStudentId] || null;
  const isCandidateStale = activeCandidate
    ? activeCandidate.pageSignature !== currentStudentSignature
    : false;
  const activeCandidateStaleReason =
    activeCandidate && isCandidateStale
      ? 'Scan page assignments changed since this transcription was generated. Please run transcription again before applying.'
      : undefined;

  // Calculate pending count (unverified, empty editor text)
  const pendingOcrCount = useMemo(() => {
    if (!appliedMatching || !appliedMatching.assignedStudentIndices) return 0;
    let count = 0;
    appliedMatching.assignedStudentIndices.forEach((sIdx) => {
      const student = students[sIdx];
      if (!student) return;
      const t = transcripts[student.id];
      if (!t?.isVerified && !t?.editedText?.trim()) {
        count++;
      }
    });
    return count;
  }, [appliedMatching, students, transcripts]);

  // Query service availability for Mathpix (DRY_RUN status) and Qwen VL (port 18088)
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await essayServices.getAvailabilityService().checkStatus();
        if (!isMounted) return;
        setIsDryRun(res.ocr?.status === 'dry_run_ready');
        setIsMathpixConfigured(res.ocr?.status !== 'not_configured');
        setQwenStatus(res.visualVerification?.status === 'available' ? 'available' : 'error');
      } catch {
        if (!isMounted) return;
        setQwenStatus('error');
      }
    };
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-flight check before initiating single student transcription
  const handleInitiateSingleEssayTranscribe = async (
    targetStudentId?: string,
    forcedMode?: TranscriptionProvider
  ) => {
    const studentIdToUse = targetStudentId || activeStudentId;
    if (!studentIdToUse) return;
    if (inFlightRef.current || isTranscribingSingle || isBatchRunning) return;

    if (studentPagesWithIndices.length === 0) {
      setNotice({
        type: 'error',
        text: 'No scan page assigned to this student to transcribe.',
      });
      return;
    }

    if (!hasWritingAreas && assignment?.responseFormat === 'worksheet') {
      setNotice({
        type: 'error',
        text: 'Missing required writing areas: No writing areas have been defined on the worksheet template. Please configure writing areas in Preparation before transcribing.',
      });
      return;
    }

    const modeToUse = forcedMode || selectedProvider;

    // In combined mode, check Qwen availability before starting Mathpix
    if (modeToUse === 'mathpix_qwen_verify') {
      try {
        const status = await essayServices.getAvailabilityService().checkStatus();
        const isQwenOnline = status.visualVerification?.status === 'available';
        setQwenStatus(isQwenOnline ? 'available' : 'error');

        if (!isQwenOnline) {
          setConfirmDialog({
            type: 'qwen_unavailable_choice',
            targetStudentId: studentIdToUse,
          });
          return;
        }
      } catch {
        setConfirmDialog({
          type: 'qwen_unavailable_choice',
          targetStudentId: studentIdToUse,
        });
        return;
      }
    }

    // If teacher already has verified text or draft, prompt confirmation
    const targetTranscript = transcripts[studentIdToUse];
    if (targetTranscript?.isVerified || (targetTranscript?.editedText && targetTranscript.editedText.trim().length > 0)) {
      setConfirmDialog({
        type: 'pre_flight_transcribe',
        targetStudentId: studentIdToUse,
      });
      return;
    }

    executeSingleEssayTranscription(studentIdToUse, modeToUse);
  };

  // Executes transcription for single student (all assigned pages)
  const executeSingleEssayTranscription = async (
    targetStudentId: string,
    modeToRun?: TranscriptionProvider
  ) => {
    if (inFlightRef.current || isBatchRunning) return;
    inFlightRef.current = true;
    setIsTranscribingSingle(true);
    setNotice(null);

    const activeMode = modeToRun || selectedProvider;
    const initialSignature = computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
    const ocrService = essayServices.getOcrService();
    const transcriptionService = essayServices.getTranscriptionService();
    const pageResults: PageTranscriptionResult[] = [];

    setPageStage('ocr_running');

    try {
      for (const item of studentPagesWithIndices) {
        // Skip OCR for confirmed blank pages
        if (item.page.isBlank) {
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'success',
            transcript: '',
            isBlank: true,
            ocrMode: activeMode,
          });
          continue;
        }

        // Mode A & B: Run Mathpix OCR via Bridge (port 18089)
        setPageStage('ocr_running');

        const singleAreaResolution = resolveWritingAreasForPage(item.page, item.part, templateRegions);
        if (singleAreaResolution.hasError) {
          setPageStage('failed');
          setNotice({
            type: 'error',
            text: `Page ${item.part}: ${singleAreaResolution.errorMessage || 'Invalid OCR region'}`,
          });
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'failed',
            error: singleAreaResolution.errorMessage || 'Invalid OCR region',
            errorCode: 'INVALID_OCR_REGION',
            ocrMode: activeMode,
          });
          continue;
        }

        // Multi-region continuation page support
        if (singleAreaResolution.regions.length > 1) {
          const regionCrops = await prepareOcrRegionsInReadingOrder(
            item.page.previewUrl,
            singleAreaResolution.regions
          );
          const regionTexts: string[] = [];
          let hasFail = false;
          let firstError = '';
          for (let rIdx = 0; rIdx < regionCrops.length; rIdx++) {
            const crop = regionCrops[rIdx];
            if (crop.error) {
              hasFail = true;
              firstError = crop.error;
              break;
            }
            setNotice({
              type: 'info',
              text: `Contacting Mathpix OCR (Port 18089) for region ${rIdx + 1} of ${regionCrops.length} on Page ${item.part}...`,
            });
            const ocrRes = await ocrService.recognize({
              imageUrls: [crop.imageUrl],
              studentId: targetStudentId,
              assignmentId: assignment.id,
            });
            if (ocrRes.status !== 'success') {
              hasFail = true;
              firstError = ocrRes.message || 'OCR failed';
              break;
            }
            regionTexts.push(ocrRes.transcript.trim());
          }

          if (hasFail) {
            setPageStage('failed');
            setNotice({ type: 'error', text: `Page ${item.part}: ${firstError}` });
            pageResults.push({
              scanPageId: item.page.id,
              part: item.part,
              totalParts: item.total,
              status: 'failed',
              error: firstError,
              ocrMode: activeMode,
            });
            continue;
          }

          const combinedMultiRegionText = regionTexts.join('\n\n');
          const multiLines = combinedMultiRegionText.split('\n').map((l) => ({
            text: l,
            bbox: null,
            scanPageId: item.page.id,
            pageNumber: item.part,
          }));

          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'success',
            transcript: combinedMultiRegionText,
            mathpixRawTranscript: combinedMultiRegionText,
            linesWithBboxes: multiLines,
            ocrMode: activeMode,
            ocrRegionImageUrl: regionCrops[0]?.imageUrl,
            isRegionCrop: true,
          });
          continue;
        }

        const prepared = await prepareOcrImageFromRegions(
          item.page.previewUrl,
          singleAreaResolution.regions
        );

        if (prepared.error) {
          setPageStage('failed');
          setNotice({
            type: 'error',
            text: `Page ${item.part}: ${prepared.error}`,
          });
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'failed',
            error: prepared.error,
            errorCode: 'INVALID_OCR_REGION',
            ocrMode: activeMode,
          });
          continue;
        }

        setNotice({
          type: 'info',
          text: prepared.isRegionCrop
            ? `Contacting Mathpix OCR (Port 18089) for the selected region of Page ${item.part} of ${item.total}...`
            : `Contacting Mathpix OCR (Port 18089) for Page ${item.part} of ${item.total}...`,
        });

        const ocrRes = await ocrService.recognize({
          imageUrls: [prepared.imageUrl],
          studentId: targetStudentId,
          assignmentId: assignment.id,
        });

        if (ocrRes.status === 'dry_run_ready') {
          setPageStage('failed');
          setNotice({
            type: 'warning',
            text: 'Mathpix DRY_RUN Active: Live billing requests are blocked by the safety gate on port 18089. Credentials and image payload validated.',
          });
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'failed',
            error: ocrRes.message,
            errorCode: ocrRes.code || 'DRY_RUN_ACTIVE',
            ocrMode: activeMode,
            isDryRun: true,
          });
          continue;
        }

        if (ocrRes.status !== 'success') {
          setPageStage('failed');
          setNotice({
            type: 'error',
            text: `Page ${item.part}: ${ocrRes.message || 'Mathpix OCR recognition error'}`,
          });
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'failed',
            error: ocrRes.message,
            errorCode: ocrRes.code,
            httpStatus: ocrRes.httpStatus,
            isRetryable: ocrRes.isRetryable,
            ocrMode: activeMode,
          });
          continue;
        }

        const mathpixText = ocrRes.transcript.trim();
        const mathpixLinesWithBboxes = ocrRes.linesWithBboxes || [];

        // In Mode A (Mathpix OCR Only): Finish successfully here
        if (activeMode === 'mathpix_only') {
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'success',
            transcript: mathpixText,
            mathpixRawTranscript: mathpixText,
            linesWithBboxes: mathpixLinesWithBboxes,
            ocrMode: 'mathpix_only',
            ocrRegionImageUrl: prepared.imageUrl,
            isRegionCrop: prepared.isRegionCrop,
          });
          continue;
        }

        // Mode B (Mathpix OCR + Qwen VL Verify)
        setPageStage('vl_running');
        setNotice({
          type: 'info',
          text: `Contacting Qwen VL (Port 18088) to verify handwriting accuracy for Page ${item.part} of ${item.total}...`,
        });

        let qwenRes: any = null;
        if (transcriptionService.verifyTranscription) {
          try {
            qwenRes = await transcriptionService.verifyTranscription({
              scanPageId: item.page.id,
              studentId: targetStudentId,
              pageNumber: item.part,
              imageDataUri: prepared.imageUrl,
              mathpixTranscript: mathpixText,
              settings: currentSettings,
            });
          } catch (qwenErr: any) {
            qwenRes = {
              status: 'error',
              message: qwenErr?.message || 'Qwen verification request failed',
            };
          }
        }

        if (qwenRes && qwenRes.status === 'success' && qwenRes.verifiedTranscript) {
          const verifiedText = qwenRes.verifiedTranscript.trim();
          const verifiedLines = verifiedText.replace(/\r\n/g, '\n').split('\n').map((l: string) => ({
            text: l,
            bbox: null,
            scanPageId: item.page.id,
            pageNumber: item.part,
          }));

          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'success',
            transcript: verifiedText,
            mathpixRawTranscript: mathpixText,
            qwenVerifiedTranscript: verifiedText,
            qwenVerificationStatus: 'success',
            qwenChanges: qwenRes.changes || [],
            unreadableWords: qwenRes.unreadableWords || [],
            linesWithBboxes: verifiedLines,
            ocrMode: 'mathpix_qwen_verify',
            ocrRegionImageUrl: prepared.imageUrl,
            isRegionCrop: prepared.isRegionCrop,
          });
        } else {
          // Qwen verification failed or incomplete -> RETAIN MATHPIX TRANSCRIPT
          const qwenErrMsg = qwenRes?.message || 'Qwen VL verification incomplete on port 18088';
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'success',
            transcript: mathpixText,
            mathpixRawTranscript: mathpixText,
            qwenVerificationStatus: 'failed',
            error: `Qwen VL verification incomplete: ${qwenErrMsg}`,
            linesWithBboxes: mathpixLinesWithBboxes,
            ocrMode: 'mathpix_qwen_verify',
            ocrRegionImageUrl: prepared.imageUrl,
            isRegionCrop: prepared.isRegionCrop,
          });
        }
      }

      // Context Validation: Check if page assignments changed while in flight
      const currentSignature = computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
      if (currentSignature !== initialSignature) {
        setNotice({
          type: 'error',
          text: 'Transcription completed, but page assignments changed while request was in flight. Output marked as stale.',
        });
      }

      const combined = combineCandidateTranscript(
        targetStudentId,
        pageResults,
        currentSettings,
        activeMode,
        initialSignature,
        assignment.id
      );

      const anyQwenIncomplete = pageResults.some((p) => p.qwenVerificationStatus === 'failed');
      const allSuccess = pageResults.every((p) => p.status === 'success');

      if (anyQwenIncomplete) {
        combined.status = 'partially_transcribed';
        combined.qwenVerificationStatus = 'failed';
        setPageStage('verification_pending');
        setNotice({
          type: 'warning',
          text: 'Mathpix OCR succeeded, but Qwen VL verification (port 18088) was incomplete. The Mathpix transcript is displayed. You can retry Qwen verification without re-billing Mathpix.',
        });
      } else if (allSuccess) {
        setPageStage('completed');
        setNotice({
          type: 'success',
          text:
            activeMode === 'mathpix_qwen_verify'
              ? 'Candidate transcript generated and verified with Qwen VL. Ready for teacher review.'
              : 'Mathpix OCR transcript generated. Ready for teacher review.',
        });
      } else {
        setPageStage('failed');
      }

      // Attach Mathpix transcript & Qwen metadata to staged candidate
      const firstResult = pageResults[0];
      if (firstResult) {
        combined.mathpixTranscript = firstResult.mathpixRawTranscript;
        combined.qwenVerifiedTranscript = firstResult.qwenVerifiedTranscript;
        combined.qwenChanges = firstResult.qwenChanges;
        combined.qwenVerificationStatus = firstResult.qwenVerificationStatus;
        combined.ocrMode = activeMode;
        combined.isDryRun = firstResult.isDryRun;
      }

      const candidateWithStale: StagedCandidateTranscript = {
        ...combined,
        isStale: currentSignature !== initialSignature,
        staleReason:
          currentSignature !== initialSignature
            ? 'Scan page assignments changed during transcription.'
            : undefined,
      };
      handleCandidateOutcome(targetStudentId, candidateWithStale);
    } catch (err: unknown) {
      setPageStage('failed');
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Transcription failed.',
      });
    } finally {
      setIsTranscribingSingle(false);
      inFlightRef.current = false;
    }
  };

  // Retries only Qwen verification using already-saved Mathpix output (Zero new calls to Mathpix)
  const executeRetryQwenVerification = async (targetStudentId: string) => {
    if (inFlightRef.current || isTranscribingSingle || isRetryingQwen) return;
    const candidate = stagedCandidates[targetStudentId];
    if (!candidate || !candidate.pageResults || candidate.pageResults.length === 0) return;

    setIsRetryingQwen(true);
    setNotice({
      type: 'info',
      text: 'Retrying Qwen VL verification on port 18088 using existing Mathpix output (No Mathpix charge)...',
    });
    setPageStage('vl_running');

    try {
      const transcriptionService = essayServices.getTranscriptionService();
      const updatedResults: PageTranscriptionResult[] = [];

      for (const pr of candidate.pageResults) {
        const mathpixText = pr.mathpixRawTranscript || pr.transcript || '';
        const pageItem =
          studentPagesWithIndices.find((p) => p.page.id === pr.scanPageId) ||
          studentPagesWithIndices[0];

        if (!pageItem || !transcriptionService.verifyTranscription) {
          updatedResults.push(pr);
          continue;
        }

        const qwenRes = await transcriptionService.verifyTranscription({
          scanPageId: pr.scanPageId,
          studentId: targetStudentId,
          pageNumber: pr.part,
          imageDataUri: pr.ocrRegionImageUrl || pageItem.page.previewUrl,
          mathpixTranscript: mathpixText,
          settings: currentSettings,
        });

        if (qwenRes && qwenRes.status === 'success' && qwenRes.verifiedTranscript) {
          const verifiedText = qwenRes.verifiedTranscript.trim();
          const verifiedLines = verifiedText.replace(/\r\n/g, '\n').split('\n').map((l: string) => ({
            text: l,
            bbox: null,
            scanPageId: pr.scanPageId,
            pageNumber: pr.part,
          }));

          updatedResults.push({
            ...pr,
            status: 'success',
            transcript: verifiedText,
            qwenVerifiedTranscript: verifiedText,
            qwenVerificationStatus: 'success',
            qwenChanges: qwenRes.changes || [],
            unreadableWords: qwenRes.unreadableWords || [],
            linesWithBboxes: verifiedLines,
            ocrMode: 'mathpix_qwen_verify',
          });
        } else {
          updatedResults.push({
            ...pr,
            qwenVerificationStatus: 'failed',
            error: qwenRes?.message || 'Qwen verification retry failed',
          });
        }
      }

      const combined = combineCandidateTranscript(
        targetStudentId,
        updatedResults,
        currentSettings,
        'mathpix_qwen_verify',
        candidate.pageSignature || currentStudentSignature,
        assignment.id
      );

      const anyFailed = updatedResults.some((p) => p.qwenVerificationStatus === 'failed');
      if (anyFailed) {
        combined.status = 'partially_transcribed';
        combined.qwenVerificationStatus = 'failed';
        setPageStage('verification_pending');
        setNotice({
          type: 'warning',
          text: 'Qwen VL verification retry was incomplete. Mathpix transcript is retained.',
        });
      } else {
        combined.status = 'candidate_ready';
        combined.qwenVerificationStatus = 'success';
        setPageStage('completed');
        setNotice({
          type: 'success',
          text: 'Qwen VL verification completed successfully! Candidate updated with verified text.',
        });
      }

      const firstRes = updatedResults[0];
      if (firstRes) {
        combined.mathpixTranscript = firstRes.mathpixRawTranscript;
        combined.qwenVerifiedTranscript = firstRes.qwenVerifiedTranscript;
        combined.qwenChanges = firstRes.qwenChanges;
        combined.ocrMode = 'mathpix_qwen_verify';
      }

      onSetStagedCandidates((prev) => ({
        ...prev,
        [targetStudentId]: combined,
      }));
    } catch (err: unknown) {
      setPageStage('verification_pending');
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Qwen verification retry failed.',
      });
    } finally {
      setIsRetryingQwen(false);
    }
  };

  // Retries a single page for the active student
  const executeRetrySinglePage = async (
    targetStudentId: string,
    pageItem: { page: ScanPage; part: number; total: number }
  ) => {
    if (inFlightRef.current || isBatchRunning) return;

    inFlightRef.current = true;
    setPerPageLoading((prev) => ({ ...prev, [pageItem.page.id]: true }));
    setNotice(null);

    const activeMode = selectedProvider;
    const ocrService = essayServices.getOcrService();
    const transcriptionService = essayServices.getTranscriptionService();

    try {
      let pageRes: PageTranscriptionResult;

      if (pageItem.page.isBlank) {
        pageRes = {
          scanPageId: pageItem.page.id,
          part: pageItem.part,
          totalParts: pageItem.total,
          status: 'success',
          transcript: '',
          isBlank: true,
          ocrMode: activeMode,
        };
      } else {
        const singleAreaResolution = resolveWritingAreasForPage(pageItem.page, pageItem.part, templateRegions);
        if (singleAreaResolution.hasError) {
          throw new Error(singleAreaResolution.errorMessage || 'Invalid OCR region');
        }

        const prepared = await prepareOcrImageFromRegions(
          pageItem.page.previewUrl,
          singleAreaResolution.regions
        );

        if (prepared.error) {
          throw new Error(prepared.error);
        }

        const ocrRes = await ocrService.recognize({
          imageUrls: [prepared.imageUrl],
          studentId: targetStudentId,
          assignmentId: assignment.id,
        });

        if (ocrRes.status !== 'success') {
          throw new Error(ocrRes.message || 'Mathpix OCR error on page retry');
        }

        const rawMathpix = ocrRes.transcript.trim();
        const rawLines = ocrRes.linesWithBboxes || [];

        if (activeMode === 'mathpix_only') {
          pageRes = {
            scanPageId: pageItem.page.id,
            part: pageItem.part,
            totalParts: pageItem.total,
            status: 'success',
            transcript: rawMathpix,
            mathpixRawTranscript: rawMathpix,
            linesWithBboxes: rawLines,
            ocrMode: 'mathpix_only',
            ocrRegionImageUrl: prepared.imageUrl,
            isRegionCrop: prepared.isRegionCrop,
          };
        } else {
          // mathpix_qwen_verify
          let qwenRes: any = null;
          if (transcriptionService.verifyTranscription) {
            try {
              qwenRes = await transcriptionService.verifyTranscription({
                scanPageId: pageItem.page.id,
                studentId: targetStudentId,
                pageNumber: pageItem.part,
                imageDataUri: prepared.imageUrl,
                mathpixTranscript: rawMathpix,
                settings: currentSettings,
              });
            } catch (err: any) {
              qwenRes = { status: 'error', message: err?.message };
            }
          }

          if (qwenRes && qwenRes.status === 'success' && qwenRes.verifiedTranscript) {
            const verified = qwenRes.verifiedTranscript.trim();
            pageRes = {
              scanPageId: pageItem.page.id,
              part: pageItem.part,
              totalParts: pageItem.total,
              status: 'success',
              transcript: verified,
              mathpixRawTranscript: rawMathpix,
              qwenVerifiedTranscript: verified,
              qwenVerificationStatus: 'success',
              qwenChanges: qwenRes.changes || [],
              unreadableWords: qwenRes.unreadableWords || [],
              linesWithBboxes: verified.split('\n').map((l: string) => ({
                text: l,
                bbox: null,
                scanPageId: pageItem.page.id,
                pageNumber: pageItem.part,
              })),
              ocrMode: 'mathpix_qwen_verify',
              ocrRegionImageUrl: prepared.imageUrl,
              isRegionCrop: prepared.isRegionCrop,
            };
          } else {
            pageRes = {
              scanPageId: pageItem.page.id,
              part: pageItem.part,
              totalParts: pageItem.total,
              status: 'success',
              transcript: rawMathpix,
              mathpixRawTranscript: rawMathpix,
              qwenVerificationStatus: 'failed',
              error: qwenRes?.message || 'Qwen verification incomplete',
              linesWithBboxes: rawLines,
              ocrMode: 'mathpix_qwen_verify',
              ocrRegionImageUrl: prepared.imageUrl,
              isRegionCrop: prepared.isRegionCrop,
            };
          }
        }
      }

      // Merge single page result into active candidate
      const existingCandidate = stagedCandidates[targetStudentId];
      const existingPageResults = existingCandidate?.pageResults || [];
      const updatedPageResults = existingPageResults.map((pr) =>
        pr.scanPageId === pageItem.page.id ? pageRes : pr
      );
      if (!existingPageResults.some((pr) => pr.scanPageId === pageItem.page.id)) {
        updatedPageResults.push(pageRes);
      }

      const merged = combineCandidateTranscript(
        targetStudentId,
        updatedPageResults,
        currentSettings,
        activeMode,
        existingCandidate?.pageSignature || currentStudentSignature,
        assignment.id
      );

      handleCandidateOutcome(targetStudentId, merged);

      setNotice({
        type: 'success',
        text: `Page ${pageItem.part} transcribed successfully.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to transcribe Page ${pageItem.part}`,
      });
    } finally {
      setPerPageLoading((prev) => ({ ...prev, [pageItem.page.id]: false }));
      inFlightRef.current = false;
    }
  };

  // Applies candidate transcript to student transcript editor
  const handleRequestApplyCandidate = (targetStudentId: string) => {
    const candidate = stagedCandidates[targetStudentId];
    if (!candidate || !candidate.transcript?.trim()) {
      setNotice({
        type: 'error',
        text: 'Cannot apply empty or failed candidate transcript.',
      });
      return;
    }

    if (candidate.isStale) {
      setNotice({
        type: 'error',
        text: 'Cannot apply stale candidate: Scan page assignments were altered since transcription. Please re-run transcription.',
      });
      return;
    }

    const existing = transcripts[targetStudentId];
    if (existing?.isManuallyEntered && existing?.editedText?.trim()) {
      setConfirmDialog({
        type: 'apply_candidate_overwrite',
        targetStudentId,
        candidateText: candidate.transcript,
        linesWithBboxes: candidate.linesWithBboxes,
      });
      return;
    }

    applyCandidateToEditor(targetStudentId, candidate.transcript, candidate.linesWithBboxes);
  };

  const applyCandidateToEditor = (
    targetStudentId: string,
    transcriptText: string,
    linesWithBboxes?: LineWithBbox[]
  ) => {
    if (!transcriptText?.trim()) {
      setNotice({
        type: 'error',
        text: 'Cannot apply empty or failed transcript text to editor.',
      });
      return;
    }

    const candidate = stagedCandidates[targetStudentId];
    if (onApplyCandidateTranscript && candidate) {
      onApplyCandidateTranscript(targetStudentId, candidate);
    } else {
      onUpdateTranscriptText(targetStudentId, transcriptText, linesWithBboxes);
      // Remove candidate from staged candidates after applying
      onSetStagedCandidates((prev) => {
        const copy = { ...prev };
        delete copy[targetStudentId];
        return copy;
      });
    }

    setNotice({
      type: 'success',
      text: 'Candidate transcript applied to editor. Review student language errors, then click "Confirm & Verify Transcript".',
    });
  };

  const handleDiscardCandidate = (targetStudentId: string) => {
    onSetStagedCandidates((prev) => {
      const copy = { ...prev };
      delete copy[targetStudentId];
      return copy;
    });
    setNotice({
      type: 'info',
      text: 'Staged candidate transcript discarded.',
    });
  };

  // Batch transcription queue handlers
  const handleStartBatchQueue = async () => {
    if (isBatchRunning || inFlightRef.current || !appliedMatching) return;

    if (!hasWritingAreas && assignment?.responseFormat === 'worksheet') {
      setNotice({
        type: 'error',
        text: 'Missing required writing areas: No writing areas have been defined on the worksheet template. Please configure writing areas in Preparation before transcribing.',
      });
      return;
    }

    const { tasks, skippedStudents } = buildBatchTasks({
      students,
      pages,
      appliedMatching,
      transcripts,
      templateRegions,
      skipExisting: true,
    });

    if (tasks.length === 0) {
      setNotice({
        type: 'info',
        text: `No pending unverified essays eligible for batch transcription. (${skippedStudents.length} students skipped as already verified or having drafts).`,
      });
      return;
    }

    setIsBatchRunning(true);
    const controller = new BatchTranscriptionQueueController({
      tasks,
      skippedStudents,
      settings: currentSettings,
      totalEssays: appliedMatching.assignedStudentIndices.length,
      onProgress: (progress) => {
        setBatchProgress(progress);
      },
      onStudentCompleted: (candidate, studentId) => {
        handleCandidateOutcome(studentId, candidate);
      },
    });

    batchControllerRef.current = controller;

    try {
      await controller.run({
        transcriptionService: essayServices.getTranscriptionService(),
        ocrService: essayServices.getOcrService(),
        provider: selectedProvider,
        appliedMatching,
        pages,
        assignmentId: assignment.id,
      });
    } finally {
      setIsBatchRunning(false);
    }
  };

  const handlePauseBatchQueue = () => {
    if (batchControllerRef.current) {
      batchControllerRef.current.requestPause();
    }
  };

  const handleResumeBatchQueue = async () => {
    if (batchControllerRef.current && appliedMatching) {
      setIsBatchRunning(true);
      try {
        batchControllerRef.current.resume();
        await batchControllerRef.current.run({
          transcriptionService: essayServices.getTranscriptionService(),
          ocrService: essayServices.getOcrService(),
          provider: selectedProvider,
          appliedMatching,
          pages,
          assignmentId: assignment.id,
        });
      } finally {
        setIsBatchRunning(false);
      }
    }
  };

  const handleRetryFailedBatchQueue = async () => {
    if (batchControllerRef.current && appliedMatching) {
      setIsBatchRunning(true);
      try {
        batchControllerRef.current.retryFailedTasks();
        await batchControllerRef.current.run({
          transcriptionService: essayServices.getTranscriptionService(),
          ocrService: essayServices.getOcrService(),
          provider: selectedProvider,
          appliedMatching,
          pages,
          assignmentId: assignment.id,
        });
      } finally {
        setIsBatchRunning(false);
      }
    }
  };

  return {
    selectedProvider,
    setSelectedProvider,
    pageStage,
    isTranscribingSingle,
    perPageLoading,
    isRetryingQwen,
    isBatchRunning,
    batchProgress,
    isDryRun,
    isMathpixConfigured,
    qwenStatus,
    notice,
    setNotice,
    confirmDialog,
    setConfirmDialog,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    activeCandidate,
    isCandidateStale,
    activeCandidateStaleReason,
    pendingOcrCount,
    hasWritingAreas,
    studentPagesWithIndices,
    currentSettings,
    handleInitiateSingleEssayTranscribe,
    executeSingleEssayTranscription,
    executeRetryQwenVerification,
    executeRetrySinglePage,
    handleRequestApplyCandidate,
    applyCandidateToEditor,
    handleDiscardCandidate,
    handleStartBatchQueue,
    handlePauseBatchQueue,
    handleResumeBatchQueue,
    handleRetryFailedBatchQueue,
  };
}
