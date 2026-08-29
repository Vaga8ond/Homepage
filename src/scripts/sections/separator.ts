import { $, REDUCED } from '../core';

/* <x-separator>: triangles + binary code groups separated by stripes.
   Each char is the "01" pseudo-element trick: a transparent text node for
   width, the visible glyph shifted by the a__char--0/1 class. */
export class Separator extends HTMLElement {
  private chars: HTMLElement[] = [];
  private isPaused = true;

  connectedCallback() {
    this.build();
    this.addEventListener('intersect', (e: Event) => {
      this.isPaused = !(e as CustomEvent).detail.isIntersecting;
      if (this.isPaused || REDUCED) $.off('tick', this.tick, this);
      else $.on('tick', this.tick, this);
    }, { passive: true });
  }

  private build() {
    this.textContent = '';
    const triLeft = document.createElement('span');
    triLeft.className = 'a__triangle';
    const triRight = document.createElement('span');
    triRight.className = 'a__triangle';
    const binaries = document.createElement('span');
    binaries.className = 'a__binaries';

    const groups = Math.max(4, Math.round((window.safeWidth || 1280) / 130));
    for (let g = 0; g < groups; g++) {
      const code = document.createElement('span');
      code.className = 'a__code js-code';
      const bits = 7 + (g % 2); // 7 或 8 位，组长度有变化
      for (let i = 0; i < bits; i++) {
        const blank = i === bits - 2;
        const bit = Math.random() > .5 ? 1 : 0;
        const char = document.createElement('span');
        char.className = blank
          ? 'a__char a__char--blank js-char'
          : `a__char a__char--${bit} js-char`;
        char.textContent = blank ? '\u00A0' : String(bit);
        code.appendChild(char);
        if (!blank) this.chars.push(char);
      }
      binaries.appendChild(code);
      const stripes = document.createElement('span');
      stripes.className = 'a__stripes';
      binaries.appendChild(stripes);
    }
    this.append(triLeft, binaries, triRight);
  }

  private tick() {
    this.chars.forEach((c) => {
      if (c.classList.contains('a__char--blank') || Math.random() > .1) return;
      const toOne = !c.classList.contains('a__char--1');
      c.classList.remove('a__char--0', 'a__char--1');
      c.classList.add(toOne ? 'a__char--1' : 'a__char--0');
      c.textContent = toOne ? '1' : '0';
    });
  }
}
customElements.define('x-separator', Separator);
