import gsap from 'gsap';
import { $, REDUCED } from './core';

/* P7 CTA：呼吸网格（脉冲波从中心向外跑）+ GO 黑圆 hover 炸开 + Lets Rock 老虎机。
   照源站 bc 类（source.js:5963-6160）移植；脉冲 timeline 用 gsap（项目已有依赖，与源站同）。 */

type GridPoint = {
  x: number; y: number;
  dx: number; dy: number; dist: number;
  vx: number; vy: number; wx: number; wy: number;
  mx: number; my: number; ox: number; oy: number;
};

export class Cta {
  private container!: HTMLElement;
  private hover!: HTMLElement;
  private cta!: HTMLElement;
  private ctaMaxSize = 0;
  private bounding = new DOMRect();
  private grid = {
    bounding: new DOMRect(),
    width: 0,
    height: 0,
    vLines: 0,
    hLines: 0,
    gapX: 0,
    gapY: 0,
    points: [] as GridPoint[][],
    el: null as unknown as HTMLElement,
    svg: null as unknown as SVGElement,
    path: null as unknown as SVGPathElement,
  };
  private wave = {
    progress: 0,
    op: 0,
    speed: 15,
    strength: 1,
    state: 'paused',
    timeout: 0 as unknown as ReturnType<typeof setTimeout>,
  };
  private buttonIsHovered = false;
  private isPaused = true;
  private tl?: gsap.core.Timeline;
  private readonly tickFn = () => this.tick();

  constructor(private el: HTMLElement) {}

  init() {
    this.container = this.el.querySelector('.js-container') as HTMLElement;
    this.hover = this.el.querySelector('.js-hover') as HTMLElement;
    this.cta = this.el.querySelector('.js-cta') as HTMLElement;
    this.grid.el = this.el.querySelector('.js-grid') as HTMLElement;
    this.grid.svg = this.el.querySelector('.js-grid-svg') as unknown as SVGElement;
    this.grid.path = this.el.querySelector('.js-grid-path') as unknown as SVGPathElement;
    this.setSize();
    this.setGrid();
    this.bindEvents();
    if (REDUCED) this.drawLines(); // 静态网格，无脉冲无爆炸
    else this.createPulseTimeline();
  }

  private bindEvents() {
    $.on('resize', () => {
      this.setSize();
      this.setGrid();
      if (REDUCED) this.drawLines();
    });
    this.hover.addEventListener('mouseenter', this.onHover.bind(this));
    this.hover.addEventListener('touchstart', this.onHover.bind(this));
    this.hover.addEventListener('mouseleave', this.onOut.bind(this), { passive: true });
    this.el.addEventListener('touchstart', this.onOut.bind(this), { passive: true });
    this.el.addEventListener('intersect', this.onIntersect.bind(this), { passive: true });
  }

  // core App 的 data-intersect 系统：进视口跑 tick，出视口停
  private onIntersect(e: Event) {
    this.isPaused = !(e as CustomEvent).detail.isIntersecting;
    if (this.isPaused || REDUCED) $.off('tick', this.tickFn);
    else $.on('tick', this.tickFn);
  }

  private onHover(e: Event) {
    if (this.buttonIsHovered || REDUCED) return;
    this.buttonIsHovered = true;
    this.hover.classList.add('is-active');
    this.tl?.pause();
    clearTimeout(this.wave.timeout);
    this.wave.timeout = setTimeout(() => this.waveShock(), 600);
    gsap.to(this.wave, { op: 1, delay: 0.3, duration: 1.2, ease: 'expo.inOut', overwrite: true });
    e.stopPropagation();
  }

