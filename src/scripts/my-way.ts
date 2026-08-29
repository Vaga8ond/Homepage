/**
 * P6 my-way：编年体时间线区（source.js xc @5721 + wc 物件类逆向）。
 * 滚动进度 --scroll-progress 驱动 catcher 文字透视错切；笑脸为轴心画放射线；
 * 卡片/星星 3D 物件持续飞升，可拖拽甩出，is-vanishing 后回池。
 */
import { $ } from './core';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/** 源站 16 张 frame 的文案与占位比例（图片未迁移，a__placeholder 斜纹代替） */
const FRAMES: Array<{ title: string; w: number; h: number; struck?: boolean }> = [
  { title: 'Generative art poster concept', w: 1024, h: 1024 },
  { title: 'Generative art poster concept', w: 760, h: 1024 },
  { title: 'Generative art poster concept', w: 802, h: 1024 },
  { title: 'My first FOTD on FWA ♥ (2012)', w: 768, h: 1024 },
  { title: 'Young me discovering the beauty of <s>Grand Canyon</s> Tetris (1997)', w: 600, h: 600, struck: true },
  { title: 'Me abusing of remote work (2005)', w: 768, h: 1024 },
  { title: 'Roaaaar!', w: 576, h: 1024 },
  { title: 'Early age (2006) desk setup', w: 640, h: 480 },
  { title: '2016 desk setup', w: 1024, h: 576 },
  { title: '2020 desk setup', w: 1024, h: 576 },
  { title: 'Waaark Creative Robots', w: 1440, h: 1440 },
  { title: '2011 portfolio', w: 1024, h: 768 },
  { title: '2014 portfolio (767)', w: 1024, h: 768 },
  { title: '2017 portfolio (never released)', w: 1024, h: 768 },
  { title: '2021 portfolio', w: 1024, h: 768 },
  { title: 'Legos ♥', w: 768, h: 1024 },
];

class Line {
  constructor(public x1: number, public y1: number, public x2: number, public y2: number) {}
  get d() { return `M ${this.x1} ${this.y1} L ${this.x2} ${this.y2}`; }
}

class Point {
  constructor(public x: number, public y: number) {}
  get d() { return `M ${this.x - 1} ${this.y} L ${this.x + 1} ${this.y}`; }
}

type ObjState = {
  el: HTMLElement;
  s: number; x: number; y: number; z: number; rx: number; ry: number; rz: number;
  vz: number; vx: number; vy: number; vrx: number; vry: number;
  thrown: boolean; waiting: boolean; grabbed: boolean; vanishing: boolean;
  vanishAt: number;
};

const rnd = (max: number) => Math.random() * max;

export class MyWay {
  private el: HTMLElement;
  private objectsEl: HTMLElement;
  private catcherEl: HTMLElement;
  private smileyEl: HTMLElement;
  private svg: SVGSVGElement;
  private path: SVGPathElement;
  private objects: ObjState[] = [];
  private inView = false;
  private started = false;
  private w = 0; private h = 0; private top = 0;
  private p = 0; private pTarget = 0;
  private mx = -1; private my = -1; private smx = -1; private smy = -1;
  private thrown = 0;
  private maxThrown = 5;
  private nextThrow = 0;
  private last = 0;
  private io?: IntersectionObserver;
  private offs: Array<() => void> = [];
  private destroyFns: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.el = container;
    this.objectsEl = container.querySelector('.js-objects') as HTMLElement;
    this.catcherEl = container.querySelector('.js-catcher') as HTMLElement;
    this.smileyEl = container.querySelector('.js-smiley') as HTMLElement;
    this.svg = container.querySelector('.js-svg') as SVGSVGElement;
    this.path = container.querySelector('.js-lines-circular-path') as SVGPathElement;

    // 物件池：16 frame + 10 star（源站数量）
    this.objectsEl.querySelectorAll<HTMLElement>('.a-object').forEach((el) => {
      this.objects.push({
        el, s: 0, x: 0, y: 0, z: -20000, rx: 90, ry: 0, rz: 0,
        vz: 0, vx: 0, vy: 0, vrx: 0, vry: 0,
        thrown: false, waiting: false, grabbed: false, vanishing: false, vanishAt: 0,
      });
    });

