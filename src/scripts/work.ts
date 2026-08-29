import { $, ticker, REDUCED } from './core';

/* a-work：项目卡。progress 属性 1→-1 驱动飞行轨迹（css transform 用 --progress），
   焦段内加 is-inview（content-visibility 可见）。真实视频就位前是占位块。 */
class AWork extends HTMLElement {
  static get observedAttributes() { return ['progress']; }
  private video?: HTMLVideoElement;
  private link!: HTMLAnchorElement;
  private isPlaying = false;

  connectedCallback() {
    this.video = this.querySelector('.js-video') as HTMLVideoElement | undefined;
    this.link = this.querySelector('a') as HTMLAnchorElement;
    this.link?.addEventListener('click', (e) => {
      if ((this.link.getAttribute('href') || '').includes('#')) { e.preventDefault(); return false; }
    });
  }

  attributeChangedCallback(name: string, _old: string, value: string) {
    if (name !== 'progress') return;
    this.style.setProperty('--progress', value);
    if (value === '1' || value === '-1') {
      if (this.isPlaying && this.video) { this.video.pause(); this.isPlaying = false; }
      this.classList.remove('is-inview');
    } else {
      if (this.video && !this.isPlaying) { this.video.play().catch(() => {}); this.isPlaying = true; }
      this.classList.add('is-inview');
    }
  }
}
customElements.define('a-work', AWork);

type Ghost = { el: HTMLSpanElement; x: number; y: number; z: number; i: number; p: number; ap: number; mx: number; my: number };

/* s-work：fixed 画板 + 胶囊遮罩展开 + 卡片流 + WORK 幽灵字母 + 点阵画布。
   源站机制（source.js 5349–5721）；gsap ScrollTrigger 时间轴换算为手写滚动分段驱动
  （对应原 tl：intro 0–0.75 + 卡片 dur .5 stagger .25 + 尾部 -=1 回退，总长 3.5）。 */
const D = 3.5;
const CARD_START = (i: number) => .75 + i * .25;
const CARD_DUR = .5;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeIn4 = (k: number) => k * k * k * k;
const easeIn3 = (k: number) => k * k * k;
const easeInOut4 = (k: number) => (k < .5 ? 8 * k * k * k * k : 1 - 8 * (1 - k) * (1 - k) * (1 - k) * (1 - k));
const easeInOut3 = (k: number) => (k < .5 ? 4 * k * k * k : 1 - 4 * (1 - k) * (1 - k) * (1 - k));
// ponytail: gsap slow(0.15,0.6) 用 smoothstep 近似，肉眼无差；要精确再抄 SlowMo
const easeSlow = (k: number) => k * k * (3 - 2 * k);

export class Work {
  private el!: HTMLElement;
  private container!: HTMLElement;
  private ruler!: HTMLElement;
  private scene!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private mask: any = {};
  private letters: Array<{ el: HTMLElement; width: number; height: number; top: number; left: number; freq: number; total: number; ghosts: Ghost[] }> = [];
  private works: Array<{ el: HTMLElement }> = [];
  private points: Array<{ x: number; y: number; dx: number; dy: number; m: number; flowX: number }> = [];
  private bounding: any = {};
  private speed = 1;
  private scrollProgress = 0;
  private smoothScrollProgress = 0;
  private pointsProgress = 0;
  private animationProgress = 0;
  private tlP = 0;
  private last = { animationProgress: -1, pointsProgress: -1, tlP: -1 };
  private isPaused = true;
  private loadIsStarted = false;

  constructor() { ticker.nextTick(this.init, this); }

