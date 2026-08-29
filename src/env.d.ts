/// <reference path="../.astro/types.d.ts" />

declare global {
  interface Window {
    safeWidth: number;
    safeHeight: number;
  }
}
