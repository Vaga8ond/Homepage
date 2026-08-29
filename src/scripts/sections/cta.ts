import { gsap } from 'gsap';
import { $, ticker, REDUCED } from '../core';

type GPoint = {
  x: number; y: number;
  ax: number; ay: number; vx: number; vy: number;
  wx: number; wy: number; mx: number; my: number;
  ox: number; oy: number; dx: number; dy: number; dist: number;
};

export class Cta {
  private el!: HTMLElement;
  private container!: HTMLElement;
  private hover!: HTMLElement;
  private cta!: HTMLElement;
  private gridEl!: HTMLElement;
  private svg!: SVGSVGElement;
  private path!: SVGPathElement;
  private bounding: any = {};
  private grid: any = { width: 0, height: 0, vLines: 0, hLines: 0, gapX: 0, gapY: 0, points: [] as GPoint[][] };
  private wave = { progress: 0, op: 0, speed: 15, strength: 1, state: 'paused', timeout: 0 };
  private buttonIsHovered = false;
  private isPaused = true;
  private tl?: gsap.core.Timeline;

  constructor() { ticker.nextTick(this.init, this); }

  private init() {
    this.el = document.querySelector('.s-cta') as HTMLElement;
    if (!this.el) return;
    this.container = this.el.querySelector('.js-container') as HTMLElement;
    this.hover = this.el.querySelector('.js-hover') as HTMLElement;
    this.cta = this.el.querySelector('.js-cta') as HTMLElement;
    this.gridEl = this.el.querySelector('.js-grid') as HTMLElement;
    this.svg = this.el.querySelector('.js-grid-svg') as SVGSVGElement;
    this.path = this.el.querySelector('.js-grid-path') as SVGPathElement;
    this.setSize();
    this.setGrid();
    this.bindEvents();
    if (REDUCED) { this.drawLines(); return; }
    this.createPulseTimeline();
  }

  private bindEvents() {
    $.on('resize', (changed: boolean) => { if (changed) { this.setSize(); this.setGrid(); } }, this);
    this.hover.addEventListener('mouseenter', (e) => this.onHover(e));
    this.hover.addEventListener('touchstart', (e) => this.onHover(e), { passive: true });
    this.hover.addEventListener('mouseleave', (e) => this.onOut(e), { passive: true });
    this.el.addEventListener('touchstart', (e) => this.onOut(e), { passive: true });
    this.el.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      if (this.isPaused || REDUCED) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
  }

  private onHover(e: Event) {
    if (this.buttonIsHovered) return;
    this.buttonIsHovered = true;
    this.hover.classList.add('is-active');
    this.tl?.pause();
    clearTimeout(this.wave.timeout);
    this.wave.timeout = setTimeout(() => this.waveShock(), 600) as unknown as number;
    gsap.to(this.wave, { op: 1, delay: .3, duration: 1.2, ease: 'expo.inOut', overwrite: true });
    e.stopPropagation();
  }

