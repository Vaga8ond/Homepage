import { gsap } from 'gsap';
import { $, ticker, REDUCED } from '../core';
import { splitChars } from '../utils';

export class Hero {
  private el!: HTMLElement;
  private words!: NodeListOf<HTMLElement>;
  private chars: HTMLElement[] = [];
  private st: { revert: () => void } | null = null;
  private isWaiting = true;

  constructor() {
    ticker.nextTick(this.init, this);
  }

  private init() {
    this.el = document.querySelector('.s-hero') as HTMLElement;
    this.words = this.el.querySelectorAll('.js-word');
    this.splitWords();
    if (REDUCED) {
      this.isWaiting = false;
      gsap.set(this.el.querySelector('.js-content'), { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', opacity: 1 });
      return;
    }
    document.addEventListener('intro', () => this.intro(), { once: true });
    this.el.addEventListener('intersect', (e: Event) => {
      const paused = !(e as CustomEvent).detail.isIntersecting;
      if (paused) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
    $.on('resize', (changed: boolean) => { if (changed) this.splitWords(); }, this);
  }

  private splitWords() {
    this.chars.forEach((c) => { const inner = c.querySelector('.char__inner'); if (inner) c.textContent = inner.textContent || ''; });
    this.chars = splitChars(this.words);
  }

  private intro() {
    const waves = this.el.querySelector('x-waves');
    const lines = this.el.querySelectorAll('.js-line');
    const content = this.el.querySelector('.js-content') as HTMLElement;
    const seps = this.el.querySelectorAll('.js-sep-item');
    const star = this.el.querySelector('.js-star');
    const inners = content.querySelectorAll('.char__inner');
    const tl = gsap.timeline();
    tl.fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3, ease: 'expo.out', stagger: { amount: .5, from: 'edges', ease: 'power3.inOut' } }, .5);
    tl.call(() => waves?.dispatchEvent(new CustomEvent('introend')), null, '-=1');
    tl.fromTo(content, { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 1, ease: 'expo.inOut' }, 1);
    tl.fromTo(inners, { y: '-100%' }, { y: '0%', duration: 2, ease: 'expo.inOut', stagger: .02 }, .45);
    tl.from(seps, { y: (i: number) => (i % 2 === 0 ? '-100%' : '100%'), duration: 1.5, ease: 'expo.inOut' }, .75);
    tl.from(star, { rotate: 90, duration: 2, ease: 'expo.out' }, 1.5);
    tl.call(() => { this.isWaiting = false; });
  }

  private tick() {
    if (this.isWaiting || Math.random() > .01) return;
    const char = this.chars[Math.floor(Math.random() * this.chars.length)];
    if (!char || char.classList.contains('to-top') || char.classList.contains('to-right') || char.classList.contains('to-bottom') || char.classList.contains('to-left')) return;
    const dir = ['to-bottom', 'to-left', 'to-top', 'to-right'][Math.floor(Math.random() * 4)];
    char.classList.add(dir);
    setTimeout(() => char.classList.remove(dir), 2000);
  }
}
