/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EssayOcrService,
  VisualVerificationService,
  EssayMarkingService,
  ServiceAvailabilityService,
  OcrRequest,
  OcrResponse,
  VisualVerificationRequest,
  VisualVerificationResponse,
  EssayMarkingRequest,
  EssayMarkingResponse,
  ServiceAvailabilityStatus,
} from './essayServiceTypes';

export class UnconfiguredOcrService implements EssayOcrService {
  async recognize(_request: OcrRequest): Promise<OcrResponse> {
    return {
      status: 'not_configured',
      message:
        'Optical Character Recognition (OCR) provider is not configured. Connect Mathpix or a local vision service to enable automatic handwriting recognition.',
    };
  }
}

export class UnconfiguredVisualVerificationService implements VisualVerificationService {
  async verify(_request: VisualVerificationRequest): Promise<VisualVerificationResponse> {
    return {
      status: 'not_configured',
      message:
        'Visual verification service is not configured. Word-to-scan alignment and preprinted worksheet boundary detection are not yet connected.',
    };
  }
}

export class UnconfiguredEssayMarkingService implements EssayMarkingService {
  async mark(_request: EssayMarkingRequest): Promise<EssayMarkingResponse> {
    return {
      status: 'not_configured',
      message:
        'AI marking service is not configured. A designated Qwen3-VL-32B or remote model endpoint must be configured before automatic rubric suggestions can be generated.',
    };
  }
}

export class UnconfiguredAvailabilityService implements ServiceAvailabilityService {
  async checkStatus(): Promise<ServiceAvailabilityStatus> {
    return {
      ocr: {
        status: 'not_configured',
        providerName: 'Mathpix / Vision OCR',
        details: 'Endpoint and authentication credentials are not configured.',
      },
      visualVerification: {
        status: 'not_configured',
        providerName: 'Vision Verification (Qwen3-VL)',
        details: 'Visual verification service host is not assigned.',
      },
      marking: {
        status: 'not_configured',
        providerName: 'Essay Marking Model (32B)',
        details: 'Local/remote model endpoint is not configured.',
      },
      backgroundRunner: {
        status: 'not_configured',
        providerName: 'Background Service (Port 18087)',
        details: 'Background worker service is not connected.',
      },
    };
  }
}
