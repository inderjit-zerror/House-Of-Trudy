// Scroll choreography of the hero, ported from the reference's Webflow
// "Statue Scrollable" interactions, with one timeline for desktop and
// tablet and another for phones (767px and below).

// Webflow smoothing 97: every 60fps frame closes 3% of the remaining gap.
const SMOOTHING = 0.97;

export function damp(current, target, dt) {
  return target + (current - target) * Math.pow(SMOOTHING, dt * 60);
}

// Desktop counts from the hero entering at the bottom of the viewport to it
// leaving through the top, so at the top of the page it already reads ~0.13
// and it reads ~0.87 when the sticky stage starts scrolling away. Phones
// count from the hero's top reaching the top of the viewport.
export function scrollProgress(scrollY, top, height, viewport, mobile) {
  const p = mobile ? (scrollY - top) / height : (scrollY + viewport - top) / (height + viewport);
  return Math.min(Math.max(p, 0), 1);
}

function cubicBezier(x1, y1, x2, y2) {
  const bez = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return bez((lo + hi) / 2, y1, y2);
  };
}

const EASE_OUT = cubicBezier(0, 0, 0.58, 1);
const TO_GREY = cubicBezier(0.62, 0.012, 0.339, 0.995);
const TO_BLACK = cubicBezier(0.626, 0.007, 0.345, 0.989);

// Tracks are lists of [progress, value, easing into this key].
const STATUE = [
  [0.13, 0],
  [1, 1, EASE_OUT],
];
const MOBILE_STATUE = [
  [0, 0],
  [1, 1, EASE_OUT],
];
const BACKGROUND = [
  [0.77, [224, 224, 224, 0]],
  [0.82, [224, 224, 224, 1], TO_GREY],
  [0.85, [1, 1, 1, 1], TO_BLACK],
];
const BOX_OPACITY = [
  [0.82, 1],
  [0.85, 0],
];

// Phones only: the statue drifts in and out of focus and its box grows.
const MOBILE_BLUR = [
  [0, 0],
  [0.12, 5],
  [0.21, 0],
  [0.38, 5],
  [0.48, 0],
];
const MOBILE_OPACITY = [
  [0, 1],
  [0.12, 0.65],
  [0.21, 1],
  [0.38, 0.65],
  [0.48, 1],
];
const MOBILE_BOX_HEIGHT = [
  [0, 84],
  [0.12, 84],
  [0.17, 95],
];

const mix = (a, b, t) =>
  Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t;

function track(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [at, value, ease] = keys[i];
    if (p <= at) {
      const [prevAt, prevValue] = keys[i - 1];
      const t = (p - prevAt) / (at - prevAt);
      return mix(prevValue, value, ease ? ease(t) : t);
    }
  }
  return keys[keys.length - 1][1];
}

export function sample(p, mobile) {
  return {
    statue: track(mobile ? MOBILE_STATUE : STATUE, p),
    background: track(BACKGROUND, p),
    boxOpacity: track(BOX_OPACITY, p),
    blur: mobile ? track(MOBILE_BLUR, p) : 0,
    statueOpacity: mobile ? track(MOBILE_OPACITY, p) : 1,
    boxHeight: mobile ? track(MOBILE_BOX_HEIGHT, p) : 100,
  };
}
