import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, ticker, REDUCED } from '../core';

/* <x-work>: project card driven by a `progress` attribute (1 → -1).
   Plays its video while in the focal zone (-1, 1 exclusive). */
class XWork extends HTMLElement {
  static get observedAttributes() { return ['progress']; }
  private video!: HTMLVideoElement;
  private link!: HTMLAnchorElement;
  private isPlaying = false;

  connectedCallback() {
    this.video = this.querySelector('.js-video') as HTMLVideoElement;
    this.link = this.querySelector('a') as HTMLAnchorElement;
    this.link?.addEventListener('click', (e) => {
      if ((this.link.getAttribute('href') || '').includes('#')) { e.preventDefault(); return false; }
    });
  }

  attributeChangedCallback(name: string, _old: string, value: string) {
    if (name !== 'progress') return;
    this.style.setProperty('--p', value);
    if (value === '1' || value === '-1') {
      if (this.isPlaying) { this.video.pause(); this.isPlaying = false; }
      this.classList.remove('is-inview');
    } else if (!this.isPlaying) {
      this.video.play().catch(() => {});
      this.isPlaying = true;
      this.classList.add('is-inview');
    }
  }
}
customElements.define('x-work', XWork);

type Ghost = { el: HTMLSpanElement; x: number; y: number; z: number; i: number; p: number; ap: number; mx: number; my: number };

