export const VAULT_PATH = process.env.VAULT_PATH || '';
export const PORT = parseInt(process.env.PORT || '3000', 10);

/** Readwise Chat web URL (embed + open links). Set READWISE_CHAT_URL in .env to deep-link a conversation. */
export const READWISE_CHAT_URL = process.env.READWISE_CHAT_URL || 'https://readwise.io/chat';

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
    keywords: ['agent', 'llm', 'ai', '多模型'],
    description: 'Agent systems, multi-model orchestration, LLM toolchains',
  },
  {
    id: 'pkm-knowledge',
    title: 'PKM & Knowledge',
    icon: '🧠',
    keywords: ['pkm', 'knowledge', '知识库', 'obsidian', 'tana'],
    description: 'Personal knowledge management, LLM knowledge bases, memory systems',
  },
  {
    id: 'camera-imaging',
    title: 'Camera & Imaging',
    icon: '📷',
    keywords: ['camera', 'isp', 'sensor', 'imaging'],
    description: 'ISP pipeline, camera performance, imaging algorithms',
  },
  {
    id: 'software-tools',
    title: 'Software & Tools',
    icon: '⚙️',
    keywords: ['claude', 'cursor', 'coding', 'workflow', 'engineering'],
    description: 'Claude Code, dev tools, engineering practices',
  },
];
