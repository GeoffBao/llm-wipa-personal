# LLM KB Desktop (macOS Electron Shell)

Lightweight Electron wrapper around the llm-wipa Express server.

## Prerequisites

- Node.js 22+
- llm-wipa dependencies installed at repo root (`npm install`)
- `.env` configured at repo root

## Development

```bash
cd desktop
npm install
npm start
```

This spawns `node --env-file=.env server.js` from the repo root and opens `http://127.0.0.1:3000`.

## Build DMG

```bash
cd desktop
npm install
npm run dist
```

Output: `desktop/dist/LLM KB-*.dmg`

## macOS shortcuts (via app menu)

| Shortcut | Action |
|----------|--------|
| ⌘T | New tab (Omnibar) |
| ⌘W | Close tab |
| ⌘Q | Quit app + stop Express |

## Notes

- Single-instance lock — second launch focuses existing window
- External links open in default browser
- Uses `titleBarStyle: hiddenInset` + vibrancy for native macOS feel
