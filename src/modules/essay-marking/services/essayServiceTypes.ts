import { RubricDimension, MarkingFinding, TemplateRegion, AssignmentTranscriptionSettings } from '../types';

export type ServiceStatusType =
  | 'not_configured'
  | 'dry_run_ready'
  | 'available'
  | 'error'
  | 'busy';

export interface MarkingModelHealthStatus {
  status: 'checking' | 'ready' | 'unavailable' | 'bridge_unreachable';
  port: number;
  modelId?: string;
  checkedAt?: string;
  details?: string;
}

export interface ServiceAvailabilityStatus {
  ocr: {
    status: ServiceStatusType;
    providerName: string;
    details: string;
  };
  visualVerification: {
    status: ServiceStatusType;
    providerName: string;
    details: string;
  };
  marking: {
    status: ServiceStatusType;
    providerName: string;
    details: string;
    port?: number;
    modelId?: string | null;
    checkedAt?: string;
  };
  backgroundRunner: {
    status: ServiceStatusType;
    providerName: string;
    details: string;
  };
  transcription?: {
    status: ServiceStatusType;
    providerName: string;
    fixedRulesVersion?: string;
    details: string;
  };
}

export interface OcrRequest {
  imageUrls: string[];
  worksheetContext?: string;
  scopePrompt?: string;
  studentId?: string;
  assignmentId?: string;
}

export type OcrResponse =
  | {
      status: 'not_configured';
      message: string;
    }
  | {
      status: 'dry_run_ready';
      message: string;
      code?: string;
      ready?: boolean;
      provider?: string;
    }
  | {
      status: 'error';
      message: string;
      code?: string;
      requestId?: string;
    }
  | {
      status: 'success';
      transcript: string;
      uncertainRegions: Array<{
        id: string;
        lineNumber: number;
        flaggedWord: string;
      }>;
    };

export interface VisualVerificationRequest {
  scanImageUrl: string;
  transcript: string;
  worksheetContext?: string;
}

export type VisualVerificationResponse =
  | {
      status: 'not_configured';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    }
  | {
      status: 'success';
      alignedPassages: Array<{
        lineNumber: number;
        isPreprintedText: boolean;
        confidence: number;
      }>;
    };

export interface MarkingPromptSnapshot {
  content: string;
  promptHash: string;
  promptVersion: string;
  schemaVersion: string;
  filePath?: string;
}

export interface EssayMarkingRequest {
  transcript: string;
  studentId?: string;
  assignmentId?: string;
  assignmentTitle: string;
  scopePrompt: string;
  rubric: RubricDimension[];
  promptSnapshot?: MarkingPromptSnapshot | null;
}

export type EssayMarkingResponse =
  | {
      status: 'not_configured';
      message: string;
    }
  | {
      status: 'error';
      message: string;
      code?: string;
    }
  | {
      status: 'success';
      findings: Omit<MarkingFinding, 'id' | 'decision'>[];
      suggestedScores: Record<string, number>;
      suggestedFeedback: string;
      promptVersion?: string;
      schemaVersion?: string;
    };

export interface EssayOcrService {
  recognize(request: OcrRequest): Promise<OcrResponse>;
}

export interface VisualVerificationService {
  verify(request: VisualVerificationRequest): Promise<VisualVerificationResponse>;
}

export interface EssayMarkingService {
  mark(request: EssayMarkingRequest): Promise<EssayMarkingResponse>;
  getPromptSnapshot?(): Promise<MarkingPromptSnapshot | null>;
}

export interface ServiceAvailabilityService {
  checkStatus(): Promise<ServiceAvailabilityStatus>;
  checkMarkingModelStatus?(): Promise<MarkingModelHealthStatus>;
}

export interface TranscribePageRequest {
  scanPageId: string;
  studentId: string;
  assignmentId?: string;
  imageUrls?: string[]; // strictly 1 page URL
  imageUrl?: string;    // single-image convenience/compatibility
  pageNumber?: number;
  part?: number;        // part number convenience/compatibility
  totalParts: number;
  regions?: TemplateRegion[];
  writingAreas?: TemplateRegion[]; // writingAreas convenience/compatibility
  readingOrder?: string[];
  settings: AssignmentTranscriptionSettings;
  classId?: string;
}

export interface TranscribePageResponse {
  status: 'success' | 'error' | 'busy';
  scanPageId: string;
  studentId: string;
  assignmentId?: string | null;
  pageNumber?: number;
  totalParts?: number;
  transcript?: string;
  linesWithBboxes?: Array<{
    text: string;
    bbox: [number, number, number, number] | null;
    scanPageId?: string;
    pageNumber?: number;
  }>;
  coordinateSystem?: {
    type: string;
    relativeTo: string;
  };
  provider?: string;
  modelId?: string;
  promptVersion?: string;
  settingsVersion?: string;
  hasUnreadable?: boolean;
  wordCount?: number;
  message?: string;
  error?: string; // Structured error message matching message
  code?: string;
  httpStatus?: number;
  isRetryable?: boolean;
  requestId?: string;
  provenance?: {
    provider: string;
    modelId?: string;
    timestamp: number;
    promptVersion: string;
    scanPageId: string;
    studentId: string;
  };
}

export interface FixedTranscriptionRulesInfo {
  version: string;
  rulesSummary: Array<{ title: string; description: string }>;
  rulesText?: string;
}

export interface VerifyTranscriptionRequest {
  scanPageId: string;
  studentId: string;
  pageNumber?: number;
  imageDataUri: string;
  mathpixTranscript: string;
  settings?: AssignmentTranscriptionSettings;
}

export interface VerifyTranscriptionResponse {
  status: 'success' | 'error' | 'busy';
  scanPageId: string;
  studentId: string;
  pageNumber?: number;
  verifiedTranscript?: string;
  hasUncertainty?: boolean;
  changes?: Array<{ ocrOriginal: string; verified: string; reason: string }>;
  unreadableWords?: string[];
  modelId?: string;
  provider?: string;
  message?: string;
  error?: string;
  code?: string;
}

export interface EssayTranscriptionService {
  transcribePage(request: TranscribePageRequest): Promise<TranscribePageResponse>;
  verifyTranscription?(request: VerifyTranscriptionRequest): Promise<VerifyTranscriptionResponse>;
  getActiveRules?(): Promise<FixedTranscriptionRulesInfo | null>;
}
