export type WorkflowStep =
  | 'prep'
  | 'intake'
  | 'pair'
  | 'ocr'
  | 'grade'
  | 'report';

export interface RubricDimension {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
}

export type PrimaryGrade = 'P.1' | 'P.2' | 'P.3' | 'P.4' | 'P.5' | 'P.6';

export const PRIMARY_GRADES: PrimaryGrade[] = [
  'P.1',
  'P.2',
  'P.3',
  'P.4',
  'P.5',
  'P.6',
];

export const OVERALL_GRADES = ['A', 'A−', 'B+', 'B', 'B−', 'C+'] as const;
export type OverallGrade = typeof OVERALL_GRADES[number];

export const RUBRIC_P1_P3: RubricDimension[] = [
  { id: 'content', name: 'Content', maxScore: 60 },
  { id: 'language', name: 'Language', maxScore: 40 },
];

export const RUBRIC_P4_P6: RubricDimension[] = [
  { id: 'content', name: 'Content', maxScore: 40 },
  { id: 'language', name: 'Language', maxScore: 40 },
  { id: 'organisation', name: 'Organisation', maxScore: 20 },
];

export const getRubricForGrade = (grade: PrimaryGrade): RubricDimension[] => {
  if (grade === 'P.1' || grade === 'P.2' || grade === 'P.3') {
    return [...RUBRIC_P1_P3];
  }
  return [...RUBRIC_P4_P6];
};

/**
 * Computes a deterministic fingerprint of the rubric including all dimensions, names, maxima,
 * and criteria/descriptions to protect against context changes.
 */
export function computeRubricFingerprint(rubric: RubricDimension[]): string {
  if (!Array.isArray(rubric) || rubric.length === 0) return 'rubric_empty';
  return rubric
    .map((d) => `${d.id}:${d.name}:${d.maxScore}:${d.description || ''}`)
    .sort()
    .join('|');
}

export const parseGradeFromClassName = (className?: string | null): PrimaryGrade | null => {
  if (!className) return null;
  const trimmed = className.trim();
  const match = trimmed.match(/^(?:P\.?|Primary\s*)?([1-6])(?:[A-Za-z]|\b)/i);
  if (match) {
    return `P.${match[1]}` as PrimaryGrade;
  }
  return null;
};

/**
 * Resolves the effective primary grade for a student, detecting conflicts between assignment and student class.
 * Enforces:
 * - Current pedagogical prompt supports P.3 - P.6 only. P.1 and P.2 return an unsupported error.
 * - If assignment grade and student class grade conflict, returns an explicit conflict error rather than silently choosing.
 */
export function resolveEffectiveGrade(
  assignmentGrade?: PrimaryGrade | null,
  studentClassName?: string | null
): { grade: PrimaryGrade | null; error?: string } {
  const studentGrade = parseGradeFromClassName(studentClassName);

  if (assignmentGrade && studentGrade && assignmentGrade !== studentGrade) {
    return {
      grade: null,
      error: `年級設定衝突：作業設定為 ${assignmentGrade}，但學生班級（${studentClassName}）推算為 ${studentGrade}。請先於作業設定或班級名冊解決衝突。`,
    };
  }

  const effective = assignmentGrade || studentGrade;
  if (!effective) {
    return {
      grade: null,
      error: '缺少學生年級：請於作業設定或班級名單指定學生年級 (P.3, P.4, P.5, P.6)。',
    };
  }

  if (effective === 'P.1' || effective === 'P.2') {
    return {
      grade: null,
      error: `不支援的年級 (${effective})：目前寫作批改指引僅支援小三至小六 (P.3–P.6)。`,
    };
  }

  return { grade: effective };
}

export const DEFAULT_RUBRIC: RubricDimension[] = [];

export type RegionType =
  | 'class'
  | 'student_name'
  | 'class_number'
  | 'writing_area';

export interface TemplateRegion {
  id: string;
  type: RegionType;
  pageNumber: number; // 1-indexed
  x: number; // 0..1 relative to page width
  y: number; // 0..1 relative to page height
  width: number; // 0..1 relative to page width
  height: number; // 0..1 relative to page height
  pageWidth?: number;
  pageHeight?: number;
  name?: string;
  orderIndex?: number;
}

export interface AssignmentConfig {
  id?: string;
  title: string;
  isTitleCustomized?: boolean;
  grade?: PrimaryGrade | null;
  worksheetFileName: string | null;
  worksheetFile: File | null;
  worksheetPreviewUrl: string | null;
  responseFormat: 'worksheet' | 'separate_paper';
  scopePrompt: string;
  isConfirmed: boolean;
  rubric: RubricDimension[];
  templateRegions?: TemplateRegion[];
  templateFingerprint?: string;
  worksheetPageCount?: number;
  transcriptionSettings?: AssignmentTranscriptionSettings;
}

