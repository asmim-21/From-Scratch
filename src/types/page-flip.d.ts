// The page-flip library ships without TypeScript types; these cover what we use.
declare module 'page-flip' {
  export type FlipCorner = 'top' | 'bottom';
  export type FlippingState = 'user_fold' | 'fold_corner' | 'flipping' | 'read';

  export interface FlipSetting {
    startPage: number;
    size: 'fixed' | 'stretch';
    width: number;
    height: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    swipeDistance: number;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
  }

  export interface FlipEvent<T> {
    data: T;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSetting>);
    loadFromHTML(items: HTMLElement[]): void;
    destroy(): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(page: number, corner?: FlipCorner): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getState(): FlippingState;
    getRender(): { getRect(): { left: number; height: number } };
    getPage(index: number): { setDensity(density: 'soft' | 'hard'): void };
    getFlipController(): {
      getCalculation(): { getDirection(): number } | null;
      flip(point: { x: number; y: number }): void;
      flipPrev(corner: FlipCorner): void;
    };
    on(event: 'flip', cb: (e: FlipEvent<number>) => void): PageFlip;
    on(event: 'changeState', cb: (e: FlipEvent<FlippingState>) => void): PageFlip;
  }
}
