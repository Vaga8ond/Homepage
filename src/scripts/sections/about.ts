import { $, ticker, REDUCED } from '../core';

const SMILEY_MAIN = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#f40c3f'/><circle cx='17' cy='20' r='3.2' fill='#160000'/><circle cx='31' cy='20' r='3.2' fill='#160000'/><path d='M14 30q10 9 20 0' stroke='#160000' stroke-width='3.4' fill='none' stroke-linecap='round'/></svg>`);
const SMILEY_CONTRASTED = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#fff2ed'/><circle cx='17' cy='20' r='3.2' fill='#160000'/><circle cx='31' cy='20' r='3.2' fill='#160000'/><path d='M14 30q10 9 20 0' stroke='#160000' stroke-width='3.4' fill='none' stroke-linecap='round'/></svg>`);

class Smiley {
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  width = 48; height = 48;
  x: number; y: number;
  r = 0; a: number; va: number; vx: number; vy: number; vr: number;
  constructor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number) {
    this.ctx = ctx; this.image = image; this.x = x; this.y = y;
    this.a = .25 + Math.random() * .75;
    this.vx = (Math.random() * 2 - 1) * 5;
    this.vy = Math.random() * -10 - 5;
    this.vr = (Math.random() * 2 - 1) * 10;
    this.va = Math.random() * .01;
  }
  move() {
    this.vy += .45;
    this.x += this.vx; this.y += this.vy;
    this.r += this.vr; this.a += this.va;
  }
  draw() {
    const c = this.ctx;
    c.save();
    c.translate(this.x + this.width * .5 * this.a, this.y + this.height * .5 * this.a);
    c.rotate(this.r * Math.PI / 180);
    c.translate(-this.x - this.width * .5 * this.a, -this.y - this.height * .5 * this.a);
    c.drawImage(this.image, this.x, this.y, this.width * this.a, this.height * this.a);
    c.restore();
  }
}

type Pt = { x: number; y: number };

export class About {
  private el!: HTMLElement;
  private inner!: HTMLElement;
  private svg!: SVGSVGElement;
  private path!: SVGPathElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private awards!: NodeListOf<HTMLElement>;
  private smileyImages: Record<string, HTMLImageElement> = {};
  private bounding: any = {};
  private scroll: any = { start: 0, end: 0, p: 0, sp: 0 };
  private lines: Array<[Pt, Pt]> = [];
  private smileys: Smiley[] = [];
  private isPaused = true;
  private isForced = false;

  constructor() {
    ticker.nextTick(this.init, this);
  }

