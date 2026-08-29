// 事件总线 + rAF 心跳 + App — 对齐 source.js:4240-4290

type Listener = (...args: any[]) => void;
const listeners = new Map<string, Set<Listener>>();

export const $ = {
  on(event: string, fn: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  },
  off(event: string, fn: Listener) {
    listeners.get(event)?.delete(fn);
  },
  once(event: string, fn: Listener) {
    const wrap: Listener = (...args) => { this.off(event, wrap); fn(...args); };
    this.on(event, wrap);
  },
  emit(event: string, ...args: any[]) {
    listeners.get(event)?.forEach(fn => fn(...args));
  },
};

// rAF 心跳：常驻动画（waves 等）订阅用；空闲时自停
const subs = new Set<() => void>();
let rafId = 0;
const loop = () => { subs.forEach(fn => fn()); rafId = subs.size ? requestAnimationFrame(loop) : 0; };

export const ticker = {
  add(fn: () => void) {
    subs.add(fn);
    if (!rafId) rafId = requestAnimationFrame(loop);
    return () => { subs.delete(fn); if (!subs.size && rafId) { cancelAnimationFrame(rafId); rafId = 0; } };
  },
  nextTick(fn: () => void, ctx?: object) { requestAnimationFrame(() => fn.call(ctx ?? null)); },
};

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class App {
  windowWidth?: number;
  windowHeight?: number;
  private timeouts: Record<string, ReturnType<typeof setTimeout>> = {};

  init() {
    if (document.readyState === 'complete') ticker.nextTick(this.onLoaded, this);
    else addEventListener('load', this.onLoaded.bind(this), { once: true });
    addEventListener('resize', this.resizeThrottle.bind(this), { passive: true });
    addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    this.onResize();
  }

  // source:4240 — 点亮 is-loaded，全站入场以此为号
  private onLoaded() {
    document.documentElement.classList.add('is-loaded');
    $.emit('siteLoaded');
  }

  private resizeThrottle() {
    clearTimeout(this.timeouts.resize);
    this.timeouts.resize = setTimeout(this.onResize.bind(this), 200);
  }

  // source:4255 — 宽/高变化标志位随事件抛出
  private onResize() {
    const w = window.innerWidth;
    const wChanged = this.windowWidth !== undefined && this.windowWidth !== w;
    this.windowWidth = w;
    const h = window.innerHeight;
    const hChanged = this.windowHeight !== undefined && this.windowHeight !== h;
    this.windowHeight = h;
    this.setScrollProgress();
    $.emit('resize', wChanged, hChanged);
  }

  private onScroll() {
    this.setScrollProgress();
    ticker.nextTick(() => $.emit('scroll', window.scrollY));
  }

  private setScrollProgress() {
    (window as any).scrollProgress = window.maxScrollTop
      ? window.scrollY / (window as any).maxScrollTop
      : 0;
    (window as any).maxScrollTop = Math.max(0, document.body.scrollHeight - window.innerHeight);
  }
}
