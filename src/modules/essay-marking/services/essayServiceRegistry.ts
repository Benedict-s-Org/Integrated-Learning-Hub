import {
  EssayOcrService,
  VisualVerificationService,
  EssayMarkingService,
  ServiceAvailabilityService,
} from './essayServiceTypes';
import {
  UnconfiguredOcrService,
  UnconfiguredVisualVerificationService,
  UnconfiguredEssayMarkingService,
  UnconfiguredAvailabilityService,
} from './unconfiguredServices';

/**
 * Service Registry for Teacher Essay Marking Workbench.
 * Keeps UI components decoupled from specific OCR or AI model providers.
 *
 * Future integration points:
 * - Mathpix OCR API adapter
 * - Remote Qwen3-VL-32B visual verification adapter
 * - Remote Qwen3-VL-32B rubric marking adapter
 * - Background task worker (e.g. port 18087)
 */
class EssayServiceRegistry {
  private ocrService: EssayOcrService = new UnconfiguredOcrService();
  private visualVerificationService: VisualVerificationService =
    new UnconfiguredVisualVerificationService();
  private markingService: EssayMarkingService = new UnconfiguredEssayMarkingService();
  private availabilityService: ServiceAvailabilityService =
    new UnconfiguredAvailabilityService();

  getOcrService(): EssayOcrService {
    return this.ocrService;
  }

  setOcrService(service: EssayOcrService) {
    this.ocrService = service;
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
