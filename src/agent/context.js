const DEFAULT_MAX_BODY_CHARS = 12000;
const DEFAULT_MAX_SELECTION_CHARS = 6000;
const DEFAULT_MAX_MESSAGES = 12;

export async function buildReadingContext({
  slug = '',
  selectedText = '',
  messages = [],
  fileLoader,
  maxBodyChars = DEFAULT_MAX_BODY_CHARS,
  maxSelectionChars = DEFAULT_MAX_SELECTION_CHARS,
  maxMessages = DEFAULT_MAX_MESSAGES,
}) {
  const normalizedSlug = String(slug).trim();
  if (!normalizedSlug || normalizedSlug.includes('..') || normalizedSlug.includes('/')) {
    throw new Error('document not found');
  }
  if (typeof fileLoader !== 'function') {
    throw new TypeError('fileLoader is required');
  }

  const file = await fileLoader(normalizedSlug);
  if (!file) throw new Error('document not found');

  return {
    document: {
      title: String(file.title || normalizedSlug),
      slug: String(file.slug || normalizedSlug),
      body: String(file.body || '').slice(0, maxBodyChars),
    },
    selection: String(selectedText || '').slice(0, maxSelectionChars),
    conversation: messages
      .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
      .slice(-maxMessages)
      .map(message => ({
        role: message.role,
        content: String(message.content || '').slice(0, 6000),
      })),
    sources: [],
  };
}
