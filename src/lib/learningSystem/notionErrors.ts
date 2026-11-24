/** Turn a Notion or edge-function failure into the sentence shown on Start practice. */
export function messageFromNotionFailure(raw: string | null | undefined): string {
  const message = (raw || '').trim();
  if (/shared with your integration/i.test(message) || /object_not_found/i.test(message)) {
    return 'The Learning System question bank is not shared with the app connection. Ask a teacher to add the Anagram connection in Notion.';
  }
  if (!message || message === 'Edge Function returned a non-2xx status code') {
    return 'Could not read the Learning System question bank. Try again, and ask a teacher if this continues.';
  }
  return message;
}
