import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const REDUCED = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Event bus ---------- */
type Ctx = object | undefined;
export class Bus {
  private events: Record<string, Array<{ cb: Function; context?: Ctx; once?: boolean }>> = {};
  on(name: string, cb: Function, context?: Ctx, once = false) {
    (this.events[name] || (this.events[name] = []));
    const list = this.events[name];
    if (!list.some((e) => e.cb === cb && e.context === context)) list.push({ cb, context, once });
  }
  once(name: string, cb: Function, context?: Ctx) { this.on(name, cb, context, true); }
  off(name: string, cb: Function, context?: Ctx) {
    const list = this.events[name];
    if (list) this.events[name] = list.filter((e) => !(e.cb === cb && e.context === context));
  }
  emit(name: string, ...args: any[]) {
    const list = this.events[name];
    if (!list) return;
    list.forEach((e, i) => {
      e.cb.apply(e.context, args);
      if (e.once) delete list[i];
    });
  }
}
export const $ = new Bus();

/* ---------- Ticker (single rAF source for the whole site) ---------- */
class Ticker {
  private callbacks: Array<{ cb: Function; context?: Ctx }> = [];
  delta = 0;
  init() {
    gsap.ticker.add((time, deltaTime) => {
      this.delta = deltaTime;
      const cbs = this.callbacks;
      this.callbacks = [];
      cbs.forEach((c) => c.cb.apply(c.context));
      $.emit('tick', time * 1000);
    });
  }
  nextTick(cb: Function, context?: Ctx) { this.callbacks.push({ cb, context }); }
}
export const ticker = new Ticker();

/* ---------- App: globals, viewport, intersect dispatcher ---------- */
declare global {
  interface Window {
    safeWidth: number; safeHeight: number; maxScrollTop: number; scrollProgress: number;
    lenis?: Lenis;
  }
}

export class App {
  private lenis!: Lenis;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  private windowWidth?: number;
  private windowHeight?: number;
  private io: IntersectionObserver | null = null;

  constructor() {
    const ua = navigator.userAgent;
    const os = ua.includes('Win') ? 'windows' : ua.includes('Android') ? 'android' : ua.includes('Mac') ? 'mac' : ua.includes('Linux') ? 'linux' : 'unknown';
    const br = ua.includes('Firefox') ? 'firefox' : ua.includes('Chrome') ? 'chrome' : ua.includes('Safari') ? 'safari' : 'unknown';
    document.documentElement.classList.add(`is-${os}`, `is-${br}`, 'has-cursor');
    this.bindEvents();
  }

  init() {
    this.initLenis();
    ticker.init();
    this.onResize();
    ticker.nextTick(this.intro, this);
  }

  private initLenis() {
    this.lenis = new Lenis({ autoRaf: false });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => this.lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.lenis = this.lenis;
    REDUCED && this.lenis.start();
    if (!REDUCED) this.lenis.stop();
  }

  unlockScroll() { this.lenis?.start(); }

  private bindEvents() {
    window.addEventListener('resize', () => {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => ticker.nextTick(this.onResize, this), 200);
    }, { passive: true });
    window.addEventListener('scroll', () => {
      this.setScrollProgress();
      ticker.nextTick(() => $.emit('scroll', window.scrollY));
    }, { passive: true });
    window.addEventListener('mousemove', (e) => $.emit('mousemove', e.clientX, e.clientY), { passive: true });

    this.io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.dispatchEvent(new CustomEvent('intersect', { detail: { isIntersecting: entry.isIntersecting } }));
        entry.target.classList.toggle('is-in-view', entry.isIntersecting);
        if (entry.isIntersecting) entry.target.classList.remove('is-out-of-view', 'is-out-of-view-top', 'is-out-of-view-bottom');
        else {
          entry.target.classList.add('is-out-of-view');
          entry.target.classList.toggle('is-out-of-view-top', entry.boundingClientRect.top < 0);
          entry.target.classList.toggle('is-out-of-view-bottom', entry.boundingClientRect.top > 0);
        }
      });
    }, { threshold: 0 });
    document.querySelectorAll('[data-intersect]').forEach((el) => this.io!.observe(el));

    if (document.readyState === 'complete') this.siteLoaded();
    else window.addEventListener('load', () => this.siteLoaded(), { once: true });
    this.onResize();
  }

  private siteLoaded() {
    document.documentElement.classList.add('is-loaded');
    $.emit('siteLoaded');
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const wChanged = this.windowWidth !== undefined && this.windowWidth !== w;
    const hChanged = this.windowHeight !== undefined && this.windowHeight !== h;
    this.windowWidth = w; this.windowHeight = h;
    window.safeWidth = w; window.safeHeight = h;
    window.maxScrollTop = Math.max(0, document.body.scrollHeight - h);
    this.setScrollProgress();
    $.emit('resize', wChanged, hChanged);
    $.emit('updateViewport');
  }

  private setScrollProgress() {
    window.scrollProgress = window.maxScrollTop > 0 ? window.scrollY / window.maxScrollTop : 0;
  }

  private intro() {
    $.emit('appIntro');
  }
}
