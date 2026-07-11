import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const WRITEBACK_TARGETS = Object.freeze({
  journey: 'Journey',
  wiki: 'Wiki/synthesis',
  projects: 'Projects',
});

export function createMemoryCandidate({ source, insight, target = 'journey', title = 'Agent insight' } = {}) {
  if (!source || !String(source).trim()) throw new Error('source required');
  if (!insight || !String(insight).trim()) throw new Error('insight required');
  if (!WRITEBACK_TARGETS[target]) throw new Error('invalid writeback target');
  return {
    id: randomUUID(),
    source: String(source).trim().slice(0, 500),
    insight: String(insight).trim().slice(0, 12000),
    title: String(title || 'Agent insight').trim().slice(0, 180),
    target,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export function createVaultWriter({ vaultPath, writeFileImpl = writeFile, mkdirImpl = mkdir } = {}) {
  return async function writeCandidate(candidate) {
    if (!vaultPath) throw new Error('Vault path unavailable');
    const directory = join(vaultPath, WRITEBACK_TARGETS[candidate.target]);
    const filename = `agent-${candidate.id}.md`;
    const filepath = join(directory, filename);
    const content = `---\ntitle: ${candidate.title.replace(/[:#\[\]]/g, ' ')}\ntype: agent-insight\ncreated: ${candidate.createdAt}\nsource: ${candidate.source}\n---\n\n${candidate.insight}\n`;
    await mkdirImpl(directory, { recursive: true });
    await writeFileImpl(filepath, content, 'utf8');
    return { path: filepath, title: candidate.title };
  };
}

export async function approveMemoryCandidate(candidate, vaultWriter) {
  if (!candidate || candidate.status !== 'pending') {
    if (candidate?.status === 'approved') return candidate.result;
    throw new Error('candidate is not pending');
  }
  const result = await vaultWriter(candidate);
  candidate.status = 'approved';
  candidate.result = result;
  candidate.approvedAt = new Date().toISOString();
  return result;
}
