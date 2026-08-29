import { $, ticker } from './core';

export class Scrollbar {
  private el: HTMLElement;
  private thumb: HTMLElement;
  private drag = { startY: 0, startScroll: 0 };
  private isDragging = false;

  constructor() {
    this.el = document.querySelector('.site-scrollbar') as HTMLElement;
    this.thumb = this.el.querySelector('.js-thumb') as HTMLElement;
    document.documentElement.classList.add('has-scrollbar');
    this.setScrollbar();
    this.bindEvents();
  }

  private bindEvents() {
    $.on('resize', () => this.setScrollbar(), this, true);
    $.on('scroll', () => this.setScrollbar(), this, true);
    $.on('siteLoaded', () => this.setScrollbar(), this, true);
    $.on('updateViewport', () => this.setScrollbar(), this, true);
    const start = (e: Event) => {
      this.isDragging = true;
      this.drag.startY = e instanceof MouseEvent ? e.clientY : (e as TouchEvent).touches[0].clientY;
      this.drag.startScroll = window.scrollProgress;
      this.el.classList.add('is-dragging');
      e.preventDefault();
    };
    this.thumb.addEventListener('mousedown', start);
    this.thumb.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', (e) => this.move(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    document.addEventListener('mouseup', () => this.end());
    document.addEventListener('touchend', () => this.end());
  }

  private move(e: Event) {
    if (!this.isDragging) return;
    const y = e instanceof MouseEvent ? e.clientY : (e as TouchEvent).touches[0].clientY;
    const delta = (y - this.drag.startY) / window.safeHeight;
    window.scrollTo(0, (this.drag.startScroll + delta) * window.maxScrollTop);
    e.preventDefault();
  }

  private end() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.el.classList.remove('is-dragging');
  }

  private setScrollbar() {
    const h = (window.safeHeight / document.body.scrollHeight) * window.safeHeight;
    const top = window.scrollProgress * (window.safeHeight - h);
    this.el.style.setProperty('--scrollbar-height', `${h}px`);
    this.el.style.setProperty('--scrollbar-top', `${top}px`);
  }
}
