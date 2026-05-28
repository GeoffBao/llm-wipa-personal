export const VAULT_PATH = process.env.VAULT_PATH || '';
export const PORT = parseInt(process.env.PORT || '3000', 10);

/** WeRead cookie string for data sync (set WEREAD_COOKIE in .env) */
export const WEREAD_COOKIE = process.env.WEREAD_COOKIE || '';

/** Readwise Chat web URL (fallback open-in-reader link) */
export const READWISE_CHAT_URL = process.env.READWISE_CHAT_URL || 'https://readwise.io/chat';

/** OpenAI-compatible chat API (e.g. DeepSeek). Set in .env. */
export const CHAT_BASE_URL = process.env.CHAT_BASE_URL || '';
export const CHAT_API_KEY  = process.env.CHAT_API_KEY  || '';
export const CHAT_MODEL    = process.env.CHAT_MODEL    || 'deepseek-v4-flash';

// Subdirectories under VAULT_PATH/Wiki/ to index
export const WIKI_SECTIONS = ['concepts', 'sources', 'mocs', 'synthesis', 'prompts', 'people'];

// Section display labels (used by article and browse routes)
export const SECTION_LABELS = {
  concepts:  'Concept',
  sources:   'Source',
  mocs:      'Map',
  synthesis: 'Synthesis',
  prompts:   'Prompt',
  people:    'People',
  notes:     'Note',
  projects:  'Project',
  reading:   'Reading',
};

// Domain → tag/keyword mapping for Topic Portals on home page
export const DOMAIN_PORTALS = [
  {
    id: 'ai-agents',
    title: 'AI & Agents',
    icon: '🤖',
    coverColor: '#6D82FF',
    keywords: ['agent', 'llm', 'ai', '多模型'],
    description: 'Agent systems, multi-model orchestration, LLM toolchains',
  },
  {
    id: 'pkm-knowledge',
    title: 'PKM & Knowledge',
    icon: '🧠',
    coverColor: '#4ADE80',
    keywords: ['pkm', 'knowledge', '知识库', 'obsidian', 'tana'],
    description: 'Personal knowledge management, LLM knowledge bases, memory systems',
  },
  {
    id: 'camera-imaging',
    title: 'Camera & Imaging',
    icon: '📷',
    coverColor: '#F59E0B',
    keywords: ['camera', 'isp', 'sensor', 'imaging'],
    description: 'ISP pipeline, camera performance, imaging algorithms',
  },
  {
    id: 'software-tools',
    title: 'Software & Tools',
    icon: '⚙️',
    coverColor: '#818CF8',
    keywords: ['claude', 'cursor', 'coding', 'workflow', 'engineering'],
    description: 'Claude Code, dev tools, engineering practices',
  },
];