export interface ScanFileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  pageCount: number;
  addedAt: number;
}

export interface ScanPage {
  id: string;
  fileId: string;
  fileName: string;
  sourcePageNumber: number;
  previewUrl: string;
  orderIndex: number;
  customRegions?: TemplateRegion[];
  imageBlob?: Blob;
  isBlank?: boolean;
}

export interface StudentRosterItem {
  id: string;
  displayName: string;
  classNumber: number;
  className: string;
}

export interface StudentMatchMapItem {
  studentIndex: number;
  studentId: string;
  studentName: string;
  classNumber: number;
  part: number;
  total: number;
}

export interface MatchingPreviewResult {
  map: (StudentMatchMapItem | null)[];
  need: number;
  assigned: number;
  extra: number;
  missing: number;
}

export type IdentityMatchStatus =
  | 'matched'
  | 'needs_review'
  | 'conflict'
  | 'unmatched';

export interface PageIdentityRecognition {
  scanPageId: string;
  pageNumber: number;
  rawClass: string | null;
  rawStudentName: string | null;
  rawClassNumber: string | null;
  classReadable: boolean;
  nameReadable: boolean;
  numberReadable: boolean;
  warnings: string[];
  status: IdentityMatchStatus;
  statusReason?: string;
  matchedStudentId?: string | null;
  candidateStudentIds?: string[];
  manualStudentId?: string | null;
  manualConfirmed?: boolean;
  needsAdjustment?: boolean;
}

export type MatchingMode = 'sequential' | 'recognition';

export interface AppliedMatching {
  classId: string;
  counts: number[];
  map: (StudentMatchMapItem | null)[];
  assignedStudentIndices: number[];
  mode?: MatchingMode;
  contextFingerprint?: string;
  studentPageOrders?: Record<string, string[]>;
}

export type TranscriptionProvider =
  | 'mathpix_only'
  | 'mathpix_qwen_verify'
  | 'local_qwen_vl'
  | 'mathpix';

export interface AssignmentTranscriptionSettings {
  version: string;
  primaryLanguage: 'en' | 'zh' | 'bilingual';
  printedLabelsMode: 'exclude' | 'separate_context';
  notes: string;
  readingOrder?: string[];
}

export const DEFAULT_TRANSCRIPTION_SETTINGS: AssignmentTranscriptionSettings = {
  version: 'v1.0',
  primaryLanguage: 'en',
  printedLabelsMode: 'separate_context',
  notes: '',
  readingOrder: [],
};

export function normalizeTranscriptionSettings(
  settings?: Partial<AssignmentTranscriptionSettings> | null
): AssignmentTranscriptionSettings {
  return {
    version: settings?.version || DEFAULT_TRANSCRIPTION_SETTINGS.version,
    primaryLanguage: settings?.primaryLanguage || DEFAULT_TRANSCRIPTION_SETTINGS.primaryLanguage,
    printedLabelsMode:
      settings?.printedLabelsMode === 'exclude' || settings?.printedLabelsMode === 'separate_context'
        ? settings.printedLabelsMode
        : DEFAULT_TRANSCRIPTION_SETTINGS.printedLabelsMode,
    notes: typeof settings?.notes === 'string' ? settings.notes : DEFAULT_TRANSCRIPTION_SETTINGS.notes,
    readingOrder: Array.isArray(settings?.readingOrder) ? [...settings.readingOrder] : [],
  };
}

export type StudentTranscriptionStatus =
  | 'pending'
  | 'queued'
  | 'transcribing'
  | 'candidate_ready'
  | 'partially_transcribed'
  | 'needs_review'
  | 'failed'
  | 'verified';

export interface WordWithBbox {
  text: string;
  bbox: [number, number, number, number];
  wordIndex: number;
}

export interface LineWithBbox {
  text: string;
  bbox: [number, number, number, number] | null;
  words?: WordWithBbox[];
  scanPageId?: string;
  pageNumber?: number;
}

export interface PageTranscriptionResult {
  scanPageId: string;
  part: number;
  totalParts: number;
  status: 'success' | 'failed';
  transcript?: string;
  linesWithBboxes?: LineWithBbox[];
  error?: string;
  errorCode?: string;
  httpStatus?: number;
  isRetryable?: boolean;
  modelId?: string;
  promptVersion?: string;
  promptHash?: string;
  settingsVersion?: string;
  hasUnreadable?: boolean;
  ocrMode?: TranscriptionProvider;
  mathpixRawTranscript?: string;
  qwenVerifiedTranscript?: string;
  qwenVerificationStatus?: 'success' | 'incomplete' | 'failed' | 'skipped';
  qwenChanges?: Array<{ ocrOriginal: string; verified: string; reason: string }>;
  unreadableWords?: string[];
  isDryRun?: boolean;
  ocrRegionImageUrl?: string;
  isRegionCrop?: boolean;
  isBlank?: boolean;
}