  private init() {
    this.el = document.querySelector('.s-about') as HTMLElement;
    if (!this.el) return;
    this.inner = this.el.querySelector('.js-inner') as HTMLElement;
    this.svg = this.el.querySelector('.js-grid') as SVGSVGElement;
    this.path = this.el.querySelector('.js-path') as SVGPathElement;
    this.canvas = this.el.querySelector('.js-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.awards = this.el.querySelectorAll('.js-award');
    this.createSmileys();
    this.setSize();
    this.setScroll();
    this.setLines();
    this.bindEvents();
    if (REDUCED) return;
    if (this.el.classList.contains('is-in-view')) {
      this.isPaused = false;
      $.on('tick', this.tick, this);
    }
  }

  private createSmileys() {
    const main = new Image(100, 100); main.src = SMILEY_MAIN;
    const contrasted = new Image(100, 100); contrasted.src = SMILEY_CONTRASTED;
    this.smileyImages = { main, contrasted };
  }

  private bindEvents() {
    $.on('resize', (changed: boolean) => { if (changed) { this.setSize(); this.setScroll(); this.isForced = true; } }, this);
    $.on('scroll', (y: number) => this.onScroll(y), this);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); } });
    }, { threshold: .5 });
    this.awards.forEach((award) => {
      io.observe(award);
      const handler = () => this.onAwardInteraction(award);
      award.addEventListener('mouseenter', handler, { passive: true });
      award.addEventListener('touchstart', handler, { passive: true });
    });
    this.el.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      if (this.isPaused || REDUCED) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
  }

  private setSize() {
    const rect = this.el.getBoundingClientRect();
    this.bounding = {
      left: rect.left, top: rect.top,
      width: this.el.clientWidth, height: this.el.clientHeight,
      innerWidth: this.inner.clientWidth, innerHeight: this.inner.clientHeight,
      offsetY: this.bounding.offsetY || 0,
    };
    this.svg.setAttribute('width', `${this.bounding.width}px`);
    this.svg.setAttribute('height', `${this.bounding.height}px`);
    this.canvas.width = this.bounding.width;
    this.canvas.height = this.bounding.height;
  }

  private setScroll() {
    const b = this.bounding;
    this.scroll = { start: b.top + window.scrollY, end: b.top + window.scrollY + b.height + window.safeHeight, p: 0, sp: 0 };
    this.onScroll(window.scrollY);
    this.scroll.sp = this.scroll.p;
  }

  private onScroll(y: number) {
    const s = this.scroll;
    const i = y + window.safeHeight;
    if (i < s.start) s.p = 0;
    else if (i > s.end) s.p = 1;
    else s.p = (i - s.start) / (s.end - s.start);
  }

  private setLines() {
    const b = this.bounding;
    this.lines = [];
    const e = (b.width - b.innerWidth) / 2;
    const i = (b.height - b.innerHeight) / 2 + b.offsetY;
    const cols = window.safeWidth > 767 ? 12 : 8;
    const rows = 4;
    const n = b.width / cols, o = b.height / cols;
    const a = b.innerWidth / cols, l = b.innerHeight / cols;
    const h = 1 / rows;
    const outer = { x1: 0, x2: b.width, y1: 0, y2: b.height };
    const inner = { x1: e, x2: e + b.innerWidth, y1: i, y2: i + b.innerHeight };
    const corners: Array<[Pt, Pt]> = [
      [{ x: outer.x1, y: outer.y1 }, { x: inner.x1, y: inner.y1 }],
      [{ x: outer.x2, y: outer.y1 }, { x: inner.x2, y: inner.y1 }],
      [{ x: outer.x2, y: outer.y2 }, { x: inner.x2, y: inner.y2 }],
      [{ x: outer.x1, y: outer.y2 }, { x: inner.x1, y: inner.y2 }],
    ];
    for (let g = 1; g < cols; g++) {
      this.lines.push([{ x: n * g, y: outer.y1 }, { x: e + a * g, y: inner.y1 }]);
      this.lines.push([{ x: n * g, y: outer.y2 }, { x: e + a * g, y: inner.y2 }]);
    }
    const interp = (c1: [Pt, Pt], c2: [Pt, Pt], d: number): [Pt, Pt] => [
      { x: c1[0].x + (c1[1].x - c1[0].x) * d, y: c1[0].y + (c1[1].y - c1[0].y) * d },
      { x: c2[0].x + (c2[1].x - c2[0].x) * d, y: c2[0].y + (c2[1].y - c2[0].y) * d },
    ];
    for (let g = 1; g < rows; g++) {
      const d = 1 - Math.pow(1 - h * g, 2);
      this.lines.push(interp(corners[0], corners[1], d));
      this.lines.push(interp(corners[3], corners[2], d));
    }
    for (let g = 0; g <= cols; g++) {
      this.lines.push([{ x: outer.x1, y: o * g }, { x: inner.x1, y: i + l * g }]);
      this.lines.push([{ x: outer.x2, y: o * g }, { x: inner.x2, y: i + l * g }]);
    }
    for (let g = 1; g < rows; g++) {
      const d = 1 - Math.pow(1 - h * g, 2);
      this.lines.push(interp(corners[1], corners[2], d));
      this.lines.push(interp(corners[0], corners[3], d));
    }
    this.drawLines();
  }

  private drawLines() {
    let d = '';
    this.lines.forEach(([p1, p2]) => { d += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `; });
    this.path.setAttribute('d', d);
  }

  private onAwardInteraction(award: HTMLElement) {
    if (REDUCED) return;
    award.classList.add('is-active');
    this.throwSmileys(award);
    setTimeout(() => award.classList.remove('is-active'), 100);
  }

  private throwSmileys(award: HTMLElement) {
    const img = document.documentElement.classList.contains('theme-contrasted') ? this.smileyImages.contrasted : this.smileyImages.main;
    const eb = this.el.getBoundingClientRect();
    const ab = award.getBoundingClientRect();
    const x = ab.left + ab.width * .5 - eb.left;
    const y = ab.top + ab.height * .5 - eb.top;
    const count = window.safeWidth > 767 ? 10 : 5;
    for (let i = 0; i < count; i++) this.smileys.push(new Smiley(this.ctx, img, x, y));
  }

  private tick() {
    const b = this.bounding;
    this.scroll.sp += (this.scroll.p - this.scroll.sp) * .2;
    const diff = Math.round((this.scroll.p - this.scroll.sp) * 1e3) / 1e3;
    b.offsetY = (window.safeWidth > 767 ? 400 : 200) * (this.scroll.sp * 2 - 1);
    this.inner.style.setProperty('--offset-y', `${b.offsetY}px`);
    if (diff !== 0 || this.isForced) { this.setLines(); this.isForced = false; }
    if (this.smileys.length) {
      this.smileys.forEach((s) => { s.move(); if (s.y > b.height) this.smileys.splice(this.smileys.indexOf(s), 1); });
      this.ctx.clearRect(0, 0, b.width, b.height);
      this.smileys.forEach((s) => s.draw());
    }
  }
}
