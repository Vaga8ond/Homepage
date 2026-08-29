import { App, $ } from './core';
import './sections/waves';
import './sections/separator';
import { Preloader } from './sections/preloader';
import { Head } from './sections/head';
import { Hero } from './sections/hero';
import { About } from './sections/about';
import { Work } from './sections/work';
import { Cta } from './sections/cta';
import { Scrollbar } from './scrollbar';

const app = new App();

const boot = () => {
  (window as any).__bootErrors = [];
  const safe = (name: string, fn: () => void) => {
    try { fn(); } catch (err) { (window as any).__bootErrors.push(`${name}: ${err}`); console.error(err); }
  };
  safe('app', () => app.init());
  safe('scrollbar', () => new Scrollbar());
  safe('preloader', () => new Preloader());
  safe('head', () => new Head());
  safe('hero', () => new Hero());
  safe('about', () => new About());
  safe('work', () => new Work());
  safe('cta', () => new Cta());
  $.on('unlockScroll', () => app.unlockScroll());
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
