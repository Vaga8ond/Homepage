import { $, ticker, REDUCED } from './core';
import { Perlin, lerp } from './utils';

/* <a-waves>: SVG 纵向折线，Perlin 噪声起伏 + 鼠标速度推挤（弹簧回位）。
   introend 后开启鼠标交互（source.js Ec verbatim，含 --x/--y 光标点）。 */
export class Waves extends HTMLElement {
  private svg!: SVGSVGElement;
  private bounding = { left: 0, top: 0, width: 0, height: 0 };
  private lines: Array<Array<{ x: number; y: number; wave: { x: number; y: number }; cursor: { x: number; y: number; vx: number; vy: number } }>> = [];
  private paths: SVGPathElement[] = [];
  private noise = new Perlin(Math.random() * 255);
  private mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };
  private isInteractive = false;
  private isPaused = true;
  private revealed = false;

  connectedCallback() {
    this.svg = this.querySelector('.js-svg') as SVGSVGElement;
    this.setSize();
    this.setLines();
    $.on('mousemove', (x: number, y: number) => this.updateMousePosition(x, y));
    $.on('resize', (changed: boolean) => { if (changed) { this.setSize(); this.setLines(); } });
    this.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      this.updateMousePosition(e.touches[0].clientX, e.touches[0].clientY);
    });
    this.addEventListener('intersect', (e: Event) => this.onIntersect(e), { passive: true });
    this.addEventListener('introend', () => { this.isInteractive = true; this.revealed = true; });
    document.fonts?.ready.then(() => {
      if (this.clientHeight !== this.bounding.height) { this.setSize(); this.setLines(); }
    });
    if (REDUCED) { this.revealed = true; this.drawLines(); }
  }

  private updateMousePosition(x: number, y: number) {
    const m = this.mouse;
    m.x = x - this.bounding.left;
    m.y = y - this.bounding.top;
    if (!m.set) { m.sx = m.x; m.sy = m.y; m.lx = m.x; m.ly = m.y; m.set = true; }
  }

  private onIntersect(e: Event) {
    this.isPaused = !(e as CustomEvent).detail.isIntersecting;
    if (this.isPaused || REDUCED) $.off('tick', this.tick, this);
    else $.on('tick', this.tick, this);
  }

  private setSize() {
    const rect = this.getBoundingClientRect();
    this.bounding = { left: rect.left, top: rect.top + window.scrollY, width: this.clientWidth, height: this.clientHeight };
    this.svg.setAttribute('width', `${this.bounding.width}px`);
    this.svg.setAttribute('height', `${this.bounding.height}px`);
  }

  private setLines() {
    const { width, height } = this.bounding;
    this.lines = [];
    this.paths.forEach((p) => p.remove());
    this.paths = [];
    const gapX = 10, gapY = 32;
    // source setLines verbatim：网格向四周溢出居中，余量被 overflow:hidden 裁掉
    const cols = Math.ceil((width + 200) / gapX);
    const rows = Math.ceil((height + 30) / gapY);
    const offX = (width - gapX * cols) / 2;
    const offY = (height - gapY * rows) / 2;
    for (let c = 0; c <= cols; c++) {
      const points = [];
      for (let r = 0; r <= rows; r++) {
        points.push({ x: offX + gapX * c, y: offY + gapY * r, wave: { x: 0, y: 0 }, cursor: { x: 0, y: 0, vx: 0, vy: 0 } });
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('a__line', 'js-line');
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1';
      path.style.strokeDashoffset = this.revealed ? '0' : '1';
      this.svg.appendChild(path);
      this.paths.push(path);
      this.lines.push(points);
    }
    if (this.isPaused) this.drawLines();
  }

  private movePoints(t: number) {
    this.lines.forEach((col) => col.forEach((pt) => {
      const angle = this.noise.perlin2((pt.x + t * .0125) * .002, (pt.y + t * .005) * .0015) * 12;
      pt.wave.x = Math.cos(angle) * 32;
      pt.wave.y = Math.sin(angle) * 16;
      if (this.isInteractive) {
        const m = this.mouse;
        const dx = pt.x - m.sx, dy = pt.y - m.sy;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(175, m.vs);
        if (dist < radius) {
          const p = 1 - dist / radius;
          const f = Math.cos(dist * .001) * p;
          pt.cursor.vx += Math.cos(m.a) * f * radius * m.vs * 65e-5;
          pt.cursor.vy += Math.sin(m.a) * f * radius * m.vs * 65e-5;
        }
        pt.cursor.vx += -pt.cursor.x * .005;
        pt.cursor.vy += -pt.cursor.y * .005;
        pt.cursor.vx *= .925; pt.cursor.vy *= .925;
        pt.cursor.x += pt.cursor.vx * 2; pt.cursor.y += pt.cursor.vy * 2;
        pt.cursor.x = Math.min(100, Math.max(-100, pt.cursor.x));
        pt.cursor.y = Math.min(100, Math.max(-100, pt.cursor.y));
      }
    }));
  }

  private moved(pt: { x: number; y: number; wave: { x: number; y: number }; cursor: { x: number; y: number } }, withCursor = true) {
    return {
      x: Math.round((pt.x + pt.wave.x + (withCursor ? pt.cursor.x : 0)) * 10) / 10,
      y: Math.round((pt.y + pt.wave.y + (withCursor ? pt.cursor.y : 0)) * 10) / 10,
    };
  }

  private drawLines() {
    this.lines.forEach((col, i) => {
      let d = '';
      col.forEach((pt, j) => {
        const p = this.moved(pt, j !== 0 && j !== col.length - 1);
        d += (j === 0 ? 'M' : 'L') + p.x + ' ' + p.y + ' ';
      });
      this.paths[i].setAttribute('d', d);
    });
  }

  private tick(t: number) {
    const m = this.mouse;
    m.sx = lerp(m.sx, m.x, .1);
    m.sy = lerp(m.sy, m.y, .1);
    const dx = m.x - m.lx, dy = m.y - m.ly;
    const dist = Math.hypot(dx, dy);
    m.v = dist;
    m.vs = Math.min(100, lerp(m.vs, dist, .1));
    m.lx = m.x; m.ly = m.y;
    m.a = Math.atan2(dy, dx);
    // source：光标点圆（a-waves:before）跟随
    this.style.setProperty('--x', `${m.sx}px`);
    this.style.setProperty('--y', `${m.sy}px`);
    this.movePoints(t);
    this.drawLines();
  }
}
customElements.define('a-waves', Waves);
