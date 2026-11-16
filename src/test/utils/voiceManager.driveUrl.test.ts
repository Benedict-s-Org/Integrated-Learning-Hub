import { describe, expect, it } from 'vitest';
import { driveFileToProxyUrl } from '../../utils/voiceManager';

describe('driveFileToProxyUrl', () => {
  it('builds a Drive uc URL resolveAudioUrl can parse', () => {
    expect(driveFileToProxyUrl('abc123')).toBe(
      'https://drive.google.com/uc?export=download&id=abc123'
    );
  });
});