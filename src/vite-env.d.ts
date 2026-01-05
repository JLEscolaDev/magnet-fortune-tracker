/// <reference types="vite/client" />

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
    NativeUploaderAvailable?: boolean;
  }
}
