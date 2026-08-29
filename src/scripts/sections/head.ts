import { gsap } from 'gsap';
import { $, ticker, REDUCED } from '../core';

const MESSAGES = [
  'Preparing for inevitable debugging',
  'Compiling designer dreams…into developer nightmares',
  'Please wait while I overthink this',
  'Optimizing… but nothing\u2019s perfect',
  'Re-routing your expectations… expect delays',
  'Trying to animate enthusiasm… it\u2019s not going well',
  'Stuck in an infinite loop',
  'Simulating progress… sort of',
  'This will probably break soon',
  'Progress bar full of lies',
  'Finding meaning in the code',
  'Calculating failure probabilities',
  'Animating pixels with love',
  'Integrating magic and code',
  'Running creativity protocols',
  'Halfway done… maybe',
  'Fetching some interesting stuff',
  'Aligning pixels… carefully',
  'Loading… feel free to blink',
  'Almost there… give or take',
  'Deploying… probably not broken',
  'Making things work… hopefully',
  'Initializing… prepare for bugs',
  'Loading coolness… almost ready',
  'Design and code handshake',
];

export class Head {
  private el!: HTMLElement;
  private consoleEl!: HTMLElement;
  private contrastMask!: HTMLElement;
  private message = '';
  private lastMessage = '';
  private lineBreak = false;
  private lastTypeTime = 0;
  private writeDelay = 0;
  private canWrite = false;
  private isPaused = true;
  private isToggling = false;

  constructor() {
    ticker.nextTick(this.init, this);
  }
  private init() {
    this.el = document.querySelector('.site-head') as HTMLElement;
    this.consoleEl = this.el.querySelector('.js-console') as HTMLElement;
    this.contrastMask = document.querySelector('.js-contrast-mask') as HTMLElement;
    gsap.set(this.contrastMask, { xPercent: -100 });
    this.el.querySelector('.js-contrast')?.addEventListener('click', () => this.toggleContrast());
    this.el.querySelectorAll<HTMLAnchorElement>('.js-menu-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.lenis?.scrollTo(link.getAttribute('href') || 0, {
          duration: 1.5,
          easing: (t) => (t < .5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t),
        });
      });
    });
    document.addEventListener('intro', () => this.intro(), { once: true });
    this.el.addEventListener('intersect', (e: Event) => this.onIntersect(e), { passive: true });
    if (REDUCED) { gsap.set(this.el, { y: 0 }); this.canWrite = true; }
  }

  private intro() {
    const logo = this.el.querySelector('.js-logo');
    const items = this.el.querySelectorAll('.js-menu-item');
    const tl = gsap.timeline();
    tl.fromTo(this.el, { y: '-100%' }, { y: '0%', duration: 1.5, ease: 'expo.inOut' }, 1);
    tl.from([logo, ...Array.from(items)], { y: '-110%', duration: 1.5, ease: 'expo.out', stagger: .1 }, 1.5);
    tl.call(() => { this.canWrite = true; }, null, 1.6);
  }

  private onIntersect(e: Event) {
    this.isPaused = !(e as CustomEvent).detail.isIntersecting;
    if (this.isPaused) $.off('tick', this.updateConsole, this);
    else if (!REDUCED) $.on('tick', this.updateConsole, this);
  }

  private toggleContrast() {
    if (this.isToggling) return;
    this.isToggling = true;
    // 互斥锁兜底：即使时间轴被打断也能解锁
    setTimeout(() => { this.isToggling = false; }, 1300);
    const html = document.documentElement;
    const toContrasted = !html.classList.contains('theme-contrasted');
    const done = () => {
      html.classList.toggle('theme-contrasted', toContrasted);
      $.emit('contrastchange', toContrasted ? 'contrasted' : 'default');
    };
    if (REDUCED) { done(); this.isToggling = false; return; }
    gsap.timeline({ onComplete: () => { gsap.set(this.contrastMask, { xPercent: -100, x: 0 }); } })
      .fromTo(this.contrastMask, { xPercent: -100, x: 0 }, { xPercent: 0, x: 0, duration: .5, ease: 'expo.inOut', overwrite: true })
      .call(done)
      .to(this.contrastMask, { xPercent: 100, x: 0, duration: .5, ease: 'expo.inOut' });
  }

  private updateConsole(t: number) {
    if (!this.canWrite || t - this.lastTypeTime < this.writeDelay) return;
    if (this.message === '') {
      this.message = this.randomMessage();
      this.writeDelay = 2000;
    } else {
      if (this.message === this.lastMessage || this.lineBreak) this.consoleEl.textContent += '\n';
      const c = this.message.charAt(0);
      this.message = this.message.substring(1);
      this.writeDelay = c === ',' || c === ' ' ? 100 : c === '' ? 200 : c === '\u2026' || c === '.' ? 400 : 20;
      this.consoleEl.textContent += c;
      this.lineBreak = c === '\u2026';
    }
    this.consoleEl.textContent = this.consoleEl.textContent.split('\n').slice(-5).join('\n');
    this.lastTypeTime = t;
  }

  private randomMessage(): string {
    let m = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    while (m === this.lastMessage) m = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    this.lastMessage = m;
    return m;
  }
}