    if (REDUCED.matches) {
      this.el.classList.add('is-reduced');
      return; // 降级：静态线 + catcher 原文，物件不动画
    }
  }

  init() {
    this.io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.start();
    }, { threshold: 0 });
    this.io.observe(this.el);
  }

  private start() {
    if (this.started) return;
    this.started = true;
    this.measure();
    this.drawLines();
    this.firstObjects();
    this.bind();
    this.inView = true;
    this.offs.push($.on('tick', (t?: number) => this.tick(t ?? performance.now())));
    this.offs.push($.on('scroll', () => this.measureProgress()));
    this.offs.push($.on('resize', () => { this.measure(); this.drawLines(); }));
  }

  private bind() {
    const onMove = (x: number, y: number) => { this.mx = x; this.my = y; };
    this.offs.push($.on('mousemove', onMove));

    const down = (e: Event) => {
      const pt = (e as TouchEvent).touches?.[0] ?? (e as MouseEvent);
      const cx = pt.clientX, cy = pt.clientY;
      for (const o of this.objects) {
        if (!o.thrown || o.grabbed) continue;
        const r = o.el.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          o.grabbed = true; o.vanishing = false; o.el.classList.remove('is-vanishing');
          this.thrown--;
          break;
        }
      }
    };
    const move = (e: Event) => {
      const pt = (e as TouchEvent).touches?.[0] ?? (e as MouseEvent);
      for (const o of this.objects) {
        if (!o.grabbed) continue;
        o.vx += (pt.clientX - (o.x - this.top + this.el.offsetTop - scrollY) - o.x) * 0.075;
        o.vx *= 0.9;
        o.vy += (pt.clientY - o.y) * 0.075;
        o.vy *= 0.9;
        o.ry = o.vx * 0.15;
        o.rx = o.vy * -0.15;
      }
      e.preventDefault();
    };
    const up = () => {
      for (const o of this.objects) {
        if (!o.grabbed) continue;
        o.grabbed = false; o.thrown = true; this.thrown++;
        o.vz = 40 + rnd(10);
      }
    };
    addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
    addEventListener('touchstart', down, { passive: true }); addEventListener('touchmove', move, { passive: false }); addEventListener('touchend', up);
    this.destroyFns.push(() => {
      removeEventListener('mousedown', down); removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      removeEventListener('touchstart', down); removeEventListener('touchmove', move); removeEventListener('touchend', up);
    });
  }

  private measure() {
    const r = this.el.getBoundingClientRect();
    this.w = this.el.offsetWidth;
    this.h = this.el.offsetHeight;
    this.top = r.top + scrollY;
    this.measureProgress();
  }

  private measureProgress() {
    const safeH = innerHeight * 0.5;
    const start = this.top;
    const end = this.top + this.h + safeH;
    this.pTarget = Math.min(1, Math.max(0, (scrollY + safeH - start) / (end - start)));
  }

  /** 放射线：笑脸中心 → 顶部竖线 / 左右横排 / 两侧点，+底部整线（射线拓扑为近似重建） */
  private drawLines() {
    const segs: Array<Line | Point> = [];
    const er = this.el.getBoundingClientRect();
    const sr = this.smileyEl.getBoundingClientRect();
    const cx = sr.left - er.left + sr.width / 2;
    const cy = sr.top - er.top + sr.height / 2; // 射线全部汇聚到笑脸中心（源站语义）
    const nV = this.w > 767 ? 12 : 8;
    for (let i = 1; i <= nV; i++) {
      const x = (this.w * i) / (nV + 1);
      segs.push(new Line(cx, cy, x, this.objectsEl.offsetTop));
    }
    for (let j = 1; j <= 10; j++) {
      const y = this.objectsEl.offsetTop + (this.objectsEl.offsetHeight * j) / 11;
      segs.push(new Line(cx, cy, 0, y));
      segs.push(new Line(cx, cy, this.w, y));
      if (j % 3 === 0) { segs.push(new Point(0, y)); segs.push(new Point(this.w, y)); }
    }
    segs.push(new Line(0, this.h - 1, this.w, this.h - 1)); // 底线
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    this.path.setAttribute('d', segs.map((s) => s.d).join(' '));
  }

  /** 初始场内物件：is-waiting + 随机场内位（洗牌让星星也有位） */
  private firstObjects() {
    let n = Math.min(5, Math.max(2, Math.round(innerWidth * 0.025)));
    const pool = [...this.objects];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const o of pool) {
      if (n <= 0) break;
      n--;
      this.reset(o, false);
      o.el.classList.add('is-waiting');
      o.waiting = true; o.s = 1;
      o.x = this.w * (0.15 + Math.random() * 0.7);
      o.y = this.objectsEl.offsetTop + this.objectsEl.offsetHeight * (0.2 + Math.random() * 0.6);
      o.z = -rnd(800); // 视锥内深度场
      o.rx = rnd(90) - 45; o.ry = rnd(90) - 45;
      this.apply(o);
    }
  }
  private reset(o: ObjState, waiting: boolean) {
    const i = this.objects.indexOf(o);
    o.s = 0; o.x = 0; o.y = 0; o.z = -20000; o.rx = 90;
    o.ry = rnd(2) - 1;
    o.vz = 40 + rnd(10);
    o.vx = innerWidth * 0.0025 * (i % 2 ? -1 : 1);
    o.vy = innerHeight * 0.0025 * (i % 3 ? -1 : 1);
    o.vrx = 0.25 + rnd(1); o.vry = 0.25 + rnd(1);
    o.thrown = false; o.waiting = waiting; o.grabbed = false; o.vanishing = false;
    o.el.classList.remove('is-vanishing');
    o.el.classList.toggle('is-waiting', waiting);
    o.el.style.setProperty('--size', String(0.5 + Math.random() * 0.5));
    this.apply(o);
  }

  private apply(o: ObjState) {
    const st = o.el.style;
    st.setProperty('--s', String(o.s));
    st.setProperty('--x', `${o.x}px`);
    st.setProperty('--y', `${o.y}px`);
    st.setProperty('--z', `${o.z}px`);
    st.setProperty('--rx', String(o.rx));
    st.setProperty('--ry', String(o.ry));
  }

  private throwObject(now: number) {
    if (this.thrown >= this.maxThrown || now < this.nextThrow) return;
    const pool = this.objects.filter((o) => !o.thrown && !o.grabbed && !o.vanishing);
    if (!pool.length) return;
    const o = pool[Math.floor(rnd(pool.length))];
    this.reset(o, false);
    o.thrown = true; this.thrown++;
    // 从笑脸中心向前上方抛出（源站语义：物件从笑脸飞向镜头）
    const sr = this.smileyEl.getBoundingClientRect();
    const er = this.el.getBoundingClientRect();
    o.x = sr.left - er.left + sr.width / 2;
    o.y = sr.top - er.top + sr.height / 2;
    o.z = -100; o.s = 0.1;
    this.nextThrow = now + (500 + rnd(500)) * (innerWidth > 767 ? 1.25 : 2);
  }

  private move(o: ObjState) {
    if (o.waiting || o.grabbed) { this.apply(o); return; }
    o.z += o.vz;
    if (!o.grabbed && !o.vanishing) {
      o.x += o.vx; o.y += o.vy;
      o.rx += o.vrx; o.ry += o.vry;
    }
    if (o.vanishing) {
      o.vy += 0.5; o.y += o.vy * 2; o.s = Math.max(0, o.s - 0.03);
    } else if (o.z <= 500) {
      o.s = Math.min(1, o.s + 0.02);
    }
    if (o.z > 1000 || (o.vanishing && o.s <= 0)) {
      o.el.classList.remove('is-vanishing');
      this.reset(o, true);
      if (o.thrown) this.thrown--;
      return;
    }
    this.apply(o);
  }

  private tick(now: number) {
    if (!this.inView && this.p === this.pTarget) return;
    const delta = Math.min(now - this.last, 100);
    this.last = now;
    void delta;

    this.p += (this.pTarget - this.p) * 0.1;
    this.el.style.setProperty('--scroll-progress', String(this.p));
    // catcher 透视错切幅度
    const ch = this.catcherEl.offsetHeight;
    const d = Math.min(0.35, (Math.hypot(this.w, ch / 2) * 0.14) / 1000);
    this.el.style.setProperty('--distortion', d.toFixed(4)); // 剪切系数 m32，配合 px 视距

    if (this.mx >= 0) {
      this.smx += (this.mx - this.smx) * 0.1;
      this.smy += (this.my - this.smy) * 0.1;
    }

    if (this.p > 0.02 && this.p < 0.98) {
      this.throwObject(now);
      for (const o of this.objects) this.move(o);
    }
  }

  destroy() {
    this.io?.disconnect();
    this.offs.forEach((off) => off());
    this.destroyFns.forEach((fn) => fn());
  }
}