export class Work {
  private el!: HTMLElement;
  private container!: HTMLElement;
  private ruler!: HTMLElement;
  private scene!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private videos!: NodeListOf<HTMLVideoElement>;
  private mask: any = {};
  private letters: Array<{ el: HTMLElement; width: number; height: number; top: number; left: number; freq: number; total: number; ghosts: Ghost[] }> = [];
  private works: Array<{ el: HTMLElement }> = [];
  private points: Array<{ x: number; y: number; dx: number; dy: number; m: number; flowX: number }> = [];
  private bounding: any = {};
  private speed = 1;
  private state = 0;
  private scrollProgress = 0;
  private smoothScrollProgress = 0;
  private pointsProgress = 0;
  private animationProgress = 0;
  private last = { animationProgress: -1, pointsProgress: -1 };
  private tl?: gsap.core.Timeline;
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
    this.videos = this.container.querySelectorAll('video');
    this.mask = {
      width: 0, height: 0, maxScale: 1, lines: [],
      el: this.el.querySelector('.js-mask') as HTMLElement,
      svg: this.el.querySelector('.js-mask-svg') as SVGSVGElement,
      pathOuter: this.el.querySelector('.js-mask-path-outer') as SVGPathElement,
      pathInner: this.el.querySelector('.js-mask-path-inner') as SVGPathElement,
      pathLines: this.el.querySelector('.js-mask-path-lines') as SVGPathElement,
    };
    this.el.querySelectorAll('.js-letter-src').forEach((l) => this.letters.push({ el: l as HTMLElement, ghosts: [] }));
    this.container.querySelectorAll('x-work').forEach((w) => this.works.push({ el: w as HTMLElement }));
    if (REDUCED) { this.initReduced(); return; }
    this.setCtxStyle();
    this.setSize();
    this.setMask();
    this.setPoints();
    this.setLetters();
    this.setWorks();
    this.setTimeline();
    this.bindEvents();
  }

  private initReduced() {
    this.el.classList.add('is-reduced');
    this.el.style.setProperty('--height', 'auto');
    this.container.style.cssText = 'position:relative;height:auto;clip-path:none';
    this.scene.style.display = 'none';
    this.mask.el.style.display = 'none';
    this.works.forEach(({ el }) => {
      el.setAttribute('style', 'position:relative;left:auto;top:auto;transform:none;opacity:1;width:min(84vw,640px);margin:2.5rem auto;display:block');
      const v = el.querySelector('video');
      if (v) { v.src = v.dataset.src || ''; v.controls = false; v.play().catch(() => {}); }
    });
  }

  private bindEvents() {
    $.on('contrastchange', () => this.setCtxStyle(), this);
    $.on('resize', (changed: boolean) => {
      if (changed) { this.setCtxStyle(); this.setSize(); this.setMask(); this.setPoints(); this.setLetters(); this.setWorks(); this.setTimeline(); }
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

  private setMask() {
    const m = this.mask;
    const w = m.el.clientWidth, h = m.el.clientHeight;
    m.width = w; m.height = h;
    m.svg.setAttribute('width', w + 'px');
    m.svg.setAttribute('height', h + 'px');
    const sectionRect = this.container.getBoundingClientRect();
    const r = this.ruler.getBoundingClientRect();
    const rw = r.width, rh = r.height;
    const left = r.left - sectionRect.left;
    const top = r.top - sectionRect.top;
    const outerD = `M -1 0 L ${w + 2} 0 L ${w + 2} ${h} L -1 ${h} Z`;
    const c = {
      tl: { x: left, y: top }, tr: { x: left + rw, y: top },
      br: { x: left + rw, y: top + rh }, bl: { x: left, y: top + rh },
    };
    let rad = (c.tr.x - c.tl.x) / 2;
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

  private setLetters() {
    this.letters.forEach((letter, li) => {
      letter.ghosts.forEach((g) => g.el.remove());
      letter.ghosts = [];
      const rect = letter.el.getBoundingClientRect();
      letter.width = rect.width; letter.height = rect.height;
      letter.top = rect.top - this.bounding.top;
      letter.left = rect.left;
      letter.freq = 1 + Math.random();
      const density = window.safeWidth > 767 ? .75 : .5;
      letter.total = Math.round(this.bounding.width / letter.width * density) + 2;
      for (let i = 0; i < letter.total; i++) {
        const span = document.createElement('span');
        span.className = 's-work__scene-letter';
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
        span.style.zIndex = String(li !== 1 && li !== 2 && (li + this.letters.length + i) % 5 === 0 ? 3 : 1);
        span.style.setProperty('--ix', String(ghost.i));
        span.style.setProperty('--iy', String(((li + 1) / (this.letters.length + 1) - .5) * 2));
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

  private setTimeline() {
    const workEls = this.works.map((w) => w.el);
    this.tl?.kill();
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: this.el,
        start: 'top 25%',
        end: 'bottom 75%',
        scrub: 1,
        onUpdate: () => this.scene.style.setProperty('--state', String(this.state)),
      },
    });
    tl.fromTo(this.mask.el, { scale: 1 }, { scale: this.mask.maxScale, duration: .75, ease: 'power4.in' }, 0);
    tl.fromTo(this.scene, { scale: .75 }, { scale: 1, duration: .75, ease: 'power3.in' }, 0);
    tl.fromTo(this.container, { clipPath: 'inset(0px 1rem)' }, { clipPath: 'inset(0px 0rem)', duration: .75, ease: 'power3.in' }, 0);
    tl.fromTo(this, { pointsProgress: 0 }, { pointsProgress: 1, duration: 1, ease: 'power4.inOut' }, 0);
    tl.fromTo(this, { state: 0 }, { state: 1, duration: .75, ease: 'power4.in' }, 0);
    tl.fromTo(workEls, { attr: { progress: 1 } }, { attr: { progress: -1 }, ease: 'slow(0.15, 0.6)', stagger: .25 }, .75);
    tl.fromTo(this, { animationProgress: 0 }, { animationProgress: 1e4, duration: tl.totalDuration(), ease: 'power1.out' }, .75);
    tl.fromTo(this, { state: 1 }, { state: 0, duration: .75, ease: 'power4.inOut', immediateRender: false }, '-=1');
    tl.fromTo(this.mask.el, { scale: this.mask.maxScale }, { scale: 1, duration: .75, ease: 'power4.inOut', immediateRender: false }, '-=1');
    tl.fromTo(this.scene, { scale: 1 }, { scale: .75, duration: .75, ease: 'power3.inOut', immediateRender: false }, '-=1');
    tl.fromTo(this.container, { clipPath: 'inset(0px 0rem)' }, { clipPath: 'inset(0px 1rem)', duration: .75, ease: 'power3.inOut', immediateRender: false }, '-=1');
    tl.fromTo(this, { pointsProgress: 1 }, { pointsProgress: 0, duration: 1, ease: 'power4.inOut', immediateRender: false }, '-=1');
    this.tl = tl;
  }

  private loadNextVideo() {
    const video = Array.from(this.videos).find((v) => !v.classList.contains('is-loaded'));
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
      this.ctx.rect(x, y, .6, .6);
    });
    this.ctx.stroke();
    this.last.pointsProgress = pp;
    this.last.animationProgress = ap;
  }

  private tick() {
    this.scrollProgress = 0;
    const r = this.el.getBoundingClientRect();
    const vh = window.safeHeight;
    const topP = Math.min(1, Math.max(0, (vh - r.top) / vh));
    const bottomP = Math.min(1, Math.max(0, r.bottom / vh));
    this.scrollProgress = Math.min(topP, bottomP) * 2;
    this.smoothScrollProgress += (this.scrollProgress - this.smoothScrollProgress) * .1;
    this.el.style.setProperty('--scroll-progress', String(this.smoothScrollProgress));
    this.movePoints();
    this.moveLetters();
    this.drawPoints();
  }
}

export { ScrollTrigger };
