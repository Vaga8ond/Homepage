import { gsap } from 'gsap';
import { $, ticker, REDUCED } from './core';
import { splitChars } from './utils';

/* s-hero：标题字符分裂 + intro 时间轴（source.js _c verbatim；
   drawSVG 揭示用 pathLength=1 + dashoffset 等价实现）。 */
export class Hero {
  private el!: HTMLElement;
  private words!: NodeListOf<HTMLElement>;
  private chars: HTMLElement[] = [];
  private isWaiting = true;

  constructor() {
    $.once('siteLoaded', () => this.init());
  }

  private init() {
    this.el = document.querySelector('.s-hero') as HTMLElement;
    this.words = this.el.querySelectorAll('.js-word');
    this.splitWords();
    if (REDUCED) {
      this.isWaiting = false;
      gsap.set(this.el.querySelector('.js-content') as HTMLElement, {
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
        opacity: 1,
      });
      return;
    }
    document.addEventListener('intro', () => this.intro(), { once: true });
    this.el.addEventListener('intersect', (e: Event) => {
      const paused = !(e as CustomEvent).detail.isIntersecting;
      if (paused) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
    $.on('resize', (changed: boolean) => { if (changed) this.splitWords(); });
  }

  private splitWords() {
    this.chars.forEach((c) => {
      const inner = c.querySelector('.char__inner');
      if (inner) c.textContent = inner.textContent || '';
    });
    this.chars = splitChars(this.words);
  }

  // source intro() verbatim：波浪揭示→introend→边框俯冲/内容揭幕/字符坠落/分隔条滑入
  private intro() {
    const waves = this.el.querySelector('a-waves') as HTMLElement;
    const lines = this.el.querySelectorAll('.js-line');
    const content = this.el.querySelector('.js-content') as HTMLElement;
    const border = this.el.querySelector('.js-border') as HTMLElement;
    const inners = content.querySelectorAll('.char__inner');
    const seps = content.querySelectorAll('.js-separator');
    const star = this.el.querySelector('.js-star') as HTMLElement;
    const tl = gsap.timeline();
    tl.fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, {
      strokeDashoffset: 0,
      duration: 3,
      ease: 'expo.out',
      stagger: { amount: .5, from: 'edges', ease: 'power3.inOut' },
    }, .5);
    tl.call(() => waves.dispatchEvent(new CustomEvent('introend')), undefined, '-=1');
    tl.set(this.el, { opacity: 1 }, 0);
    tl.to(border, { scaleY: .025, y: -content.clientHeight, duration: 1, ease: 'expo.inOut' }, 0);
    tl.from(waves, { y: '100%', duration: 1.35, ease: 'expo.out' }, 0);
    tl.fromTo(content, { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }, {
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
      duration: 1,
      ease: 'expo.inOut',
    }, 1);
    tl.to(border, { scaleY: 1, y: 0, duration: 1, ease: 'expo.inOut' }, 1);
    tl.from(star, { rotate: 90, duration: 2, ease: 'expo.out' }, 1.5);
    tl.fromTo(inners, { y: '-100%' }, { y: '0%', duration: 2, ease: 'expo.inOut', stagger: .02 }, .45);
    tl.from(seps, {
      y: (i: number) => (i % 2 === 0 ? '-100%' : '100%'),
      duration: 1.5,
      ease: 'expo.inOut',
    }, .75);
    tl.call(() => { this.isWaiting = false; });
  }

  // source animateChar verbatim：1%/tick 概率随机字符向四向滑出（CSS 动画）2s
  private tick() {
    if (this.isWaiting || Math.random() > .01) return;
    const char = this.chars[Math.floor(Math.random() * this.chars.length)];
    if (!char || ['to-top', 'to-right', 'to-bottom', 'to-left'].some((c) => char.classList.contains(c))) return;
    const dir = ['to-bottom', 'to-left', 'to-top', 'to-right'][Math.floor(Math.random() * 4)];
    char.classList.add(dir);
    setTimeout(() => char.classList.remove(dir), 2000);
  }
}
