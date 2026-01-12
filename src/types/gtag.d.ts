// Type definitions for Google Analytics gtag

interface GtagEventParams {
  [key: string]: string | number | boolean | undefined;
}

interface Gtag {
  (command: 'config', targetId: string, config?: GtagEventParams): void;
  (command: 'event', eventName: string, eventParams?: GtagEventParams): void;
  (command: 'set', params: GtagEventParams): void;
  (command: string, ...args: unknown[]): void;
}

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export {};
