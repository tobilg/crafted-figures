// biome-ignore-all lint/suspicious/noExplicitAny: these expandos hold untyped tool handles
/** The DOM the kit runs in: browser globals its pages add, and SVG members it reads through
 * generic `querySelector` results. */
declare global {
  interface Element {
    __craftedController?: any;
    __stage?: any;
    __effects?: any;
    __motion?: any;
    __craftedCleanup?: () => void;
    dataset?: DOMStringMap;
    style?: CSSStyleDeclaration;
    getBBox?(): DOMRect;
    getScreenCTM?(): DOMMatrix;
    getTotalLength?(): number;
    getPointAtLength?(distance: number): DOMPoint;
    isPointInFill?(point: DOMPointInit): boolean;
    viewBox?: { baseVal: DOMRect };
    ownerSVGElement?: SVGSVGElement | null;
  }
  interface EventTarget {
    dataset?: DOMStringMap;
  }
}
export {};
