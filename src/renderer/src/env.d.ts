/// <reference types="vite/client" />

import type { GlimpseApi } from '../../preload/index';

declare global {
  interface Window {
    glimpse: GlimpseApi;
  }
}

export {};
