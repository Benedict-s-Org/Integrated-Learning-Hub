import crypto from 'crypto';

/**
 * jobManager.js — Bounded concurrency, deduplication fingerprinting,
 * and upstream timeout uncertainty tracking.
 */
class JobManager {
  constructor(options = {}) {
    this.maxConcurrentJobs = options.maxConcurrentJobs || 1;
    this.retentionWindowMs = options.retentionWindowMs || 5 * 60 * 1000; // 5 minutes
    this.maxCacheEntries = 100;

    this.activeJobs = new Set();
    this.recentJobs = new Map(); // fingerprint -> { state, startedAt, completedAt, result, error }
  }

  /**
   * Generates a deterministic SHA-256 fingerprint for the request.
   */
  createFingerprint({ userId, studentId, assignmentId, imageUrls }) {
    const hash = crypto.createHash('sha256');
    hash.update(`user:${userId || 'anonymous'}|`);
    hash.update(`student:${studentId || 'default'}|`);
    hash.update(`assignment:${assignmentId || 'default'}|`);

    for (const url of imageUrls) {
      // Hash first 512 bytes + length + last 512 bytes for fast, distinct identity
      hash.update(`img_len:${url.length}|`);
      hash.update(url.slice(0, 512));
      hash.update(url.slice(-512));
    }

    return hash.digest('hex');
  }

  /**
   * Cleans expired cache entries to maintain bounded memory usage.
   */
  _prune() {
    const now = Date.now();
    for (const [fp, job] of this.recentJobs.entries()) {
      if (now - job.updatedAt > this.retentionWindowMs && job.state !== 'in_flight') {
        this.recentJobs.delete(fp);
      }
    }

    // If still over max entries, evict oldest completed entries
    if (this.recentJobs.size > this.maxCacheEntries) {
      const keys = Array.from(this.recentJobs.keys());
      for (let i = 0; i < keys.length && this.recentJobs.size > this.maxCacheEntries; i++) {
        const k = keys[i];
        if (this.recentJobs.get(k)?.state !== 'in_flight') {
          this.recentJobs.delete(k);
        }
      }
    }
  }

  /**
   * Checks deduplication and acquires concurrency slot.
   */
  acquire({ fingerprint, userId, studentId }) {
    this._prune();

    const existing = this.recentJobs.get(fingerprint);

    // 1. Reject duplicate in-flight requests
    if (existing && existing.state === 'in_flight') {
      return {
        allowed: false,
        status: 409,
        code: 'DUPLICATE_IN_FLIGHT',
        message: 'An identical OCR request for this student and scan is already processing on the bridge. Please wait.',
      };
    }

    // 2. Reuse recent successful completion within retention window (prevents duplicate billing)
    if (existing && existing.state === 'completed' && existing.result) {
      return {
        allowed: false,
        status: 200,
        code: 'CACHED_RESULT_REUSED',
        isCached: true,
        result: existing.result,
        message: 'Reused verified OCR result from recent submission (completed within retention window). Upstream call skipped.',
      };
    }

    // 3. Reject recent timeout where upstream billing is uncertain
    if (existing && existing.state === 'timeout_uncertain') {
      const elapsedSec = Math.round((Date.now() - existing.updatedAt) / 1000);
      return {
        allowed: false,
        status: 409,
        code: 'TIMEOUT_UNCERTAIN_RETRY_BLOCKED',
        message: `A previous OCR request for this scan timed out ${elapsedSec}s ago. Its upstream billing and completion status may be uncertain. Do not immediately retry without checking your Mathpix dashboard.`,
      };
    }

    // 4. Bounded Concurrency Check
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return {
        allowed: false,
        status: 429,
        code: 'CONCURRENCY_LIMIT_REACHED',
        message: `Bridge is currently processing an active OCR job. Concurrency limit (${this.maxConcurrentJobs}) reached. Please retry in a few moments.`,
      };
    }

    // Mark as in-flight
    this.activeJobs.add(fingerprint);
    this.recentJobs.set(fingerprint, {
      state: 'in_flight',
      userId,
      studentId,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      result: null,
    });

    return { allowed: true, fingerprint };
  }

  /**
   * Releases concurrency slot and updates job outcome.
   */
  complete(fingerprint, { outcome, result, error }) {
    this.activeJobs.delete(fingerprint);

    const now = Date.now();
    if (outcome === 'success') {
      this.recentJobs.set(fingerprint, {
        state: 'completed',
        updatedAt: now,
        result,
      });
    } else if (outcome === 'timeout_uncertain') {
      this.recentJobs.set(fingerprint, {
        state: 'timeout_uncertain',
        updatedAt: now,
        error: error || 'Upstream request timed out. Billing state uncertain.',
      });
    } else {
      // Normal errors or validation failures are not cached long-term
      this.recentJobs.delete(fingerprint);
    }
  }

  getStatus() {
    return {
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      retentionWindowSec: Math.round(this.retentionWindowMs / 1000),
      cachedEntries: this.recentJobs.size,
    };
  }
}

export const jobManager = new JobManager();
