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

export const parseGradeFromClassName = (className?: string | null): PrimaryGrade | null => {
  if (!className) return null;
  const trimmed = className.trim();
  const match = trimmed.match(/^(?:P\.?|Primary\s*)?([1-6])(?:[A-Za-z]|\b)/i);
  if (match) {
    return `P.${match[1]}` as PrimaryGrade;
  }
  return null;
};

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
  settingsVersion?: string;
  hasUnreadable?: boolean;
  ocrMode?: TranscriptionProvider;
  mathpixRawTranscript?: string;
  qwenVerifiedTranscript?: string;
  qwenVerificationStatus?: 'success' | 'incomplete' | 'failed' | 'skipped';
  qwenChanges?: Array<{ ocrOriginal: string; verified: string; reason: string }>;
  unreadableWords?: string[];
  isDryRun?: boolean;
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
  linesWithBboxes?: LineWithBbox[];
  isManuallyEntered: boolean;
  uncertainRegions: UncertainRegion[];
  isVerified: boolean;
  verifiedAt?: string;
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
  isManual?: boolean;
  reviewReason?: string;
  source?: 'ai' | 'teacher';
  promptVersion?: string;
  schemaVersion?: string;
}

export interface StudentMarkingState {
  studentId: string;
  findings: MarkingFinding[];
  scores: Record<string, number>;
  feedbackComment: string;
  isApproved: boolean;
  approvedAt?: string;
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
