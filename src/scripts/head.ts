import gsap from 'gsap';
import { $, ticker } from './core';

// 66 条彩蛋消息 — source.js:4349 全量 verbatim
const MESSAGES = ["Preparing for inevitable debugging", "Compiling designer dreams…into developer nightmares", "Please wait while I overthink this", "Optimizing… but nothing’s perfect", "Configuring the next minor inconvenience", "Fetching assets… contemplating the futility of it all", "Re-routing your expectations… expect delays", "Trying to animate enthusiasm… it’s not going well", "Stuck in an infinite loop", "Loading… still pointless", "Simulating progress… sort of", "This will probably break soon", "Simulating something useful", "Progress bar full of lies", "Finding meaning in the code", "Calculating failure probabilities", "Please wait… indefinitely", "Loading… almost there!", "Animating pixels with love", "Integrating magic and code", "Optimizing creativity… stand by", "Design and code handshake", "Fetching creativity… almost done!", "Preparing awesomeness", "Simulating brilliance… probably", "Everything is under control", "Loading coolness… almost ready", "Calibrating designer dreams", "Fusing design and animation", "Running creativity protocols", "Crafting magic… please wait", "Making things pretty… hold on", "Loading… this might take a bit", "Animating pixels… somewhat precisely", "Integrating code and reality", "Halfway done… maybe", "Optimizing… cautiously hopeful", "Design meets code… fingers crossed", "Fetching some interesting stuff", "Preparing… slowly but surely", "Aligning pixels… carefully", "Calibrating… what exactly? Good question", "Waiting… patience is key", "Simulating… something, probably", "Loading… feel free to blink", "Running some clever algorithms", "Almost there… give or take", "Integrating… like a pro", "Crafting… without breaking anything", "Adjusting fonts… nearly invisible", "Piecing it together… stay tuned", "Loading… nothing to see yet", "Running final checks… hopefully", "Almost ready… trust me", "Building… it’s getting there", "Loading… but why rush?", "Please wait… or don’t, whatever", "Initializing… prepare for bugs", "Optimizing… but who cares?", "Deploying… probably not broken", "Making things work… hopefully", "Running… but not too fast", "Testing patience… stay calm", "Initializing… no promises", "Loading… but who’s counting?", "Loading… could be worse"];

export class Head {
  private el = document.querySelector('.site-head') as HTMLElement;
  private contrastButton = document.querySelector('.js-contrast') as HTMLButtonElement;
  private consoleEl = document.querySelector('.js-console') as HTMLElement;
  private contrastMask = document.querySelector('.js-contrast-mask') as HTMLElement;
  private links = this.el.querySelectorAll('.js-menu-link');
  private message = '';
  private messageLineBreak = false;
  private lastMessage = '';
  private lastTypeTime = 0;
  private writeDelay = 0;
  private canWrite = false;
  private isPaused = true;
  private unTick?: () => void;

  constructor() {
    this.contrastButton.addEventListener('click', this.toggleContrast.bind(this));
    this.links.forEach(link => link.addEventListener('click', this.moveToSection.bind(this)));
    document.addEventListener('intro', this.intro.bind(this), { once: true });
    this.el.addEventListener('intersect', this.onIntersect.bind(this));
  }

  // 离屏暂停打字机（源站机制 verbatim；observe 在 core.ts App.init）
  private onIntersect(e: Event) {
    this.isPaused = !(e as CustomEvent).detail.isIntersecting;
    if (this.isPaused) this.unTick?.();
    else this.unTick = ticker.add(() => this.updateConsole(performance.now()));
  }

  // source.js:4373 — 时序 verbatim：el 亮→t1 整条滑入→t1.5 logo/菜单项级联→canWrite
  private intro() {
    const logo = this.el.querySelector('.js-logo');
    const menuItems = this.el.querySelectorAll('.js-menu-item');
    const targets = [logo, ...menuItems].filter(Boolean);
    const tl = gsap.timeline();
    tl.set(this.el, { opacity: 1 });
    tl.from(this.el, { y: '-100%', duration: 1.5, ease: 'expo.inOut' }, 1);
    tl.from(targets, { y: '-100%', duration: 1.5, ease: 'expo.out', stagger: 0.1 }, 1.5);
    tl.call(() => { this.canWrite = true; }, undefined, 1.5);
  }

  // source.js:4396 — 红幕左扫：切主题在幕布覆盖时完成（contrasted 立即加类，复原等 onComplete）
  private toggleContrast() {
    let from = '0';
    let to = '-100%';
    if (document.documentElement.classList.contains('theme-contrasted')) {
      from = '-100%';
      to = '0';
    }
    gsap.fromTo(this.contrastMask, { x: from }, {
      x: to,
      duration: 1,
      ease: 'expo.inOut',
      onComplete: () => {
        this.contrastMask.style.transform = '';
        if (to === '0') document.documentElement.classList.remove('theme-contrasted');
        else document.documentElement.classList.add('theme-contrasted');
        $.emit('contrastchange', document.documentElement.classList.contains('theme-contrasted') ? 'contrasted' : 'default');
      },
    });
    if (to !== '0') document.documentElement.classList.add('theme-contrasted');
  }

  // 源站走 lenis.scrollTo；P0 决议无 Lenis，原生平滑滚动
  private moveToSection(e: MouseEvent) {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
    const target = href ? document.querySelector(href) : null;
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  // source.js:4417 — 打字节奏 verbatim：,和空格 100ms /…和。400ms/普通 20ms/换行 200ms/新消息前停 2s
  private updateConsole(time: number) {
    if (!this.canWrite || time - this.lastTypeTime < this.writeDelay) return;
    if (this.message === '') {
      this.message = this.getRandomMessage();
      this.writeDelay = 2000;
    } else {
      if (this.message === this.lastMessage || this.messageLineBreak) this.consoleEl.textContent += '\n';
      const char = this.message.charAt(0);
      this.message = this.message.substring(1);
      this.writeDelay = char === ',' ? 100 : char === ' ' ? 100 : char === '' ? 200 : char === '…' ? 400 : char === '.' ? 400 : 20;
      this.consoleEl.textContent += char;
      this.messageLineBreak = char === '…';
    }
    this.consoleEl.textContent = (this.consoleEl.textContent || '').split('\n').slice(-5).join('\n');
    this.lastTypeTime = time;
  }

  private getRandomMessage(): string {
    let msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    if (msg === this.lastMessage) msg = this.getRandomMessage();
    this.lastMessage = msg;
    return msg;
  }
}
