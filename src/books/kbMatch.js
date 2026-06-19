/**
 * Shared fuzzy matcher for pairing a book title with its generated KB directory
 * under AI-Generated/exports/books/.
 *
 * Replaces the old naive `a.includes(b) || b.includes(a)` first-match logic,
 * which could mis-pair short titles as the library grows (a short normalized
 * title is easily a substring of an unrelated longer directory name).
 */

// Strip punctuation / brackets / spaces so "黄仁勋：英伟达之芯" == "黄仁勋-英伟达之芯".
export function normalizeTitle(s) {
  return String(s || '').toLowerCase().replace(/[：:《》\s「」【】\-_·]/g, '').trim();
}

// Minimum overlap ratio (shorter / longer) for a containment match to count.
// Below this, a tiny title would match an unrelated long directory name.
const MIN_RATIO = 0.5;
const MIN_LEN   = 2;

/**
 * Score how well a normalized candidate matches a normalized target.
 * Returns 0 for no match; higher is better. Exact equality wins outright.
 */
export function matchScore(wantNorm, candidateNorm) {
  if (!wantNorm || !candidateNorm) return 0;
  if (wantNorm === candidateNorm) return 1000;
  const shorter = Math.min(wantNorm.length, candidateNorm.length);
  const longer  = Math.max(wantNorm.length, candidateNorm.length);
  if (shorter < MIN_LEN) return 0;
  const contains = wantNorm.includes(candidateNorm) || candidateNorm.includes(wantNorm);
  if (!contains) return 0;
  const ratio = shorter / longer;
  return ratio >= MIN_RATIO ? Math.round(ratio * 100) : 0;
}

/**
 * Pick the best-matching candidate for a title.
 * @param {string} title raw book title
 * @param {Array<{name:string, value:any}>} candidates  name = dir name (raw)
 * @returns the matched candidate's `value`, or null.
 */
export function bestKBMatch(title, candidates) {
  const want = normalizeTitle(title);
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = matchScore(want, normalizeTitle(c.name));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best ? best.value : null;
}
