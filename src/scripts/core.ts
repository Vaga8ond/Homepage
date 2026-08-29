// 事件总线 + rAF 心跳 + App — 对齐 source.js:4240-4290

type Listener = (...args: any[]) => void;
type Entry = { fn: Listener; ctx?: unknown };
const listeners = new Map<string, Set<Entry>>();

export const $ = {
  on(event: string, fn: Listener, ctx?: unknown) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add({ fn, ctx });
  },
  off(event: string, fn: Listener, ctx?: unknown) {
    const list = listeners.get(event);
    if (!list) return;
    for (const e of list) if (e.fn === fn && (ctx === undefined || e.ctx === ctx)) list.delete(e);
  },
  once(event: string, fn: Listener, ctx?: unknown) {
    const wrap: Listener = (...args) => { this.off(event, wrap); fn.apply(ctx ?? null, args); };
    this.on(event, wrap);
  },
  emit(event: string, ...args: any[]) {
    listeners.get(event)?.forEach(e => e.fn.apply(e.ctx ?? null, args));
  },
};

// rAF 心跳：常驻动画（waves 等）订阅用；空闲时自停
const subs = new Set<(t: number) => void>();
let rafId = 0;
const loop = () => { const t = performance.now(); subs.forEach(fn => fn(t)); rafId = subs.size ? requestAnimationFrame(loop) : 0; };

export const ticker = {
  add(fn: (t: number) => void) {
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
    this.initIntersect();
    if (document.readyState === 'complete') ticker.nextTick(this.onLoaded, this);
    else addEventListener('load', this.onLoaded.bind(this), { once: true });
    addEventListener('resize', this.resizeThrottle.bind(this), { passive: true });
    addEventListener('mousemove', (e: MouseEvent) => $.emit('mousemove', e.clientX, e.clientY), { passive: true });
    ticker.add((t: number) => $.emit('tick', t));
    addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    this.onResize();
  }

  // source:4217 — data-intersect 观察：派发 intersect 事件 + is-in/out-of-view 类
  private initIntersect() {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.dispatchEvent(new CustomEvent('intersect', { detail: { isIntersecting: entry.isIntersecting } }));
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in-view');
          entry.target.classList.remove('is-out-of-view', 'is-out-of-view-top', 'is-out-of-view-bottom');
        } else {
          entry.target.classList.remove('is-in-view');
          entry.target.classList.add('is-out-of-view');
          entry.target.classList.toggle('is-out-of-view-top', entry.boundingClientRect.top < 0);
          entry.target.classList.toggle('is-out-of-view-bottom', entry.boundingClientRect.top > 0);
        }
      }
    }, { threshold: 0 });
    document.querySelectorAll('[data-intersect]').forEach(el => observer.observe(el));
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
    (window as any).safeWidth = w;
    (window as any).safeHeight = h;
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
