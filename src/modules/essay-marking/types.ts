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

export const DEFAULT_RUBRIC: RubricDimension[] = [
  { id: 'content', name: 'Content', maxScore: 4 },
  { id: 'language', name: 'Language', maxScore: 4 },
  { id: 'organization', name: 'Organization', maxScore: 4 },
  { id: 'vocabulary', name: 'Vocabulary', maxScore: 4 },
  { id: 'mechanics', name: 'Mechanics', maxScore: 4 },
];

export interface AssignmentConfig {
  title: string;
  worksheetFileName: string | null;
  worksheetFile: File | null;
  worksheetPreviewUrl: string | null;
  responseFormat: 'worksheet' | 'separate_paper';
  scopePrompt: string;
  isConfirmed: boolean;
  rubric: RubricDimension[];
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

export interface AppliedMatching {
  classId: string;
  counts: number[];
  map: (StudentMatchMapItem | null)[];
  assignedStudentIndices: number[];
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
  isManuallyEntered: boolean;
  uncertainRegions: UncertainRegion[];
  isVerified: boolean;
  verifiedAt?: string;
}

export type FindingDecision = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface MarkingFinding {
  id: string;
  type: string;
  originalText: string;
  replacementText: string;
  explanation: string;
  decision: FindingDecision;
  teacherCustomText?: string;
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
