import { $ } from './core';
import { gsap } from 'gsap';

// site-intro 开场时间轴 — source.js:4272-4316 verbatim
// 红幕上 M/W 线条字形画入再收回，边框线同步画入；
// t≈3.15 派发 'intro'（head/hero 入场挂这），t5 点亮黑边、移除红幕、解锁滚动。
export class Intro {
  constructor() {
    const wrapper = document.querySelector('.js-site-wrapper');
    const el = document.querySelector('.js-intro') as HTMLElement;
    const mount = document.querySelector('.js-mount') as HTMLElement;
    if (!el) return;
    const v = el.querySelectorAll('.js-logo-line-v');
    const h = el.querySelectorAll('.js-logo-line-h');
    const bt = el.querySelector('.js-border-top');
    const bl = el.querySelector('.js-border-left');
    const br = el.querySelector('.js-border-right');

    const tl = gsap.timeline();
    tl.set(wrapper, { opacity: '' });
    tl.set(el, { background: 'transparent' });
    tl.fromTo(v, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'power4.inOut', stagger: 0.15 }, 0);
    tl.fromTo(h, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power4.inOut', stagger: 0 }, 1);
    tl.set(v, { transformOrigin: '50% 0' });
    tl.fromTo(v, { scaleY: 1 }, { scaleY: 0, duration: 1, ease: 'power4.in', immediateRender: false, stagger: 0.1 }, 2);
    tl.fromTo(h, { scaleY: 1 }, { scaleY: 0, duration: 0.5, ease: 'power4.in', immediateRender: false, stagger: 0.1 }, 2.1);
    tl.from(bt, { scaleY: 0, duration: 3, ease: 'power3.inOut' }, 1);
    tl.from([bl, br], { scaleX: 0, duration: 3, ease: 'power3.inOut' }, 1);
    tl.call(() => { document.dispatchEvent(new CustomEvent('intro')); }, undefined, '-=1.85');
    tl.call(() => {
      mount.style.opacity = '1';
      el.remove();
      document.documentElement.classList.remove('is-scroll-blocked');
      setTimeout(() => $.emit('resize'), 0);
    }, undefined, 5);
  }
}
