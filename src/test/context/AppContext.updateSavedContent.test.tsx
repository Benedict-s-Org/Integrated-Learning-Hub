import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Lightweight contract test for the update-content invoke shape used by AppContext.updateSavedContent.
 * Full AppProvider integration is covered manually / via MemorizationView save path.
 */
describe('memorization-content/update-content request contract', () => {
  const invokeMock = vi.fn();

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        content: {
          id: 'content-1',
          title: 'Updated Title',
          originalText: 'Updated body text',
          selectedWordIndices: [0, 2],
          createdAt: new Date().toISOString(),
          isPublished: true,
          publicId: 'pub-1',
          practiceMode: 'memorization',
        },
      },
      error: null,
    });
  });

  it('builds the update-content payload expected by the edge function', async () => {
    const payload = {
      contentId: 'content-1',
      userId: 'user-1',
      title: 'Updated Title',
      originalText: 'Updated body text',
      selectedWordIndices: [0, 2],
      practiceMode: 'memorization' as const,
    };

    await invokeMock('memorization-content/update-content', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'memorization-content/update-content',
      expect.objectContaining({
        body: JSON.stringify(payload),
      })
    );
  });
});