  private onOut(e: Event) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') return;
    if (!this.buttonIsHovered) return;
    clearTimeout(this.wave.timeout);
    this.buttonIsHovered = false;
    this.hover.classList.remove('is-active');
    this.tl?.play(0);
    gsap.to(this.wave, { op: 0, duration: .7, ease: 'expo.inOut', overwrite: true });
  }

  private setSize() {
    const gb = this.gridEl.getBoundingClientRect();
    this.grid.width = gb.width; this.grid.height = gb.height;
    this.svg.setAttribute('width', gb.width + 'px');
    this.svg.setAttribute('height', gb.height + 'px');
    const cb = this.container.getBoundingClientRect();
    this.bounding = { width: cb.width, height: cb.height };
    const size = Math.min(cb.width, cb.height) - 32;
    this.cta.style.setProperty('--size', size + 'px');
  }

  private setGrid() {
    const g = this.grid;
    g.points = [];
    g.vLines = window.safeWidth > 767 ? 12 : 8;
    g.gapX = g.width / g.vLines;
    g.gapY = this.bounding.height / 8;
    g.hLines = Math.floor(g.height / g.gapY);
    const offY = g.height - g.gapY * g.hLines;
    const center = { x: g.width / 2, y: g.height - this.bounding.height / 2 };
    for (let c = 0; c <= g.vLines; c++) {
      const col: GPoint[] = [];
      for (let r = 0; r <= g.hLines; r++) {
        const p: GPoint = {
          x: g.gapX * c, y: g.gapY * r + (r !== 0 ? offY : 0),
          ax: 0, ay: 0, vx: 0, vy: 0, wx: 0, wy: 0, mx: 0, my: 0,
          ox: 0, oy: 0, dx: 0, dy: 0, dist: 0,
        };
        const ddx = p.x - center.x, ddy = p.y - center.y;
        const angle = Math.atan2(ddy, ddx);
        p.dist = Math.hypot(ddx, ddy);
        if (p.dist === 0) { p.dx = 0; p.dy = 0; }
        else {
          p.dx = Math.cos(angle) * (g.width / 2 / p.dist) * 5;
          p.dy = Math.sin(angle) * (g.width / 2 / p.dist) * 5;
        }
        col.push(p);
      }
      g.points.push(col);
    }
  }

  private createPulseTimeline() {
    const text = this.container.querySelector('.js-button-text');
    this.tl = gsap.timeline({ repeat: -1, repeatDelay: .5 });
    this.tl.call(() => { this.wave.state = 'pulse'; });
    this.tl.fromTo(text, { scale: .85 }, { scale: 1.05, duration: 2.7, ease: 'power2.in' });
    this.tl.call(() => this.wavePulse());
    this.tl.to(text, { scale: .85, duration: .15, ease: 'power4.out' });
  }

  private wavePulse() {
    if (this.buttonIsHovered) return;
    this.wave.progress = 0;
    this.wave.state = 'pulse';
    this.wave.speed = window.safeWidth > 767 ? 15 : 10;
    this.wave.strength = window.safeWidth > 767 ? 1 : .35;
  }

  private waveShock() {
    if (!this.buttonIsHovered || this.wave.state === 'shock') return;
    this.wave.progress = 0;
    this.wave.state = 'shock';
    this.wave.speed = 30;
    this.wave.strength = 5;
  }

  private movePoints() {
    const g = this.grid, w = this.wave;
    g.points.forEach((col: GPoint[]) => col.forEach((p, ri) => {
      if (ri === 0 || p.dist === 0) return;
      const diff = Math.abs(p.dist - w.progress);
      const band = 30;
      if (diff < band) {
        const k = 1 - diff / band;
        const angle = Math.atan2(p.dy, p.dx);
        const env = Math.cos(diff * .01) * k;
        p.vx += Math.cos(angle) * env * band * .5 * w.strength;
        p.vy += Math.sin(angle) * env * band * .5 * w.strength;
      }
      p.vx += -p.wx * .001; p.vy += -p.wy * .001;
      p.vx *= .9; p.vy *= .9;
      p.wx += p.vx * 3; p.wy += p.vy * 3;
      p.wx *= .9; p.wy *= .9;
      p.mx = p.wx * .1; p.my = p.wy * .1;
      const norm = Math.hypot(window.safeHeight, window.safeWidth);
      p.ox = this.easeOut(p.dx / norm);
      p.oy = this.easeOut(p.dy / norm);
      const size = Math.min(this.bounding.width, this.bounding.height) - 32;
      p.ox *= g.gapX * 75 * (p.dist / size);
      p.oy *= g.gapY * 75 * (p.dist / size);
    }));
  }

  private easeOut(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  private movedPoint(p: GPoint) {
    return { x: p.x + p.mx + p.ox * this.wave.op, y: p.y + p.my + p.oy * this.wave.op };
  }

  private drawLines() {
    const g = this.grid;
    let d = '';
    g.points.forEach((col: GPoint[]) => {
      col.forEach((p, ri) => {
        const m = this.movedPoint(p);
        d += (ri === 0 ? 'M' : 'L') + m.x + ' ' + m.y + ' ';
      });
    });
    for (let r = 0; r < g.hLines; r++) {
      g.points.forEach((col: GPoint[], ci) => {
        const m = this.movedPoint(col[r]);
        d += (ci === 0 ? 'M' : 'L') + m.x + ' ' + m.y + ' ';
      });
    }
    this.path.setAttribute('d', d);
  }

  private tick() {
    const w = this.wave;
    if (w.progress < this.grid.height && w.state !== 'paused') w.progress += w.speed;
    this.movePoints();
    this.drawLines();
  }
}
