import type { ElectronAPI } from '../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI & { clearSales?: () => Promise<boolean> };
  }
}

export {};