  private onOut(e: Event) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'A') {
      window.location.href = (t as HTMLAnchorElement).href;
      return;
    }
    if (!this.buttonIsHovered) return;
    clearTimeout(this.wave.timeout);
    this.buttonIsHovered = false;
    this.hover.classList.remove('is-active');
    this.tl?.play(0);
    gsap.to(this.wave, { op: 0, duration: 0.7, ease: 'expo.inOut', overwrite: true });
  }

  private setSize() {
    this.grid.bounding = this.grid.el.getBoundingClientRect();
    this.bounding = this.container.getBoundingClientRect();
    this.ctaMaxSize = Math.min(this.bounding.width, this.bounding.height) - 32;
    this.cta.style.setProperty('--size', `${this.ctaMaxSize}px`);
  }

  /** 网格节点：13 列 × N 行，径向向量 dx/dy（爆炸方向基数），中心 = container 中点 */
  private setGrid() {
    const { grid } = this;
    const w = this.grid.bounding.width;
    const h = this.grid.bounding.height;
    grid.width = w;
    grid.height = h;
    grid.svg.style.width = `${w}px`;
    grid.svg.style.height = `${h}px`;
    grid.points = [];
    grid.vLines = window.innerWidth > 767 ? 12 : 8;
    grid.gapX = w / grid.vLines;
    grid.gapY = this.bounding.height / 8;
    grid.hLines = Math.floor(h / grid.gapY);
    const rest = h - grid.gapY * grid.hLines;
    const center = { x: w / 2, y: h - this.bounding.height / 2 };
    for (let n = 0; n <= grid.vLines; n++) {
      const col: GridPoint[] = [];
      for (let a = 0; a <= grid.hLines; a++) {
        const p: GridPoint = {
          x: grid.gapX * n,
          y: grid.gapY * a + (a !== 0 ? rest : 0),
          ax: 0, ay: 0, vx: 0, vy: 0, wx: 0, wy: 0, mx: 0, my: 0, ox: 0, oy: 0,
          dx: 0, dy: 0, dist: 0,
        };
        const hx = p.x - center.x;
        const hy = p.y - center.y;
        const ang = Math.atan2(hy, hx);
        p.dist = Math.hypot(hx, hy);
        if (p.dist === 0) { p.dx = 0; p.dy = 0; }
        else {
          p.dx = (Math.cos(ang) * (w / 2)) / p.dist * 5;
          p.dy = (Math.sin(ang) * (w / 2)) / p.dist * 5;
        }
        col.push(p);
      }
      grid.points.push(col);
    }
  }

  /** GO 文字呼吸脉冲（源站 gsap timeline：.85→1.05 2.7s → 触发一圈波 → 回 .85，循环） */
  private createPulseTimeline() {
    const t = this.container.querySelector('.js-button-text') as HTMLElement;
    this.tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
    this.tl.call(() => { this.wave.state = 'pulse'; });
    this.tl.fromTo(t, { scale: 0.85 }, { scale: 1.05, duration: 2.7, ease: 'power2.in' });
    this.tl.call(() => this.wavePulse());
    this.tl.to(t, { scale: 0.85, duration: 0.15, ease: 'power4.out' });
  }

  private movePoints() {
    const { grid, wave } = this;
    const diag = Math.hypot(window.innerHeight, window.innerWidth);
    grid.points.forEach((col) => {
      col.forEach((p, i) => {
        if (i === 0 || p.dist === 0) return;
        const a = Math.abs(p.dist - wave.progress);
        const range = 30;
        if (a < range) {
          const h = 1 - a / range;
          const ang = Math.atan2(p.dy, p.dx);
          const force = Math.cos(a * 0.01) * h;
          p.vx += Math.cos(ang) * force * range * 0.5 * wave.strength;
          p.vy += Math.sin(ang) * force * range * 0.5 * wave.strength;
        }
        p.vx += (0 - p.wx) * 0.001;
        p.vy += (0 - p.wy) * 0.001;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.wx += p.vx * 3;
        p.wy += p.vy * 3;
        p.wx *= 0.9;
        p.wy *= 0.9;
        p.mx = p.wx * 0.1;
        p.my = p.wy * 0.1;
        // 爆炸偏移：径向单位量 × easeOut，op 渐入时生效
        let ox = p.dx / diag;
        let oy = p.dy / diag;
        ox = this.easeOut(ox);
        oy = this.easeOut(oy);
        p.ox = ox * grid.gapX * 75 * (p.dist / this.ctaMaxSize);
        p.oy = oy * grid.gapY * 75 * (p.dist / this.ctaMaxSize);
      });
    });
  }

  private easeOut(t: number) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  private drawLines() {
    const { grid } = this;
    let d = '';
    grid.points.forEach((col) => {
      col.forEach((p, i) => {
        const m = this.movedPoint(p);
        d += i === 0 ? `M ${m.x} ${m.y} ` : `L ${m.x} ${m.y} `;
      });
    });
    for (let i = 0; i < grid.hLines; i++) {
      grid.points.forEach((col, r) => {
        const m = this.movedPoint(col[i]);
        d += r === 0 ? `M ${m.x} ${m.y} ` : `L ${m.x} ${m.y} `;
      });
    }
    grid.path.setAttribute('d', d);
  }

  private movedPoint(p: GridPoint) {
    return { x: p.x + p.mx + p.ox * this.wave.op, y: p.y + p.my + p.oy * this.wave.op };
  }

  private wavePulse() {
    if (this.buttonIsHovered) return;
    const { wave } = this;
    wave.progress = 0;
    wave.state = 'pulse';
    wave.speed = window.innerWidth > 767 ? 15 : 10;
    wave.strength = window.innerWidth > 767 ? 1 : 0.35;
  }

  private waveShock() {
    const { wave } = this;
    if (!this.buttonIsHovered || wave.state === 'shock') return;
    wave.progress = 0;
    wave.state = 'shock';
    wave.speed = 30;
    wave.strength = 5;
  }

  private tick() {
    const { wave } = this;
    if (wave.progress < this.grid.height && wave.state !== 'paused') wave.progress += wave.speed;
    this.movePoints();
    this.drawLines();
  }
}
