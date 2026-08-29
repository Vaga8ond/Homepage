import { gsap } from 'gsap';
import { $, ticker, REDUCED } from '../core';

export class Preloader {
  private el: HTMLElement;
  constructor() {
    this.el = document.querySelector('.js-intro') as HTMLElement;
    if (document.readyState === 'complete') ticker.nextTick(this.init, this);
    else $.once('siteLoaded', this.init, this);
  }
  private init() { this.play(); }

  private play() {
    if (REDUCED) {
      (document.querySelector('.js-site-wrapper') as HTMLElement | null)?.style.removeProperty('opacity');
      document.dispatchEvent(new CustomEvent('intro'));
      this.finish();
      return;
    }
    const wrapper = document.querySelector('.js-site-wrapper');
    const vLines = this.el.querySelectorAll('.js-logo-line-v');
    const hLines = this.el.querySelectorAll('.js-logo-line-h');
    const borderTop = this.el.querySelector('.js-border-top');
    const borderLeft = this.el.querySelector('.js-border-left');
    const borderRight = this.el.querySelector('.js-border-right');
    const tl = gsap.timeline();
    tl.set(wrapper, { opacity: '' }, 0); // source: reveal page behind intro at t=0 (wrapper starts with inline opacity:0)
    tl.set(this.el, { background: 'transparent' }, 0);
    tl.fromTo(vLines, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'power4.inOut', stagger: .15 }, 0);
    tl.fromTo(hLines, { scaleX: 0 }, { scaleX: 1, duration: .4, ease: 'power4.inOut', stagger: 0 }, 1);
    tl.set(vLines, { transformOrigin: '50% 0' });
    tl.fromTo(vLines, { scaleY: 1 }, { scaleY: 0, duration: 1, ease: 'power4.in', immediateRender: false, stagger: .1 }, 2);
    tl.fromTo(hLines, { scaleY: 1 }, { scaleY: 0, duration: .5, ease: 'power4.in', immediateRender: false, stagger: .1 }, 2.1);
    tl.from(borderTop, { scaleY: 0, duration: 3, ease: 'power3.inOut' }, 1);
    tl.from([borderLeft, borderRight], { scaleX: 0, duration: 3, ease: 'power3.inOut' }, 1);
    tl.call(() => document.dispatchEvent(new CustomEvent('intro')), null, '-=1.85');
    tl.call(() => this.finish(), null, 5);
  }

  private finish() {
    (document.querySelector('.js-mount') as HTMLElement | null)?.style.setProperty('opacity', '1');
    this.el.remove();
    document.documentElement.classList.remove('is-scroll-blocked');
    $.emit('unlockScroll');
    ticker.nextTick(() => $.emit('updateViewport'), this);
  }
}
