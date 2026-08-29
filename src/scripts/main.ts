import { App, $ } from './core';
import { Scrollbar } from './scrollbar';
import { Head } from './head';
import { Hero } from './hero';
import { About } from './about';
import { Work } from './work';
import { MyWay } from './my-way';
import { Cta } from './cta';
import { Intro } from './intro';
import './waves';
import './separator';

const boot = () => {
  (window as any).__bootErrors = [];
  const safe = (name: string, fn: () => void) => {
    try { fn(); } catch (err) { (window as any).__bootErrors.push(`${name}: ${err}`); console.error(err); }
  };

  history.scrollRestoration = 'manual'; // source:2831
  // html SSR 带 is-scroll-blocked（100lvh）→ 浏览器恢复钳到 0，首帧即顶部无闪烁。
  // 解锁时机归 intro 时间轴 t5（source.js:4310）。
  addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollTo(0, 0);
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
  safe('cta', () => {
    const el = document.querySelector('.s-cta');
    if (el) new Cta(el as HTMLElement).init();
  });
  safe('intro', () => new Intro());
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
