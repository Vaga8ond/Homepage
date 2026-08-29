import Lenis from 'lenis';
import { ticker, REDUCED } from './core';

// 滚动惯性（源站同款 Lenis 1.1.13）：lerp 越小越"飘"，0.1 = 源站级手感。
// REDUCED 不接管——reduced 用户保持原生滚动。
// ponytail: 只用默认 wheel 劫持，syncTouch 保持 false（触屏原生，P8.3 再看）。
export const lenis = REDUCED ? null : new Lenis({ lerp: 0.1 });
if (lenis) ticker.add(() => lenis.raf(performance.now()));
