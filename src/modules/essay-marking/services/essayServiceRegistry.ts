import {
  EssayOcrService,
  VisualVerificationService,
  EssayMarkingService,
  ServiceAvailabilityService,
  EssayTranscriptionService,
} from './essayServiceTypes';
import {
  UnconfiguredVisualVerificationService,
} from './unconfiguredServices';
import {
  BridgeOcrService,
  BridgeAvailabilityService,
} from './bridgeOcrService';
import { BridgeIdentityService } from './bridgeIdentityService';
import { BridgeTranscriptionService } from './bridgeTranscriptionService';
import { BridgeMarkingService } from './bridgeMarkingService';

/**
 * Service Registry for Teacher Essay Marking Workbench.
 * Keeps UI components decoupled from specific OCR or AI model providers.
 *
 * Current Bridges:
 * - Dedicated Essay Marking Bridge (port 18089) for Mathpix OCR API
 * - Local Qwen3-VL-32B visual verification adapter (port 18088, future phase)
 * - Local Qwen3-VL-32B rubric marking adapter (port 18088 via Bridge)
 * - Local Qwen3-VL-32B student identity recognition adapter (port 18088 via Bridge)
 * - Local Qwen3-VL-32B full-essay transcription adapter (port 18088 via Bridge)
 */
class EssayServiceRegistry {
  private ocrService: EssayOcrService = new BridgeOcrService();
  private transcriptionService: EssayTranscriptionService = new BridgeTranscriptionService();
  private visualVerificationService: VisualVerificationService =
    new UnconfiguredVisualVerificationService();
  private markingService: EssayMarkingService = new BridgeMarkingService();
  private availabilityService: ServiceAvailabilityService =
    new BridgeAvailabilityService();
  private identityService: BridgeIdentityService = new BridgeIdentityService();

  getTranscriptionService(): EssayTranscriptionService {
    return this.transcriptionService;
  }

  setTranscriptionService(service: EssayTranscriptionService) {
    this.transcriptionService = service;
  }

  getOcrService(): EssayOcrService {
    return this.ocrService;
  }

  setOcrService(service: EssayOcrService) {
    this.ocrService = service;
  }

  getIdentityService(): BridgeIdentityService {
    return this.identityService;
  }

  setIdentityService(service: BridgeIdentityService) {
    this.identityService = service;
  }

  getVisualVerificationService(): VisualVerificationService {
    return this.visualVerificationService;
  }

  setVisualVerificationService(service: VisualVerificationService) {
    this.visualVerificationService = service;
  }

  getMarkingService(): EssayMarkingService {
    return this.markingService;
  }

  setMarkingService(service: EssayMarkingService) {
    this.markingService = service;
  }

  getAvailabilityService(): ServiceAvailabilityService {
    return this.availabilityService;
  }

  setAvailabilityService(service: ServiceAvailabilityService) {
    this.availabilityService = service;
  }
}

export const essayServices = new EssayServiceRegistry();
