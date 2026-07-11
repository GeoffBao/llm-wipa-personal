import { toCitation } from './citations.js';

const WIKI_MIN_SCORE = 0.65;
const READWISE_MIN_SCORE = 0.78;

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter(source => {
    const citation = toCitation(source);
    if (seen.has(citation.id)) return false;
    seen.add(citation.id);
    source.__citation = citation;
    return true;
  });
}

function formatSource(citation, index) {
  const score = citation.score == null ? '' : ` (score ${citation.score.toFixed(3)})`;
  return `${index}. [${citation.kind}] ${citation.title}${score} — ${citation.excerpt || 'No excerpt available.'}`;
}

export async function buildAgentContext({ query = '', readingContext, searchers = {} }) {
  const cleanQuery = String(query || '').trim();
  const wikiHits = cleanQuery && typeof searchers.wiki === 'function'
    ? await searchers.wiki(cleanQuery)
    : [];
  const readwiseHits = cleanQuery && typeof searchers.readwise === 'function'
    ? await searchers.readwise(cleanQuery)
    : [];
  const keywordHits = cleanQuery && typeof searchers.keyword === 'function'
    ? await searchers.keyword(cleanQuery)
    : [];

  const wikiSources = dedupeSources(wikiHits
    .filter(hit => Number(hit.score ?? 1) >= WIKI_MIN_SCORE)
    .map(hit => ({ ...hit, kind: 'wiki', excerpt: hit.excerpt || hit.snippet || hit.text })));
  const keywordSources = dedupeSources(keywordHits
    .map(hit => ({ ...hit, kind: 'wiki', excerpt: hit.excerpt || hit.snippet || hit.text })));
  const readwiseSources = dedupeSources(readwiseHits
    .filter(hit => Number(hit.score ?? 1) >= READWISE_MIN_SCORE)
    .map(hit => ({ ...hit, kind: 'readwise', excerpt: hit.excerpt || hit.summary || hit.text })));

  const sources = dedupeSources([...wikiSources, ...readwiseSources, ...keywordSources])
    .map(source => source.__citation);
  const document = readingContext?.document;
  const selection = readingContext?.selection || '';
  const conversation = readingContext?.conversation || [];
  const promptContext = [
    '[CURRENT READING]',
    document ? `${document.title} (${document.slug})\n${document.body}` : 'No active reading document.',
    selection ? `\n[SELECTED PASSAGE]\n${selection}` : '',
    '\n[PERSONAL KB EVIDENCE]',
    sources.filter(source => source.kind === 'wiki').map((source, index) => formatSource(source, index + 1)).join('\n') || 'No personal KB evidence found.',
    '\n[EXTERNAL READING EVIDENCE]',
    sources.filter(source => source.kind === 'readwise').map((source, index) => formatSource(source, index + 1)).join('\n') || 'No external reading evidence found.',
    '\n[RECENT CONVERSATION]',
    conversation.map(message => `${message.role}: ${message.content}`).join('\n') || 'No prior conversation.',
    '\n[INSTRUCTION]',
    'Separate source-backed facts from inference. Cite source IDs in the response.',
  ].filter(Boolean).join('\n');

  return {
    promptContext,
    citations: sources,
    retrievalStatus: {
      query: cleanQuery,
      wikiCount: sources.filter(source => source.kind === 'wiki').length,
      readwiseCount: sources.filter(source => source.kind === 'readwise').length,
      hasEvidence: sources.length > 0,
    },
  };
}
