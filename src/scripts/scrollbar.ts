import { $ } from './core';

// 自绘滚动条 — 结构/交互对齐 source.css:518-590 + source.js setScrollbar/拖拽
export class Scrollbar {
  private el = document.querySelector('.js-scrollbar') as HTMLElement;
  private thumb = document.querySelector('.js-scrollbar-thumb') as HTMLElement;
  private dragging = false;
  private pointerId = -1;

  constructor() {
    $.on('scroll', () => this.update());
    $.on('resize', () => this.update());
    $.once('siteLoaded', () => this.update());

    this.thumb.addEventListener('pointerdown', this.onDown.bind(this));
    addEventListener('pointermove', this.onMove.bind(this));
    addEventListener('pointerup', this.onUp.bind(this));
    this.update();
  }

  // thumb 高度 = 视口占文档比例；top = 滚动比例（走 CSS 变量，样式在 global.css）
  private update() {
    const doc = document.documentElement;
    const overflow = doc.scrollHeight - window.innerHeight;
    if (overflow <= 0) { this.thumb.style.opacity = '0'; return; }
    this.thumb.style.opacity = '';
    const barHeight = Math.max(24, (window.innerHeight / doc.scrollHeight) * window.innerHeight);
    const maxBar = window.innerHeight - barHeight;
    const top = (window.scrollY / overflow) * maxBar;
    this.thumb.style.setProperty('--scrollbar-height', `${barHeight}px`);
    this.thumb.style.setProperty('--scrollbar-top', `${top}px`);
  }

  private onDown(e: PointerEvent) {
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.el.classList.add('is-dragging');
    this.seek(e.clientY);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.seek(e.clientY);
  }

  private onUp(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.el.classList.remove('is-dragging');
  }

  // 拖拽点映射回文档滚动位（抓中点不跳变：以 thumb 当前中心为锚）
  private seek(clientY: number) {
    const rect = this.el.getBoundingClientRect();
    const doc = document.documentElement;
    const overflow = doc.scrollHeight - window.innerHeight;
    const barHeight = this.thumb.getBoundingClientRect().height;
    const maxBar = window.innerHeight - barHeight;
    if (maxBar <= 0 || overflow <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top - barHeight / 2) / maxBar));
    window.scrollTo(0, ratio * overflow);
  }
}
