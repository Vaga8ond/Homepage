import { $, REDUCED } from './core';

/* <a-separator>：二进制码组翻转（source.js Cc verbatim）。
   标记为 SSR 静态（index.astro set:html 生成），翻转逐字符 10%/tick 概率。 */
export class Separator extends HTMLElement {
  private chars!: NodeListOf<HTMLElement>;
  private isPaused = true;

  connectedCallback() {
    this.chars = this.querySelectorAll('.js-char');
    this.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      if (this.isPaused || REDUCED) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
  }

  private tick() {
    this.chars.forEach((c) => {
      if (c.classList.contains('a__char--blank') || Math.random() > .1) return;
      c.classList.remove('a__char--0', 'a__char--1');
      c.classList.add(Math.random() > .5 ? 'a__char--1' : 'a__char--0');
    });
  }
}
customElements.define('a-separator', Separator);
