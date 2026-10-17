import { RubricDimension, MarkingFinding } from '../types';

export type ServiceStatusType = 'not_configured' | 'available' | 'error' | 'busy';

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
  };
  backgroundRunner: {
    status: ServiceStatusType;
    providerName: string;
    details: string;
  };
}

export interface OcrRequest {
  imageUrls: string[];
  worksheetContext?: string;
  scopePrompt?: string;
}

export type OcrResponse =
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

export interface EssayMarkingRequest {
  transcript: string;
  assignmentTitle: string;
  scopePrompt: string;
  rubric: RubricDimension[];
}

export type EssayMarkingResponse =
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
      findings: Omit<MarkingFinding, 'id' | 'decision'>[];
      suggestedScores: Record<string, number>;
      suggestedFeedback: string;
    };

export interface EssayOcrService {
  recognize(request: OcrRequest): Promise<OcrResponse>;
}

export interface VisualVerificationService {
  verify(request: VisualVerificationRequest): Promise<VisualVerificationResponse>;
}

export interface EssayMarkingService {
  mark(request: EssayMarkingRequest): Promise<EssayMarkingResponse>;
}

export interface ServiceAvailabilityService {
  checkStatus(): Promise<ServiceAvailabilityStatus>;
}