export interface StagedCandidateTranscript {
  id: string;
  studentId: string;
  assignmentId?: string;
  transcript: string;
  linesWithBboxes?: LineWithBbox[];
  receivedAt: number;
  provider: TranscriptionProvider;
  modelId?: string;
  promptVersion: string;
  promptHash?: string;
  settingsVersion: string;
  pageSignature: string;
  status: 'candidate_ready' | 'partially_transcribed' | 'failed';
  pageResults: PageTranscriptionResult[];
  hasUnreadable?: boolean;
  isStale?: boolean;
  staleReason?: string;
  wordCount?: number;
  ocrMode?: TranscriptionProvider;
  mathpixTranscript?: string;
  qwenVerifiedTranscript?: string;
  qwenVerificationStatus?: 'success' | 'incomplete' | 'failed' | 'skipped';
  qwenChanges?: Array<{ ocrOriginal: string; verified: string; reason: string }>;
  unreadableWords?: string[];
  isDryRun?: boolean;
  isEntireScriptBlank?: boolean;
  rawTranscript?: string;
  reviewNotices?: OcrReviewNotice[];
}

export interface OcrReviewNotice {
  id: string;
  type: 'suspicious_syntax' | 'skip_line_marker' | 'worksheet_boilerplate';
  message: string;
  matchedText: string;
  lineIndex?: number;
  lineNumber?: number;
  sourceContext?: string;
}

export interface UncertainRegion {
  id: string;
  lineNumber: number;
  flaggedWord: string;
  suggestedWord?: string;
  verifiedWord?: string;
  resolved: boolean;
}

export interface StudentTranscriptState {
  studentId: string;
  rawOcrText: string | null;
  editedText: string;
  originalOcrText?: string;
  reviewNotices?: OcrReviewNotice[];
  linesWithBboxes?: LineWithBbox[];
  isManuallyEntered: boolean;
  uncertainRegions: UncertainRegion[];
  isVerified: boolean;
  verifiedAt?: string;
  revision?: number;
  isEntireScriptBlank?: boolean;
  completedPageIds?: string[];
}

export type FindingDecision = 'pending' | 'accepted' | 'rejected' | 'edited' | 'needs_review';

export type FindingFeedbackType = 'correction' | 'improvement' | 'clarity';

export interface MarkingFinding {
  id: string;
  type: string;
  feedbackType?: FindingFeedbackType;
  originalText: string;
  replacementText: string;
  explanation: string;
  decision: FindingDecision;
  teacherCustomText?: string;
  paragraphIndex?: number;
  lineIndex?: number;
  occurrenceIndex?: number;
  startIndex?: number;
  endIndex?: number;
  isManual?: boolean;
  reviewReason?: string;
  anchorReview?: boolean;
  anchorReviewReason?: string;
  source?: 'ai' | 'teacher';
  promptVersion?: string;
  schemaVersion?: string;
}

export interface StructuredAssessmentComments {
  positive: string;
  relevant: string;
  finalNextStep: string;
}

export interface MarkingJobContext {
  studentId: string;
  yearLevel: PrimaryGrade;
  transcriptRevision: number;
  transcriptHash: string;
  assignmentTitle: string;
  scopePrompt: string;
  rubricFingerprint: string;
  promptSnapshot?: {
    promptVersion: string;
    promptHash: string;
  } | null;
}

export interface StagedAiProposal {
  scores: Record<string, number>;
  totalScore: number;
  assessmentComments: StructuredAssessmentComments;
  findings: MarkingFinding[];
  receivedAt: string;
  promptVersion?: string;
  contextIdentity?: MarkingJobContext;
}

export interface StudentMarkingState {
  studentId: string;
  findings: MarkingFinding[];
  scores: Record<string, number>;
  totalScore?: number;
  scoresSource?: 'ai' | 'teacher';
  assessmentComments?: StructuredAssessmentComments;
  commentsSource?: 'ai' | 'teacher';
  feedbackComment: string;
  isApproved: boolean;
  approvedAt?: string;
  markingSchemaVersion?: string;
  contextIdentity?: MarkingJobContext;
  stagedAiProposal?: StagedAiProposal;
}

export interface StudentReportState {
  studentId: string;
  isPublished: boolean;
  publishedAt?: string;
}

export interface WorkbenchSessionState {
  currentStep: WorkflowStep;
  assignment: AssignmentConfig;
  files: ScanFileRecord[];
  pages: ScanPage[];
  selectedClassId: string;
  studentPageCounts: number[];
  selectedStudentIndices: Set<number>;
  appliedMatching: AppliedMatching | null;
  activeStudentIndex: number;
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  reports: Record<string, StudentReportState>;
  galleryViewMode: 'large' | 'medium' | 'list';
}
