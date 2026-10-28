"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

// Same feel as the reference site: ~1.1s glide with an exponential ease-out.
const options = {
  duration: 1.12,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
};

export default function SmoothScroll({ children }) {
  return (
    <ReactLenis root options={options}>
      {children}
    </ReactLenis>
  );
}
