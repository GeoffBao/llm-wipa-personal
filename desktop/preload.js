import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('llmKbDesktop', {
  platform: process.platform,
  onShortcut: (cb) => {
    ipcRenderer.on('wipa-shortcut', (_e, action) => cb(action));
  },
});
