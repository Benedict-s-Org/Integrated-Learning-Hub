import React, { useState, useRef, useMemo } from 'react';
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
import {
  CheckCircle2,
  ZoomIn,
  Info,
  Sparkles,
  Loader2,
  AlertCircle,
  AlertTriangle,
  History,
  RotateCcw,
  X,
} from 'lucide-react';
import { ScanPreviewModal } from './ScanPreviewModal';
import { TranscriptionSettingsModal } from './TranscriptionSettingsModal';
import { TranscriptionToolbar } from './TranscriptionToolbar';
import { StagedCandidateBox } from './StagedCandidateBox';
import { MagnifierLens, MagnifierState } from './MagnifierLens';
import { essayServices } from '../services/essayServiceRegistry';
import { prepareOcrImageFromRegions } from '../utils/regionAwareOcr';
import {
  BatchQueueProgress,
  BatchTranscriptionQueueController,
  buildBatchTasks,
  combineCandidateTranscript,
  computeStudentPageSignature,
  resolveWritingAreasForPage,
} from '../utils/transcriptionBatchQueue';

interface TranscriptVerificationPanelProps {
  students: StudentRosterItem[];
  pages: ScanPage[];
  appliedMatching: AppliedMatching;
  activeStudentIndex: number;
  transcripts: Record<string, StudentTranscriptState>;
  assignment: AssignmentConfig;
  onUpdateAssignmentSettings?: (settings: AssignmentTranscriptionSettings) => void;
  onSelectStudent: (index: number) => void;
  onUpdateTranscriptText: (studentId: string, text: string, linesWithBboxes?: LineWithBbox[]) => void;
  onVerifyTranscript: (studentId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onNavigateToPreparation?: () => void;
}

type ConfirmDialogType =
  | { type: 'pre_flight_transcribe'; targetStudentId: string }
  | { type: 'apply_candidate_overwrite'; targetStudentId: string; candidateText: string }
  | { type: 'qwen_unavailable_choice'; targetStudentId: string }
  | null;

export const TranscriptVerificationPanel: React.FC<TranscriptVerificationPanelProps> = ({
  students,
  pages,
  appliedMatching,
  activeStudentIndex,
  transcripts,
  assignment,
  onUpdateAssignmentSettings,
  onSelectStudent,
  onUpdateTranscriptText,
  onVerifyTranscript,
  onPrev,
  onNext,
  onNavigateToPreparation,
}) => {
  const [selectedScanPagePart, setSelectedScanPagePart] = useState<number>(1);
  const [previewModalPage, setPreviewModalPage] = useState<ScanPage | null>(null);

  // In-flight guard to prevent duplicate concurrent submissions
  const [isTranscribingSingle, setIsTranscribingSingle] = useState(false);
  const inFlightRef = useRef(false);

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

  // Service health and safety states
  const [isDryRun, setIsDryRun] = useState<boolean>(true);
  const [isMathpixConfigured, setIsMathpixConfigured] = useState<boolean>(true);
  const [qwenStatus, setQwenStatus] = useState<'available' | 'error' | 'checking' | null>(null);

  // Retrying Qwen verification state
  const [isRetryingQwen, setIsRetryingQwen] = useState<boolean>(false);

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
  const hasWritingAreas = writingAreas.length > 0;

  // Staged Candidate Transcripts by Student ID (does NOT overwrite teacher editor automatically)
  const [stagedCandidatesByStudent, setStagedCandidatesByStudent] = useState<
    Record<string, StagedCandidateTranscript>
  >({});

  // Batch Queue Progress and Concurrency Lock
  const [batchProgress, setBatchProgress] = useState<BatchQueueProgress | null>(null);
  const batchControllerRef = useRef<BatchTranscriptionQueueController | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Per-page transcription loading state
  const [perPageLoading, setPerPageLoading] = useState<Record<string, boolean>>({});

  // Application-managed recoverable state for prior transcript drafts
  const [previousDraftsByStudent, setPreviousDraftsByStudent] = useState<
    Record<string, string>
  >({});

  // Explicit user-initiated copy feedback state
  const [copiedCandidateId, setCopiedCandidateId] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);

  // Cursor-position scan magnifier state
  const [magnifier, setMagnifier] = useState<MagnifierState>({
    visible: false,
    x: 0,
    y: 0,
    imgSrc: '',
    bgWidth: 0,
    bgHeight: 0,
    bgX: 0,
    bgY: 0,
    zoomLevel: 3.0,
  });

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

  // Find all scan pages assigned to this active student, ordered by part
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
  studentPagesWithIndices.sort((a, b) => a.part - b.part);

  const activePageItem =
    studentPagesWithIndices.find((p) => p.part === selectedScanPagePart) ||
    studentPagesWithIndices[0];

  // Active line highlight synchronization between scan image overlay and transcript lines
  const [highlightedLineIndex, setHighlightedLineIndex] = useState<number | null>(null);

