import { $, ticker, REDUCED } from '../core';

type PObj = {
  el: HTMLElement; index: number;
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  vx: number; vy: number; vz: number;
  vrx: number; vry: number;
  s: number;
  isWaiting: boolean; isDragging: boolean; isVanishing: boolean;
  vanishStart: number; vanishDelay: number;
};

export class Playground {
  private el!: HTMLElement;
  private svg!: SVGSVGElement;
  private circularPath!: SVGPathElement;
  private objectsWrapper!: HTMLElement;
  private ruler!: HTMLElement;
  private objects: PObj[] = [];
  private thrown: PObj[] = [];
  private dragged: PObj | null = null;
  private smileyEl!: HTMLElement;
  private smiley = { rel: { x: 0, y: 0 } };
  private lines: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }> = [];
  private bounding: any = {};
  private scroll: any = { start: 0, end: 0, p: 0, sp: 0 };
  private mouse = { x: 0, y: 0, sx: 0, sy: 0, set: false };
  private canThrow = false;
  private lastThrow = 0;
  private throwDelay = 2000;
  private catcher!: HTMLElement;
  private isPaused = true;

  constructor() { ticker.nextTick(this.init, this); }

  private init() {
    this.el = document.querySelector('.s-play') as HTMLElement;
    if (!this.el) return;
    this.svg = this.el.querySelector('.js-svg') as SVGSVGElement;
    this.circularPath = this.el.querySelector('.js-lines-path') as SVGPathElement;
    this.objectsWrapper = this.el.querySelector('.js-objects') as HTMLElement;
    this.ruler = this.el.querySelector('.js-ruler') as HTMLElement;
    this.catcher = this.el.querySelector('.js-catcher') as HTMLElement;
    this.smileyEl = this.el.querySelector('.js-smiley') as HTMLElement;
    Array.from(this.objectsWrapper.children).forEach((el, index) => {
      this.objects.push(this.makeObj(el as HTMLElement, index));
    });
    this.setSize();
    this.setScroll();
    this.setLines();
    this.bindEvents();
    if (!REDUCED) this.firstObjects();
  }

  private makeObj(el: HTMLElement, index: number): PObj {
    return {
      el, index, x: 0, y: 0, z: -2e4, rx: 90, ry: 0, rz: 0,
      vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, s: 0,
      isWaiting: true, isDragging: false, isVanishing: false,
      vanishStart: 0, vanishDelay: 1000,
    };
  }

  private bindEvents() {
    $.on('mousemove', (x: number, y: number) => this.updateMouse(x, y), this);
    $.on('resize', (changed: boolean) => { if (changed) { this.setSize(); this.setScroll(); this.setLines(); } }, this);
    $.on('scroll', (y: number) => this.onScroll(y), this);
    $.on('tick', this.tick, this);
    this.objects.forEach((obj) => {
      obj.el.addEventListener('mousedown', (e) => this.dragStart(e, obj));
      obj.el.addEventListener('touchstart', (e) => this.dragStart(e, obj), { passive: false });
    });
    this.el.addEventListener('mouseup', () => this.dragEnd(), { passive: true });
    this.el.addEventListener('touchend', () => this.dragEnd(), { passive: true });
    this.el.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      this.canThrow = !this.isPaused;
      if (!this.isPaused) this.thrown.forEach((o) => { o.isWaiting = false; o.el.classList.remove('is-waiting'); });
    }, { passive: true });
  }

  private updateMouse(cx: number, cy: number) {
    this.mouse.x = cx - this.bounding.left;
    this.mouse.y = cy + window.scrollY - this.bounding.top;
    if (!this.mouse.set) { this.mouse.sx = this.mouse.x; this.mouse.sy = this.mouse.y; this.mouse.set = true; }
  }

  private setSize() {
    const rect = this.el.getBoundingClientRect();
    this.bounding = { left: rect.left, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
    this.svg.setAttribute('width', this.bounding.width + 'px');
    this.svg.setAttribute('height', this.bounding.height + 'px');
    const sb = this.smileyEl.getBoundingClientRect();
    this.smiley.rel.x = sb.left - rect.left + sb.width / 2;
    this.smiley.rel.y = sb.top - rect.top + sb.height / 2;
    if (this.catcher) {
      this.catcher.style.setProperty('--amplitude', `${this.catcher.offsetHeight}px`);
      this.catcher.style.setProperty('--offset', '0px');
    }
    (this.el as any).style.perspectiveOrigin = `50% ${this.ruler ? this.ruler.offsetTop + this.ruler.offsetHeight : 40}%`;
  }

  private setScroll() {
    const b = this.bounding;
    this.scroll = { start: b.top, end: b.top + b.height + window.safeHeight, p: 0, sp: 0 };
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
    this.lines = [];
    const b = this.bounding;
    const cols = window.safeWidth > 767 ? 12 : 8;
    const gap = b.width / cols;
    for (let c = 0; c <= cols; c++) {
      this.lines.push({ p1: { x: gap * c, y: 0 }, p2: this.smiley.rel });
      this.lines.push({ p1: { x: gap * c, y: b.height }, p2: this.smiley.rel });
    }
    const rows = cols;
    const gapY = b.height / rows;
    const offY = (b.height - gapY * rows) / 2;
    for (let c = 1; c < rows; c++) {
      this.lines.push({ p1: { x: 0, y: offY + gapY * c }, p2: this.smiley.rel });
      this.lines.push({ p1: { x: b.width, y: offY + gapY * c }, p2: this.smiley.rel });
    }
    let d = `M 0 ${b.height} L ${b.width} ${b.height}`;
    this.lines.forEach((l) => { d += `M ${l.p1.x} ${l.p1.y} L ${l.p2.x} ${l.p2.y} `; });
    this.circularPath.setAttribute('d', d);
  }

  private throwObject() {
    if (this.thrown.length < 5 && this.objects.length > 0) {
      const obj = this.objects.splice(Math.floor(Math.random() * this.objects.length), 1)[0];
      this.reset(obj);
      this.thrown.push(obj);
    }
    this.lastThrow = performance.now();
    const mult = window.safeWidth > 767 ? 1 : 1.25;
    this.throwDelay = (500 + Math.random() * 500) * mult;
  }

  private firstObjects() {
    const count = Math.max(Math.min(Math.round(window.safeWidth * .025), 5), 2);
    for (let i = 0; i < count; i++) {
      const obj = this.objects.splice(Math.floor(Math.random() * this.objects.length), 1)[0];
      this.reset(obj, false);
      this.thrown.push(obj);
    }
  }

  private reset(obj: PObj, fromFar = true) {
    obj.el.style.setProperty('--size', String(.5 + Math.random() * .5));
    obj.s = 0; obj.x = 0; obj.y = 0; obj.z = fromFar ? -2e4 : Math.random() * -2e4;
    obj.rx = fromFar ? 90 : Math.random() * 360;
    obj.ry = Math.random() * 2 - 1; obj.rz = 0;
    obj.vz = 40 + Math.random() * 10;
    obj.vx = Math.random() * window.safeWidth * .0025 * (obj.index % 2 ? -1 : 1);
    obj.vy = Math.random() * window.safeHeight * .0025 * (obj.index % 3 ? -1 : 1);
    obj.vrx = .25 + Math.random(); obj.vry = .25 + Math.random();
    obj.isWaiting = false; obj.isDragging = false; obj.isVanishing = false;
    obj.el.classList.remove('is-waiting', 'is-dragging', 'is-vanishing');
    obj.vanishStart = 0;
    if (!fromFar) {
      obj.s = 1;
      obj.x = obj.vx * Math.random() * 200;
      obj.y = obj.vy * Math.random() * 200;
      obj.ry = Math.random() * 360;
    }
    obj.el.style.setProperty('--s', String(obj.s));
  }

  private dragStart(e: Event, obj: PObj) {
    e.preventDefault();
    if (obj.isDragging || obj.isVanishing || !this.thrown.includes(obj)) return;
    this.dragged = obj;
    obj.isDragging = true;
    obj.el.classList.add('is-dragging');
  }

  private dragEnd() {
    const obj = this.dragged;
    if (!obj) return;
    obj.isDragging = false;
    obj.el.classList.remove('is-dragging');
    obj.isVanishing = true;
    obj.el.classList.add('is-vanishing');
    obj.vanishStart = performance.now();
    this.dragged = null;
  }

  private recycle(obj: PObj) {
    obj.isWaiting = true;
    obj.el.classList.add('is-waiting');
    obj.el.classList.remove('is-vanishing');
    this.thrown.splice(this.thrown.indexOf(obj), 1);
    this.objects.push(obj);
  }

  private tick(t: number) {
    const f = Math.min(2, (ticker.delta || 16.7) / 16.7);
    this.mouse.sx += (this.mouse.x - this.mouse.sx) * .1;
    this.mouse.sy += (this.mouse.y - this.mouse.sy) * .1;
    this.scroll.sp += (this.scroll.p - this.scroll.sp) * .1;
    this.el.style.setProperty('--scroll-progress', String(this.scroll.sp));
    this.thrown.forEach((obj) => this.moveObj(obj, t, f));
    if (!this.isPaused && this.canThrow && !REDUCED && t - this.lastThrow > this.throwDelay) this.throwObject();
  }

  private moveObj(obj: PObj, t: number, f: number) {
    if (obj.isWaiting) return;
    if (obj.isDragging) {
      const tx = this.mouse.x - this.smiley.rel.x;
      const ty = this.mouse.y - this.smiley.rel.y * 1.5;
      obj.vx += (tx - obj.x) * .075 * f;
      obj.vy += (ty - obj.y) * .075 * f;
      obj.vz += (0 - obj.z) * .3 * f;
      obj.ry = obj.vx * .15;
      obj.rx = obj.vy * -.15;
      obj.rz = obj.ry + obj.rx;
      obj.vx *= .9; obj.vy *= .9; obj.vz *= .75;
      obj.x += obj.vx * .5 * f;
      obj.y += obj.vy * .5 * f;
      obj.z += obj.vz * .25 * f;
      obj.z = Math.min(obj.z, 500);
      obj.s += (1 - obj.s) * .5;
    } else if (obj.isVanishing) {
      obj.vy += .5 * f;
      obj.x += obj.vx * f; obj.y += obj.vy * f;
      obj.rx += obj.vrx * f; obj.ry += obj.vry * f;
      if (t - obj.vanishStart > obj.vanishDelay) this.recycle(obj);
    } else if (obj.z > 1e3) {
      this.recycle(obj);
    } else {
      obj.s = Math.min(obj.s + .005 * f, 1);
      obj.z += obj.vz * f;
      obj.x += obj.vx * f; obj.y += obj.vy * f;
      obj.rx += obj.vrx * f; obj.ry += obj.vry * f;
    }
    const st = obj.el.style;
    st.setProperty('--x', obj.x + 'px');
    st.setProperty('--y', obj.y + 'px');
    st.setProperty('--z', obj.z + 'px');
    st.setProperty('--rx', String(obj.rx));
    st.setProperty('--ry', String(obj.ry));
    st.setProperty('--rz', String(obj.rz));
    st.setProperty('--s', String(obj.s));
  }
}
