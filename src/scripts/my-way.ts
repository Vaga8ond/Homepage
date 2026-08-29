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
    this.smileyEl = container.querySelector('.js-smiley') as HTMLElement;
    this.svg = container.querySelector('.js-svg') as SVGSVGElement;
    this.path = container.querySelector('.js-lines-circular-path') as SVGPathElement;

    // 物件池：16 frame + 10 star（源站数量）；初始全部 waiting（display:none 不渲染）
    this.objectsEl.querySelectorAll<HTMLElement>('.a-object').forEach((el) => {
      el.classList.add('is-waiting');
      this.objects.push({
        el, s: 0, x: 0, y: 0, z: -20000, rx: 90, ry: 0, rz: 0,
        vz: 0, vx: 0, vy: 0, vrx: 0, vry: 0,
        thrown: false, waiting: true, grabbed: false, vanishing: false, vanishAt: 0,
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
        if (o.waiting || o.grabbed || o.vanishing) continue;
        const r = o.el.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          o.grabbed = true;
          o.el.classList.add('is-dragging');
          break;
        }
      }
    };
    const move = (e: Event) => {
      const pt = (e as TouchEvent).touches?.[0] ?? (e as MouseEvent);
      this.mx = pt.clientX; this.my = pt.clientY;
      if (this.objects.some((o) => o.grabbed)) e.preventDefault();
    };
    // 源站 objectDragEnd：松手即 is-vanishing（重坠下坠，1s 后回池），不是甩飞重抛
    const up = () => {
      for (const o of this.objects) {
        if (!o.grabbed) continue;
        o.grabbed = false;
        o.vanishing = true;
        o.vy = 0;
        o.vanishAt = performance.now() + 1000;
        o.el.classList.remove('is-dragging');
        o.el.classList.add('is-vanishing');
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

  /** 放射线：源站 setLines（source.js:5803）——顶部 s+1 条 + 底部 s+1 条 + 左右各 s-1 条 + 底线，全连笑脸中心 */
  private drawLines() {
    const segs: Line[] = [];
    const er = this.el.getBoundingClientRect();
    const sr = this.smileyEl.getBoundingClientRect();
    const cx = sr.left - er.left + sr.width / 2;
    const cy = sr.top - er.top + sr.height / 2;
    const s = this.w > 767 ? 12 : 8;
    const r = this.w / s;
    for (let c = 0; c <= s; c++) {
      segs.push(new Line(cx, cy, r * c, 0));
      segs.push(new Line(cx, cy, r * c, this.h));
    }
    const l = this.h / s;
    const gap = (this.h - l * s) / 2;
    for (let c = 1; c < s; c++) {
      segs.push(new Line(cx, cy, 0, gap + l * c));
      segs.push(new Line(cx, cy, this.w, gap + l * c));
    }
    segs.push(new Line(0, this.h, this.w, this.h)); // 底线
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    this.path.setAttribute('d', segs.map((p) => p.d).join(' '));
    // 源站 5833：巨字错切幅度 --distortion = hypot(width, (height-smileyY)/2) * .14
    this.el.style.setProperty('--distortion', (Math.hypot(this.w, (this.h - cy) / 2) * 0.14).toFixed(4));
  }

  /** 初始飞行物：源站 firstObjects——从池里取 n 个直接设为飞行态（z=-2e4 深处飞来），非 waiting */
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
      o.x = o.vx * rnd(200);
      o.y = o.vy * rnd(200);
      o.rx = rnd(360); o.ry = rnd(360);
      o.z = -rnd(20000);
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
    st.setProperty('--rz', String(o.rz));
  }

  private throwObject(now: number) {
    if (this.thrown >= this.maxThrown || now < this.nextThrow) return;
    const pool = this.objects.filter((o) => o.waiting);
    if (!pool.length) return;
    const o = pool[Math.floor(rnd(pool.length))];
    this.reset(o, false);
    o.thrown = true; this.thrown++;
    // 源站 set()：z=-2e4 从深处飞来，非从笑脸抛出
    o.z = -20000;
    this.nextThrow = now + (500 + rnd(500)) * (innerWidth > 767 ? 1.25 : 2);
  }

  /** 源站 objectMove + thrown 物理：拖拽时抓向笑脸中心，松手后下坠消失 */
  private move(o: ObjState, now: number) {
    if (o.waiting) { this.apply(o); return; }
    if (o.grabbed) {
      const sr = this.smileyEl.getBoundingClientRect();
      const er = this.el.getBoundingClientRect();
      const sx = sr.left - er.left + sr.width / 2;
      const sy = sr.top - er.top + sr.height / 2;
      const mx = this.smx - er.left, my = this.smy - er.top;
      o.vx += (mx - sx - o.x) * 0.075; o.vx *= 0.9;
      o.vy += (my - sy - o.y) * 0.075; o.vy *= 0.9;
      o.vz += (0 - o.z) * 0.3;
      o.z = Math.min(o.z, 500);
      o.s += (1 - o.s) * 0.5;
      o.rz = o.ry + o.rx;
      this.apply(o);
      return;
    }
    o.z += o.vz;
    o.x += o.vx; o.y += o.vy;
    o.rx += o.vrx; o.ry += o.vry;
    if (o.z < 1000) o.s = Math.min(1, o.s + 0.005);
    if (o.vanishing) {
      o.vy += 0.5; o.y += o.vy;
    }
    const gone = o.z > 1000 || (o.vanishing && now >= o.vanishAt);
    if (gone) {
      if (o.thrown) { this.thrown--; o.thrown = false; }
      this.reset(o, true);
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

    if (this.mx >= 0) {
      this.smx += (this.mx - this.smx) * 0.1;
      this.smy += (this.my - this.smy) * 0.1;
    }

    if (this.p > 0.02 && this.p < 0.98) {
      this.throwObject(now);
      for (const o of this.objects) this.move(o, now);
    }
  }

  destroy() {
    this.io?.disconnect();
    this.offs.forEach((off) => off());
    this.destroyFns.forEach((fn) => fn());
  }
}