  // Reset magnifier and line highlight when active student or selected scan page part changes
  React.useEffect(() => {
    setMagnifier((prev) => ({ ...prev, visible: false, imgSrc: '' }));
    setHighlightedLineIndex(null);
  }, [activeStudentId, selectedScanPagePart]);

  // Query service availability for Mathpix (DRY_RUN status) and Qwen VL (port 18088)
  React.useEffect(() => {
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

  const activeCandidate = stagedCandidatesByStudent[activeStudentId];
  const currentLinesWithBboxes = useMemo(() => {
    return activeCandidate?.linesWithBboxes || currentTranscript.linesWithBboxes || [];
  }, [activeCandidate?.linesWithBboxes, currentTranscript.linesWithBboxes]);

  const activePageLinesWithIndices = useMemo(() => {
    const list: Array<{ line: LineWithBbox; globalIndex: number }> = [];
    currentLinesWithBboxes.forEach((line, globalIndex) => {
      const matchesPage = line.scanPageId
        ? line.scanPageId === activePageItem?.page.id
        : line.pageNumber
        ? line.pageNumber === activePageItem?.part
        : true;
      if (matchesPage) {
        list.push({ line, globalIndex });
      }
    });
    return list;
  }, [currentLinesWithBboxes, activePageItem?.page.id, activePageItem?.part]);

  // Pointer hover magnification for the active scan image
  const handleScanPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.pointerType === 'touch') return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH || rect.width <= 0 || rect.height <= 0) return;

    // Calculate actual rendered image box inside the <img> element accounting for object-contain letterboxing
    const containerAspect = rect.width / rect.height;
    const imageAspect = naturalW / naturalH;

    let renderedW = rect.width;
    let renderedH = rect.height;
    let letterboxLeft = 0;
    let letterboxTop = 0;

    if (imageAspect > containerAspect) {
      // Letterbox on top & bottom
      renderedH = rect.width / imageAspect;
      letterboxTop = (rect.height - renderedH) / 2;
    } else {
      // Letterbox on left & right
      renderedW = rect.height * imageAspect;
      letterboxLeft = (rect.width - renderedW) / 2;
    }

    // Pointer coordinates relative to the actual rendered image content
    const pointerImgX = e.clientX - rect.left - letterboxLeft;
    const pointerImgY = e.clientY - rect.top - letterboxTop;

    // If pointer is hovering over the letterbox padding area, hide magnifier
    if (pointerImgX < 0 || pointerImgX > renderedW || pointerImgY < 0 || pointerImgY > renderedH) {
      setMagnifier((prev) => ({ ...prev, visible: false }));
      return;
    }

    // Clamp coordinates to image boundaries
    const clampedX = Math.max(0, Math.min(renderedW, pointerImgX));
    const clampedY = Math.max(0, Math.min(renderedH, pointerImgY));

    const zoom = 3.0; // 3× magnification
    const lensWidth = 280;
    const lensHeight = 220;

    // Position floating magnifier beside pointer to avoid obscuring cursor inspection area
    const offset = 24;
    let lensX = e.clientX + offset;
    // Flip to left if exceeding right viewport boundary
    if (lensX + lensWidth > window.innerWidth - 16) {
      lensX = e.clientX - lensWidth - offset;
    }
    // Clamp horizontally within screen
    lensX = Math.max(16, Math.min(lensX, window.innerWidth - lensWidth - 16));

    // Center vertically around pointer, clamped within screen
    let lensY = e.clientY - lensHeight / 2;
    lensY = Math.max(16, Math.min(lensY, window.innerHeight - lensHeight - 16));

    // Calculate background image scale and position
    const bgWidth = renderedW * zoom;
    const bgHeight = renderedH * zoom;

    let bgX = lensWidth / 2 - clampedX * zoom;
    let bgY = lensHeight / 2 - clampedY * zoom;

    // Clamp background offsets so the lens does not expose empty borders past image edges
    const minBgX = lensWidth - bgWidth;
    const maxBgX = 0;
    if (bgWidth > lensWidth) {
      bgX = Math.max(minBgX, Math.min(maxBgX, bgX));
    } else {
      bgX = (lensWidth - bgWidth) / 2;
    }

    const minBgY = lensHeight - bgHeight;
    const maxBgY = 0;
    if (bgHeight > lensHeight) {
      bgY = Math.max(minBgY, Math.min(maxBgY, bgY));
    } else {
      bgY = (lensHeight - bgHeight) / 2;
    }