  private init() {
    this.el = document.querySelector('.s-work') as HTMLElement;
    if (!this.el) return;
    this.container = this.el.querySelector('.js-container') as HTMLElement;
    this.ruler = this.el.querySelector('.js-ruler') as HTMLElement;
    this.scene = this.container.querySelector('.js-scene') as HTMLElement;
    this.canvas = this.container.querySelector('.js-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.mask = {
      width: 0, height: 0, maxScale: 1, lines: [],
      el: this.el.querySelector('.js-mask') as HTMLElement,
      svg: this.el.querySelector('.js-mask-svg') as SVGSVGElement,
      pathOuter: this.el.querySelector('.js-mask-path-outer') as SVGPathElement,
      pathInner: this.el.querySelector('.js-mask-path-inner') as SVGPathElement,
      pathLines: this.el.querySelector('.js-mask-path-lines') as SVGPathElement,
    };
    this.el.querySelectorAll('.s__title .js-letter').forEach((l) => this.letters.push({ el: l as HTMLElement, ghosts: [] }));
    this.el.querySelectorAll('.js-work').forEach((w) => this.works.push({ el: w as HTMLElement }));
    if (REDUCED) { this.initReduced(); return; }
    this.setCtxStyle();
    this.setSize();
    this.setMask();
    this.setPoints();
    this.setLetters();
    this.setWorks();
    this.bindEvents();
  }

  private initReduced() {
    this.el.classList.add('is-reduced');
  }

