import { App, $ } from './core';
import { Scrollbar } from './scrollbar';
import { Head } from './head';
import { Hero } from './hero';
import { About } from './about';
import { Work } from './work';
import { MyWay } from './my-way';
import './waves';
import './separator';

const boot = () => {
  (window as any).__bootErrors = [];
  const safe = (name: string, fn: () => void) => {
    try { fn(); } catch (err) { (window as any).__bootErrors.push(`${name}: ${err}`); console.error(err); }
  };

  history.scrollRestoration = 'manual'; // source:2831
  // html SSR 带 is-scroll-blocked（100lvh）→ 浏览器恢复钳到 0，首帧即顶部无闪烁。
  // load+2帧解锁；P7 preloader 建成后此解锁时机归它接管。
  addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollTo(0, 0);
      document.documentElement.classList.remove('is-scroll-blocked');
    }));
  });

  safe('app', () => new App().init());
  safe('scrollbar', () => new Scrollbar());
  safe('head', () => new Head());
  safe('hero', () => new Hero());
  safe('about', () => new About());
  safe('work', () => new Work());
  safe('my-way', () => {
    const el = document.querySelector('.s-my-way');
    if (el) new MyWay(el as HTMLElement).init();
  });
  // intro 契约桩：head/hero 等入场都挂 'intro' 事件；P7 preloader 建成后移除
  safe('intro-signal', () => $.once('siteLoaded', () => document.dispatchEvent(new CustomEvent('intro'))));
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