    setMagnifier({
      visible: true,
      x: lensX,
      y: lensY,
      imgSrc: img.src,
      bgWidth,
      bgHeight,
      bgX,
      bgY,
      zoomLevel: zoom,
    });
  };

  const handleScanPointerLeave = () => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  };

  // Calculate pending count (unverified, empty editor text)
  const pendingCount = useMemo(() => {
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

  // Current student page signature
  const currentStudentSignature = useMemo(() => {
    return computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
  }, [activeStudentIndex, appliedMatching, pages]);

  const isCandidateStale = activeCandidate
    ? activeCandidate.pageSignature !== currentStudentSignature
    : false;

  // Pre-flight check before initiating single student transcription
  const handleInitiateSingleEssayTranscribe = async (
    targetStudentId: string,
    forcedMode?: TranscriptionProvider
  ) => {
    if (inFlightRef.current || isTranscribingSingle || isBatchRunning) return;

    if (studentPagesWithIndices.length === 0) {
      setNotice({
        type: 'error',
        text: 'No scan page assigned to this student to transcribe.',
      });
      return;
    }

    if (!hasWritingAreas && assignment.responseFormat === 'worksheet') {
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
            targetStudentId,
          });
          return;
        }
      } catch {
        setConfirmDialog({
          type: 'qwen_unavailable_choice',
          targetStudentId,
        });
        return;
      }
    }

    // If teacher already has verified text or draft, prompt confirmation
    if (currentTranscript.isVerified || currentTranscript.editedText.trim().length > 0) {
      setConfirmDialog({
        type: 'pre_flight_transcribe',
        targetStudentId,
      });
      return;
    }

    executeSingleEssayTranscription(targetStudentId, modeToUse);
  };

  // Executes serial 1-page-per-request transcription for active student
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
        // Mode: Legacy Local Qwen VL direct transcription
        if (activeMode === 'local_qwen_vl') {
          const areaResolution = resolveWritingAreasForPage(
            item.page,
            item.part,
            templateRegions
          );

          const res = await transcriptionService.transcribePage({
            scanPageId: item.page.id,
            imageUrls: [item.page.previewUrl],
            pageNumber: item.part,
            totalParts: item.total,
            studentId: targetStudentId,
            assignmentId: assignment.id,
            regions: areaResolution.regions,
            readingOrder: currentSettings.readingOrder,
            settings: currentSettings,
          });

          const errDetail =
            res.message ||
            res.error ||
            (res.status !== 'success'
              ? res.code
                ? `Transcription error (${res.code})`
                : 'Cause unavailable'
              : undefined);

          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: res.status === 'success' ? 'success' : 'failed',
            transcript: res.transcript,
            linesWithBboxes: res.linesWithBboxes,
            error: errDetail,
            errorCode: res.code,
            httpStatus: res.httpStatus,
            isRetryable: res.isRetryable,
            modelId: res.modelId,
            promptVersion: res.promptVersion,
            settingsVersion: currentSettings.version,
            hasUnreadable: res.hasUnreadable,
            ocrMode: 'local_qwen_vl',
          });
          continue;
        }

        // Mode A & B: Run Mathpix OCR via Bridge (port 18089)
        setPageStage('ocr_running');

        // Shared region-aware preparation (same helper as batch/retry/verify):
        // crop the saved writing-area region when one exists for this page;
        // pages without a region keep the existing full-page behavior.
        const singleAreaResolution = resolveWritingAreasForPage(item.page, item.part, templateRegions);
        const prepared = await prepareOcrImageFromRegions(
          item.page.previewUrl,
          singleAreaResolution.hasError ? [] : singleAreaResolution.regions
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
          const errMsg = ocrRes.message || 'Mathpix OCR recognition failed.';
          setNotice({
            type: 'error',
            text: `Page ${item.part}: ${errMsg}`,
          });
          pageResults.push({
            scanPageId: item.page.id,
            part: item.part,
            totalParts: item.total,
            status: 'failed',
            error: errMsg,
            errorCode: (ocrRes as any).code || 'OCR_ERROR',
            ocrMode: activeMode,
          });
          continue;
        }

        const mathpixText = ocrRes.transcript.trim();
        const rawLines = mathpixText ? mathpixText.replace(/\r\n/g, '\n').split('\n') : [];
        const mathpixLinesWithBboxes = rawLines.map((l) => ({
          text: l,
          bbox: null,
          scanPageId: item.page.id,
          pageNumber: item.part,
        }));

        // Mode A: Mathpix OCR Only
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

        // Mode B: Mathpix OCR + Qwen VL Verify (Port 18088)
        setPageStage('vl_running');
        setNotice({
          type: 'info',
          text: `Mathpix OCR complete. Verifying Page ${item.part} with Qwen VL (Port 18088)...`,
        });

        let qwenRes: any = null;
        if (transcriptionService.verifyTranscription) {
          try {
            qwenRes = await transcriptionService.verifyTranscription({
              scanPageId: item.page.id,
              studentId: targetStudentId,
              pageNumber: item.part,
              // Verify the SAME image that Mathpix OCR ran on (selected region
              // crop when applicable), not unrelated full-page content.
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
            status: 'success', // Mathpix succeeded
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

      setStagedCandidatesByStudent((prev) => ({
        ...prev,
        [targetStudentId]: {
          ...combined,
          isStale: currentSignature !== initialSignature,
          staleReason:
            currentSignature !== initialSignature
              ? 'Scan page assignments changed during transcription.'
              : undefined,
        },
      }));
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
    const candidate = stagedCandidatesByStudent[targetStudentId];
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
          // Reuse the EXACT image region Mathpix OCR ran on (stored crop);
          // falls back to the full page only for legacy results. No Mathpix call.
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
            error: undefined,
          });
        } else {
          updatedResults.push({
            ...pr,
            qwenVerificationStatus: 'failed',
            error: `Qwen VL verification retry incomplete: ${qwenRes?.message || 'Port 18088 error'}`,
          });
        }
      }

      const signature = computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
      const combined = combineCandidateTranscript(
        targetStudentId,
        updatedResults,
        currentSettings,
        'mathpix_qwen_verify',
        signature,
        assignment.id
      );

      const anyIncomplete = updatedResults.some((p) => p.qwenVerificationStatus === 'failed');
      if (anyIncomplete) {
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

      setStagedCandidatesByStudent((prev) => ({
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

      if (activeMode === 'local_qwen_vl') {
        const areaResolution = resolveWritingAreasForPage(
          pageItem.page,
          pageItem.part,
          templateRegions
        );

        const res = await transcriptionService.transcribePage({
          scanPageId: pageItem.page.id,
          imageUrls: [pageItem.page.previewUrl],
          pageNumber: pageItem.part,
          totalParts: pageItem.total,
          studentId: targetStudentId,
          assignmentId: assignment.id,
          regions: areaResolution.regions,
          readingOrder: currentSettings.readingOrder,
          settings: currentSettings,
        });

        pageRes = {
          scanPageId: pageItem.page.id,
          part: pageItem.part,
          totalParts: pageItem.total,
          status: res.status === 'success' ? 'success' : 'failed',
          transcript: res.transcript,
          linesWithBboxes: res.linesWithBboxes,
          error: res.message || res.error,
          errorCode: res.code,
          httpStatus: res.httpStatus,
          isRetryable: res.isRetryable,
          modelId: res.modelId,
          promptVersion: res.promptVersion,
          settingsVersion: currentSettings.version,
          hasUnreadable: res.hasUnreadable,
          ocrMode: 'local_qwen_vl',
        };
      } else {
        // Shared region-aware preparation (same helper as single/batch/retry).
        const inlineAreaResolution = resolveWritingAreasForPage(pageItem.page, pageItem.part, templateRegions);
        const prepared = await prepareOcrImageFromRegions(
          pageItem.page.previewUrl,
          inlineAreaResolution.hasError ? [] : inlineAreaResolution.regions
        );

        if (prepared.error) {
          pageRes = {
            scanPageId: pageItem.page.id,
            part: pageItem.part,
            totalParts: pageItem.total,
            status: 'failed',
            error: prepared.error,
            errorCode: 'INVALID_OCR_REGION',
            ocrMode: activeMode,
          };
          setNotice({
            type: 'error',
            text: `Page ${pageItem.part}: ${prepared.error}`,
          });
        } else {
        // Run Mathpix OCR for this page
        const ocrRes = await ocrService.recognize({
          imageUrls: [prepared.imageUrl],
          studentId: targetStudentId,
          assignmentId: assignment.id,
        });

        if (ocrRes.status !== 'success') {
          pageRes = {
            scanPageId: pageItem.page.id,
            part: pageItem.part,
            totalParts: pageItem.total,
            status: 'failed',
            error: ocrRes.message,
            ocrMode: activeMode,
          };
        } else {
          const mathpixText = ocrRes.transcript.trim();
          const mathpixLines = mathpixText.split('\n').map((l) => ({
            text: l,
            bbox: null,
            scanPageId: pageItem.page.id,
            pageNumber: pageItem.part,
          }));

          if (activeMode === 'mathpix_only') {
            pageRes = {
              scanPageId: pageItem.page.id,
              part: pageItem.part,
              totalParts: pageItem.total,
              status: 'success',
              transcript: mathpixText,
              mathpixRawTranscript: mathpixText,
              linesWithBboxes: mathpixLines,
              ocrMode: 'mathpix_only',
              ocrRegionImageUrl: prepared.imageUrl,
              isRegionCrop: prepared.isRegionCrop,
            };
          } else {
            // Combined mode: verify with Qwen
            let qwenRes: any = null;
            if (transcriptionService.verifyTranscription) {
              try {
                qwenRes = await transcriptionService.verifyTranscription({
                  scanPageId: pageItem.page.id,
                  studentId: targetStudentId,
                  pageNumber: pageItem.part,
                  // Verify the SAME image Mathpix OCR ran on (selected region crop when applicable).
                  imageDataUri: prepared.imageUrl,
                  mathpixTranscript: mathpixText,
                  settings: currentSettings,
                });
              } catch (qErr: any) {
                qwenRes = { status: 'error', message: qErr?.message };
              }
            }

            if (qwenRes && qwenRes.status === 'success' && qwenRes.verifiedTranscript) {
              const verifiedText = qwenRes.verifiedTranscript.trim();
              pageRes = {
                scanPageId: pageItem.page.id,
                part: pageItem.part,
                totalParts: pageItem.total,
                status: 'success',
                transcript: verifiedText,
                mathpixRawTranscript: mathpixText,
                qwenVerifiedTranscript: verifiedText,
                qwenVerificationStatus: 'success',
                qwenChanges: qwenRes.changes || [],
                linesWithBboxes: verifiedText.split('\n').map((l: string) => ({
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
                transcript: mathpixText,
                mathpixRawTranscript: mathpixText,
                qwenVerificationStatus: 'failed',
                error: `Qwen VL verification incomplete: ${qwenRes?.message || 'Port 18088 error'}`,
                linesWithBboxes: mathpixLines,
                ocrMode: 'mathpix_qwen_verify',
                ocrRegionImageUrl: prepared.imageUrl,
                isRegionCrop: prepared.isRegionCrop,
              };
            }
          }
        }
        }
      }

      const existingCandidate = stagedCandidatesByStudent[targetStudentId];
      const existingResults = existingCandidate ? [...existingCandidate.pageResults] : [];
      const updatedResults: PageTranscriptionResult[] = [];

      let replaced = false;
      for (const pr of existingResults) {
        if (pr.scanPageId === pageItem.page.id || pr.part === pageItem.part) {
          updatedResults.push(pageRes);
          replaced = true;
        } else {
          updatedResults.push(pr);
        }
      }
      if (!replaced) updatedResults.push(pageRes);

      const signature = computeStudentPageSignature(activeStudentIndex, appliedMatching, pages);
      const combined = combineCandidateTranscript(
        targetStudentId,
        updatedResults,
        currentSettings,
        activeMode,
        signature,
        assignment.id
      );

      const anyIncomplete = updatedResults.some((p) => p.qwenVerificationStatus === 'failed');
      if (anyIncomplete) {
        combined.status = 'partially_transcribed';
        combined.qwenVerificationStatus = 'failed';
        setPageStage('verification_pending');
      } else {
        setPageStage('completed');
      }

      setStagedCandidatesByStudent((prev) => ({
        ...prev,
        [targetStudentId]: combined,
      }));

      setNotice({
        type: 'success',
        text: `Page ${pageItem.part} re-transcription completed.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to transcribe page ${pageItem.part}.`,
      });
    } finally {
      setPerPageLoading((prev) => ({ ...prev, [pageItem.page.id]: false }));
      inFlightRef.current = false;
    }
  };

  // Batch Queue Handlers
  const handleStartBatchQueue = async () => {
    if (isBatchRunning || inFlightRef.current) return;

    if (!hasWritingAreas) {
      setNotice({
        type: 'error',
        text: 'Missing required writing areas: No writing areas have been defined on the worksheet template. Please configure writing areas in Preparation before transcribing.',
      });
      return;
    }

    if (selectedProvider === 'mathpix') {
      setNotice({
        type: 'error',
        text: 'Live Mathpix transcription is disabled while DRY_RUN is enabled. Please select Local Qwen VL.',
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
        setStagedCandidatesByStudent((prev) => ({
          ...prev,
          [studentId]: candidate,
        }));
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
    if (batchControllerRef.current) {
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
    if (batchControllerRef.current) {
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

  // Staged Candidate Actions
  const handleRequestApplyCandidate = (targetStudentId: string) => {
    const candidate = stagedCandidatesByStudent[targetStudentId];
    if (!candidate) return;

    if (candidate.status === 'failed' || !candidate.transcript.trim()) {
      setNotice({
        type: 'error',
        text: 'Cannot apply empty or failed candidate transcript.',
      });
      return;
    }

    if (isCandidateStale) {
      setNotice({
        type: 'error',
        text: 'Cannot apply stale candidate: Scan page assignments were altered since transcription. Please re-run transcription.',
      });
      return;
    }

    // If teacher already has text or is verified, require explicit confirmation
    if (currentTranscript.editedText.trim().length > 0 || currentTranscript.isVerified) {
      setConfirmDialog({
        type: 'apply_candidate_overwrite',
        targetStudentId,
        candidateText: candidate.transcript,
      });
      return;
    }

    applyCandidateToEditor(targetStudentId, candidate.transcript, candidate.linesWithBboxes);
  };

  const applyCandidateToEditor = (
    studentId: string,
    newText: string,
    linesWithBboxes?: LineWithBbox[]
  ) => {
    if (!newText || !newText.trim()) {
      setNotice({
        type: 'error',
        text: 'Cannot apply empty or failed transcript text to editor.',
      });
      return;
    }
    // Preserve prior editor text in session recovery state
    if (currentTranscript.editedText.trim()) {
      setPreviousDraftsByStudent((prev) => ({
        ...prev,
        [studentId]: currentTranscript.editedText,
      }));
    }

    onUpdateTranscriptText(studentId, newText, linesWithBboxes);

    // Clear staged candidate
    setStagedCandidatesByStudent((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });

    setConfirmDialog(null);
    setNotice({
      type: 'info',
      text: 'Candidate transcript applied to editor. Previous draft preserved in session recovery. Downstream verification must be explicitly confirmed.',
    });
  };

  const handleRestorePreviousDraft = (studentId: string) => {
    const savedText = previousDraftsByStudent[studentId];
    if (savedText === undefined) return;

    const currentText = currentTranscript.editedText;
    onUpdateTranscriptText(studentId, savedText);

    setPreviousDraftsByStudent((prev) => {
      const next = { ...prev };
      if (currentText.trim()) {
        next[studentId] = currentText;
      } else {
        delete next[studentId];
      }
      return next;
    });

    setNotice({
      type: 'info',
      text: 'Previous transcript restored. Prior draft retained in session recovery.',
    });
  };

  const handleDismissPreviousDraft = (studentId: string) => {
    setPreviousDraftsByStudent((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const handleCopyCandidate = async (text: string) => {
    if (!text || !text.trim()) {
      setNotice({
        type: 'error',
        text: 'Cannot copy empty or failed candidate transcript.',
      });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setNotice({
        type: 'error',
        text: 'Clipboard access is not available in this browser environment.',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCandidateId(activeStudentId);
      setTimeout(() => setCopiedCandidateId(null), 2500);
    } catch {
      setNotice({
        type: 'error',
        text: 'Unable to copy to clipboard.',
      });
    }
  };

  const handleDiscardCandidate = (studentId: string) => {
    setStagedCandidatesByStudent((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setNotice({
      type: 'info',
      text: 'Candidate transcript discarded. Current transcript editor text remains unchanged.',
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateTranscriptText(activeStudentId, e.target.value);
  };

  return (
    <div className="space-y-4">
      {/* Stage 4 Assignment-Level Toolbar */}
      <TranscriptionToolbar
        provider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onTranscribeAllPending={handleStartBatchQueue}
        pendingCount={pendingCount}
        isBatchRunning={isBatchRunning}
        batchProgress={batchProgress}
        onPauseBatch={handlePauseBatchQueue}
        onResumeBatch={handleResumeBatchQueue}
        onRetryFailed={handleRetryFailedBatchQueue}
        hasWritingAreas={hasWritingAreas}
        onNavigateToPreparation={onNavigateToPreparation}
        pageCount={studentPagesWithIndices.length}
        pageStage={pageStage}
        isDryRun={isDryRun}
        isMathpixConfigured={isMathpixConfigured}
        qwenStatus={qwenStatus}
        onTranscribeActive={() => handleInitiateSingleEssayTranscribe(activeStudentId)}
        isTranscribingActive={isTranscribingSingle}
        onRetryQwenVerify={() => executeRetryQwenVerification(activeStudentId)}
        hasMathpixOutput={!!(activeCandidate && (activeCandidate.mathpixTranscript || activeCandidate.transcript))}
      />

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
              <div className="relative inline-block max-h-[580px] select-none">
                <img
                  src={activePageItem.page.previewUrl}
                  alt={`Student essay scan`}
                  onClick={() => setPreviewModalPage(activePageItem.page)}
                  onPointerMove={handleScanPointerMove}
                  onPointerLeave={handleScanPointerLeave}
                  className="max-h-[580px] w-auto object-contain rounded cursor-zoom-in block"
                />
                {/* Overlay for Line Bounding Boxes */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Note when line positions are not available for this page */}
                  {activePageLinesWithIndices.length > 0 &&
                    activePageLinesWithIndices.filter(({ line }) => line.bbox).length === 0 && (
                      <div className="absolute top-3 left-3 bg-slate-900/75 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded shadow pointer-events-none flex items-center gap-1.5 z-20">
                        <Info className="w-3.5 h-3.5 text-slate-300" />
                        <span>Line positions not available for this page</span>
                      </div>
                    )}

                  {activePageLinesWithIndices.map(({ line, globalIndex }) => {
                    if (!line.bbox) return null;
                    const [x1, y1, x2, y2] = line.bbox;
                    const isHighlighted = highlightedLineIndex === globalIndex;
                    // Apply 1% display padding on left and right for punctuation tolerance without mutating stored bbox
                    const paddedLeft = Math.max(0, (x1 - 10) / 10);
                    const paddedRight = Math.min(100, (x2 + 10) / 10);
                    const paddedWidth = paddedRight - paddedLeft;

                    return (
                      <div
                        key={globalIndex}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHighlightedLineIndex(isHighlighted ? null : globalIndex);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${paddedLeft}%`,
                          top: `${y1 / 10}%`,
                          width: `${paddedWidth}%`,
                          height: `${(y2 - y1) / 10}%`,
                        }}
                        className={`pointer-events-auto cursor-pointer rounded transition-all duration-150 ${
                          isHighlighted
                            ? 'bg-purple-500/30 border-2 border-purple-600 shadow-md ring-2 ring-purple-300 z-20'
                            : 'border border-purple-400/40 hover:border-purple-600 hover:bg-purple-500/15 z-10'
                        }`}
                        title={`Line ${globalIndex + 1}: ${line.text}`}
                      >
                        <span
                          className={`absolute -top-3.5 left-0 px-1 py-0.2 rounded text-[9px] font-bold font-mono transition-opacity ${
                            isHighlighted
                              ? 'bg-purple-600 text-white opacity-100 z-30 shadow-xs'
                              : 'bg-slate-800 text-white opacity-0 hover:opacity-100'
                          }`}
                        >
                          L{globalIndex + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalPage(activePageItem.page)}
                  className="absolute bottom-3 right-3 px-2 py-1 bg-slate-900/70 hover:bg-slate-900 text-white rounded text-xs flex items-center gap-1 shadow transition-colors pointer-events-auto z-30"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Enlarge</span>
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-12 text-xs">
                No scan image assigned to this student.
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-500 text-center font-medium">
            Hover over the scan to magnify handwriting. Click Enlarge for a larger view.
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

          {/* Feedback notice */}
          {notice && (
            <div
              className={`p-2.5 rounded-md text-xs flex items-start justify-between gap-2 mb-3 border animate-in fade-in duration-150 ${
                notice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : notice.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {notice.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : notice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>{notice.text}</div>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Current Student Transcription Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>
                  {selectedProvider === 'mathpix_only'
                    ? 'Mathpix OCR Only'
                    : selectedProvider === 'mathpix_qwen_verify'
                    ? 'Mathpix OCR + Qwen VL Verify'
                    : 'Local Qwen VL'}
                  :
                </strong>{' '}
                {studentPagesWithIndices.length} {studentPagesWithIndices.length === 1 ? 'page' : 'pages'} to process.
                {isDryRun && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-300">
                    DRY RUN
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeCandidate?.ocrMode === 'mathpix_qwen_verify' &&
                activeCandidate?.qwenVerificationStatus === 'failed' && (
                  <button
                    type="button"
                    onClick={() => executeRetryQwenVerification(activeStudentId)}
                    disabled={isRetryingQwen || isTranscribingSingle || isBatchRunning}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-50 shadow-2xs"
                    title="Retry Qwen verification using stored Mathpix output without calling Mathpix again"
                  >
                    {isRetryingQwen ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                    ) : (
                      <RotateCcw className="w-3 h-3 text-amber-700" />
                    )}
                    <span>Retry Qwen Verify</span>
                  </button>
                )}

              {activePageItem && (
                <button
                  type="button"
                  onClick={() => executeRetrySinglePage(activeStudentId, activePageItem)}
                  disabled={isTranscribingSingle || isBatchRunning || !!perPageLoading[activePageItem.page.id]}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {perPageLoading[activePageItem.page.id] ? (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                  ) : (
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                  )}
                  <span>Retry Page {activePageItem.part}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleInitiateSingleEssayTranscribe(activeStudentId)}
                disabled={isTranscribingSingle || isBatchRunning || studentPagesWithIndices.length === 0}
                aria-label={`Start ${selectedProvider === 'mathpix_only' ? 'Mathpix OCR' : 'Mathpix + Qwen'} (${studentPagesWithIndices.length}) - Transcribe This Essay`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-2xs"
              >
                {isTranscribingSingle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {pageStage === 'vl_running'
                        ? 'Verifying with Qwen VL...'
                        : 'Running Mathpix OCR...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Start {selectedProvider === 'mathpix_only' ? 'Mathpix OCR' : 'Mathpix + Qwen'} (
                      {studentPagesWithIndices.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Staged Candidate Review Box */}
          {activeCandidate && (
            <StagedCandidateBox
              candidate={activeCandidate}
              studentId={activeStudentId}
              isStale={isCandidateStale}
              staleReason={activeCandidate.staleReason}
              onApply={() => handleRequestApplyCandidate(activeStudentId)}
              onCopy={() => handleCopyCandidate(activeCandidate.transcript)}
              onDiscard={() => handleDiscardCandidate(activeStudentId)}
              highlightedLineIndex={highlightedLineIndex}
              onSelectLine={setHighlightedLineIndex}
              onRetryPage={(scanPageId, part) => {
                const item = studentPagesWithIndices.find(
                  (p) => p.page.id === scanPageId || p.part === part
                );
                if (item) {
                  executeRetrySinglePage(activeStudentId, item);
                }
              }}
              onRetryQwenVerify={() => executeRetryQwenVerification(activeStudentId)}
              isRetryingQwen={isRetryingQwen}
              perPageLoading={perPageLoading}
              isCopied={copiedCandidateId === activeStudentId}
              assignmentId={assignment.id}
            />
          )}

          {/* Application-Managed Recoverable Previous Version Banner */}
          {previousDraftsByStudent[activeStudentId] && (
            <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 mb-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-semibold">Previous draft preserved:</span> A prior version ({previousDraftsByStudent[activeStudentId].trim().split(/\s+/).length} words) is stored in session recovery.
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRestorePreviousDraft(activeStudentId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Restore Previous Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissPreviousDraft(activeStudentId)}
                  className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100 transition-colors"
                  title="Dismiss preserved draft"
                  aria-label="Dismiss preserved draft"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Highlight Line Indicator */}
          {highlightedLineIndex !== null && (
            <div className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-900 mb-2 animate-in fade-in duration-100">
              <div className="flex items-center gap-2 truncate">
                <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-mono text-[11px] font-bold">
                  Line {highlightedLineIndex + 1}
                </span>
                <span className="truncate text-purple-800">
                  {currentLinesWithBboxes[highlightedLineIndex]?.text
                    ? `"${currentLinesWithBboxes[highlightedLineIndex].text}"`
                    : 'Highlighted line selected'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHighlightedLineIndex(null)}
                className="text-purple-600 hover:text-purple-900 text-xs font-semibold px-2 py-0.5 rounded hover:bg-purple-100 transition-colors shrink-0"
              >
                Clear
              </button>
            </div>
          )}

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

          {/* Editor Action Toolbar: Explicit Confirm Transcript (Separated from Marking navigation) */}
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
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {currentTranscript.isVerified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>✓ Transcript Verified</span>
                </>
              ) : (
                <span>Confirm Transcript</span>
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
              const candidate = stagedCandidatesByStudent[student.id];

              let statusLabel = 'Not Transcribed';
              let statusClass = 'text-slate-400';

              if (isVerified) {
                statusLabel = '✓ Transcript Verified';
                statusClass = 'text-emerald-600 font-semibold';
              } else if (candidate?.status === 'candidate_ready') {
                statusLabel = 'Candidate Ready';
                statusClass = 'text-purple-600 font-semibold';
              } else if (candidate?.status === 'partially_transcribed') {
                statusLabel = 'Partially Transcribed';
                statusClass = 'text-amber-600 font-medium';
              } else if (transcript?.editedText?.trim()) {
                statusLabel = 'Draft Transcript';
                statusClass = 'text-slate-600';
              }

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
                  <span className={`block text-[10px] mt-0.5 ${statusClass}`}>
                    {statusLabel}
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

      {/* Assignment-Level Transcription Settings Modal */}
      <TranscriptionSettingsModal
        isOpen={isSettingsModalOpen}
        settings={currentSettings}
        templateRegions={templateRegions}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaveSettings={(newSettings) => {
          if (onUpdateAssignmentSettings) {
            onUpdateAssignmentSettings(newSettings);
          }
          setIsSettingsModalOpen(false);
          setNotice({
            type: 'info',
            text: `Transcription settings updated to version ${newSettings.version}. New settings apply to subsequent transcription runs.`,
          });
        }}
        onNavigateToPreparation={onNavigateToPreparation}
      />

      {/* Confirmation Dialogs */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-md w-full p-5 animate-in zoom-in-95 duration-150">
            {confirmDialog.type === 'pre_flight_transcribe' && (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-full shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Transcribe Essay for this Student?
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      This student already has existing or verified transcript text. Running transcription will generate a candidate transcript.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      <strong>Zero Overwrite Safety:</strong> The candidate transcript will appear in a separate review box above the editor. Your current text will NOT be replaced unless you explicitly click "Apply Candidate to Editor".
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = confirmDialog.targetStudentId;
                      setConfirmDialog(null);
                      executeSingleEssayTranscription(targetId);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors shadow-2xs"
                  >
                    Proceed with Transcription
                  </button>
                </div>
              </>
            )}

            {confirmDialog.type === 'apply_candidate_overwrite' && (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-full shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Overwrite Existing Transcript?
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Applying this candidate transcript will replace your current editor text. Any completed transcript verification will be revoked for re-review.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      <strong>Application Recovery:</strong> Your current editor text will be preserved in session memory. You can swap or restore it at any time using "Restore Previous Text".
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Keep Current Text
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyCandidateToEditor(
                        confirmDialog.targetStudentId,
                        confirmDialog.candidateText,
                        stagedCandidatesByStudent[confirmDialog.targetStudentId]?.linesWithBboxes
                      );
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors shadow-2xs"
                  >
                    Confirm & Replace
                  </button>
                </div>
              </>
            )}

            {confirmDialog.type === 'qwen_unavailable_choice' && (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-full shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Qwen VL Service Unavailable (Port 18088)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      The vision verification service on port 18088 is currently offline or unreachable. Mathpix OCR + Qwen VL Verify requires Qwen VL to verify transcription accuracy.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Would you like to run <strong>Mathpix OCR Only</strong> ({studentPagesWithIndices.length} {studentPagesWithIndices.length === 1 ? 'page' : 'pages'}) instead, or cancel?
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = confirmDialog.targetStudentId;
                      setConfirmDialog(null);
                      executeSingleEssayTranscription(targetId, 'mathpix_only');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs"
                  >
                    Proceed with Mathpix Only
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cursor-Position Scan Magnifier */}
      <MagnifierLens state={magnifier} />
    </div>
  );
};