  private bindEvents() {
    $.on('contrastchange', () => this.setCtxStyle(), this);
    $.on('resize', (changed: boolean) => {
      if (changed) { this.setCtxStyle(); this.setSize(); this.setMask(); this.setPoints(); this.setLetters(); this.setWorks(); this.last.tlP = -1; }
    }, this);
    this.el.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      if (this.isPaused) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
      if (!this.loadIsStarted) { this.loadNextVideo(); this.loadIsStarted = true; }
    }, { passive: true });
  }

  private setCtxStyle() {
    const color = getComputedStyle(this.el).getPropertyValue('--color-primary').trim();
    ticker.nextTick(() => { this.ctx.strokeStyle = color; }, this);
  }

  private setSize() {
    this.el.style.setProperty('--height', this.works.length * 50 + 'lvh');
    const rect = this.container.getBoundingClientRect();
    this.bounding = { left: rect.left, top: rect.top, width: window.safeWidth, height: window.safeHeight };
    this.canvas.width = this.bounding.width;
    this.canvas.height = this.bounding.height;
    this.speed = Math.hypot(this.bounding.width, this.bounding.height) * 4;
  }

  // 圆孔遮罩：外框 + ruler 区圆角矩形孔 + 内圈线，网格线用 path() 裁剪
  private setMask() {
    const m = this.mask;
    const w = m.el.clientWidth, h = m.el.clientHeight;
    m.width = w; m.height = h;
    m.svg.style.width = w + 'px';
    m.svg.style.height = h + 'px';
    const sectionRect = this.el.getBoundingClientRect();
    const r = this.ruler.getBoundingClientRect();
    const rw = r.width, rh = r.height;
    const left = r.left - sectionRect.left;
    const top = r.top - sectionRect.top;
    const outerD = `M -1 0 L ${w + 2} 0 L ${w + 2} ${h} L -1 ${h} Z`;
    const c = {
      tl: { x: left, y: top }, tr: { x: left + rw, y: top },
      br: { x: left + rw, y: top + rh }, bl: { x: left, y: top + rh },
    };
    const rad = (c.tr.x - c.tl.x) / 2;
    m.maxScale = window.safeWidth / rad;
    const holeD = (k: number) => {
      const tl = { x: c.tl.x + k, y: c.tl.y + k }, tr = { x: c.tr.x - k, y: c.tr.y + k };
      const br = { x: c.br.x - k, y: c.br.y - k }, bl = { x: c.bl.x + k, y: c.bl.y - k };
      const p = (tr.x - tl.x) / 2;
      return `M ${tl.x} ${tl.y + p} A ${p} ${p} 0 0 1 ${tr.x} ${tr.y + p} L ${br.x} ${br.y - p} A ${p} ${p} 0 0 1 ${bl.x} ${bl.y - p} Z`;
    };
    m.pathOuter.setAttribute('d', `${outerD} ${holeD(0)}`);
    m.pathInner.setAttribute('d', `${outerD} ${holeD(16)}`);
    m.lines = [];
    const cols = window.safeWidth > 767 ? 12 : 8;
    const gapX = w / cols, gapY = h * .1;
    const rows = Math.ceil(h / gapY);
    for (let i = 1; i < cols; i++) m.lines.push({ p1: { x: gapX * i, y: 0 }, p2: { x: gapX * i, y: h } });
    for (let i = 0; i < rows; i++) m.lines.push({ p1: { x: 0, y: gapY * i }, p2: { x: w, y: gapY * i } });
    let linesD = '';
    m.lines.forEach((l: any) => { linesD += `M ${l.p1.x} ${l.p1.y} L ${l.p2.x} ${l.p2.y} `; });
    m.pathLines.setAttribute('d', linesD);
    (m.pathLines as any).style.clipPath = `path(evenodd, '${outerD} ${holeD(0)}')`;
  }

  // WORK 幽灵字母：按真实字母量密度铺 ghosts（--ix/--iy/--ap/--p 给 css 定位）
  private setLetters() {
    this.letters.forEach((letter) => {
      letter.ghosts.forEach((g) => g.el.remove());
      letter.ghosts = [];
      const rect = letter.el.getBoundingClientRect();
      letter.width = rect.width; letter.height = rect.height;
      letter.top = rect.top - this.bounding.top;
      letter.left = rect.left;
      letter.freq = 1 + Math.random();
      const density = window.safeWidth > 767 ? .42 : .3; // 源站 .75：按 Anton 窄字宽重校准（目标每列 ≈7 ghost，同源站 Bigger Display 密度）
      letter.total = Math.round(this.bounding.width / letter.width * density) + 2;
      for (let i = 0; i < letter.total; i++) {
        const span = document.createElement('span');
        span.className = 's__scene__letter';
        span.dataset.letter = letter.el.innerText;
        span.innerText = letter.el.innerText;
        this.scene.appendChild(span);
        const ghost: Ghost = {
          el: span, x: letter.left, y: letter.top, z: Math.random() * 100,
          i: i - letter.total * .5,
          p: (i / letter.total - .5) * 2,
          ap: Math.abs(i / letter.total - .5) * 2,
          mx: 0, my: 0,
        };
        span.style.top = ghost.y + 'px';
        span.style.left = ghost.x + 'px';
        span.style.zIndex = String(this.letters.indexOf(letter) !== 1 && this.letters.indexOf(letter) !== 2 && (this.letters.indexOf(letter) + this.letters.length + i) % 5 === 0 ? 3 : 1);
        span.style.setProperty('--ix', String(ghost.i));
        span.style.setProperty('--iy', String(((this.letters.indexOf(letter) + 1) / (this.letters.length + 1) - .5) * 2));
        span.style.setProperty('--ap', String(ghost.ap));
        span.style.setProperty('--p', String(ghost.p));
        letter.ghosts.push(ghost);
      }
    });
  }

  private setWorks() {
    this.works.forEach((work, i) => {
      work.el.style.setProperty('--size', String(.5 + Math.random() * .5));
      work.el.style.setProperty('--y', String((.5 + Math.random() * .5) * (i % 2 ? -1 : 1)));
      work.el.setAttribute('progress', '1');
    });
  }

  // 滚动分段驱动（等价老 gsap tl，见文件头注释）
  private applyTimeline() {
    const t = this.tlP * D;
    // intro [0,.75]：遮罩展开 + 画板放大 + state 点亮
    const kMask = easeIn4(seg(t, 0, .75));
    this.mask.el.style.transform = `scale(${1 + (this.mask.maxScale - 1) * kMask})`;
    this.scene.style.transform = `scale(${.75 + .25 * easeIn3(seg(t, 0, .75))})`;
    const kState = easeIn4(seg(t, 0, .75));
    this.scene.style.setProperty('--state', String(kState));
    this.pointsProgress = easeInOut4(seg(t, 0, .75));
    // 卡片 [.75, 4]：progress 1→-1 stagger
    this.works.forEach((w, i) => {
      const k = easeSlow(seg(t, CARD_START(i), CARD_START(i) + CARD_DUR));
      w.el.setAttribute('progress', String(1 - 2 * k));
    });
    // 幽灵流时间 [.75, 4]
    const ka = seg(t, .75, D);
    this.animationProgress = 1e4 * (1 - (1 - ka) * (1 - ka));
    // outro [3,4]：整场退回（后写覆盖 intro 值，同 gsap immediateRender:false）
    if (t > D - 1) {
      const ko = clamp01(t - (D - 1));
      this.mask.el.style.transform = `scale(${this.mask.maxScale + (1 - this.mask.maxScale) * easeInOut4(ko)})`;
      this.scene.style.transform = `scale(${1 - .25 * easeInOut3(ko)})`;
      this.scene.style.setProperty('--state', String(1 - easeIn4(ko)));
      this.pointsProgress = 1 - easeInOut4(ko);
    }
  }

  private loadNextVideo() {
    const video = Array.from(this.container.querySelectorAll<HTMLVideoElement>('.js-video'))
      .find((v) => !v.classList.contains('is-loaded'));
    if (!video) return;
    if (video.readyState >= 3) this.videoLoaded(video);
    else {
      video.addEventListener('canplaythrough', () => this.videoLoaded(video), { once: true });
      video.src = video.dataset.src || '';
      video.load();
    }
  }
  private videoLoaded(video: HTMLVideoElement) {
    video.classList.add('is-loaded');
    this.loadNextVideo();
  }

  private moveLetters() {
    this.letters.forEach((letter) => {
      const n = this.speed * letter.freq;
      letter.ghosts.forEach((g, gi) => {
        const p = ((this.animationProgress % n) / n + gi / letter.total) % 1 / .7 - .15;
        g.el.style.setProperty('--progress', String(p));
      });
    });
  }

  private setPoints() {
    this.points = [];
    const gap = 24;
    const cols = Math.ceil(this.bounding.width * 1.2 / gap);
    const rows = Math.ceil(this.bounding.height * 1.2 / gap);
    const offX = (this.bounding.width - cols * gap) * .5;
    const offY = (this.bounding.height - rows * gap) * .5;
    const cx = this.bounding.width * .5;
    const cy = this.bounding.height * .5;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const px = x * gap + offX, py = y * gap + offY;
      this.points.push({ x: px, y: py, dx: cx - px, dy: cy - py, m: Math.random(), flowX: 0 });
    }
  }

  private movePoints() {
    this.points.forEach((p) => { p.flowX = (this.animationProgress * -.05) % 24; });
  }

  private drawPoints() {
    const b = this.bounding;
    const ap = Math.round(this.animationProgress * 100) / 100;
    const pp = Math.round(this.pointsProgress * 100) / 100;
    if (pp === this.last.pointsProgress && ap === this.last.animationProgress) return;
    this.ctx.clearRect(0, 0, b.width, b.height);
    this.ctx.beginPath();
    this.points.forEach((p) => {
      const x = p.x + p.dx * (1 - this.pointsProgress) * .2 + p.flowX;
      const y = p.y + p.dy * (1 - this.pointsProgress) * .2;
      this.ctx.rect(x, y, .5, .5);
    });
    this.ctx.stroke();
    this.last.pointsProgress = pp;
    this.last.animationProgress = ap;
  }

  private tick() {
    // 遮罩视差进度（css var；源站式：顶入为负分量+底出为正分量，pin 中段 ≈ -1）
    const r = this.el.getBoundingClientRect();
    const vh = window.safeHeight;
    this.scrollProgress = -clamp01((vh - r.top) / vh) + (1 - clamp01(r.bottom / vh));
    this.smoothScrollProgress += (this.scrollProgress - this.smoothScrollProgress) * .1;
    this.el.style.setProperty('--scroll-progress', String(this.smoothScrollProgress));
    // 时间轴进度：top 过视口 75% 线 → bottom 过 25% 线（=老 ScrollTrigger start "top 25%" end "bottom 75%"），scrub 平滑
    const start = vh * .75 - r.top;
    const end = r.height - vh * .5;
    const target = end > 0 ? clamp01(start / end) : 0;
    this.tlP += (target - this.tlP) * .1;
    if (Math.abs(target - this.tlP) < .0005) this.tlP = target;
    this.applyTimeline();
    this.movePoints();
    this.moveLetters();
    this.drawPoints();
    this.last.tlP = this.tlP;
  }
}
