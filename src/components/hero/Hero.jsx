"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Manrope } from "next/font/google";
import FogCanvas from "./FogCanvas";
import { damp, sample, scrollProgress } from "./timeline";
import styles from "./Hero.module.css";

const StatueCanvas = dynamic(() => import("./StatueCanvas"), { ssr: false });

const display = Manrope({ subsets: ["latin"], weight: ["700"] });

export default function Hero({ title = "ZERROR", caption = null, scrollHint = "Keep scrolling" }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const boxRef = useRef(null);
  const statueRef = useRef(null);
  const motion = useRef({ statue: 0 });
  const [loaded, setLoaded] = useState(false);
  const handleReady = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const box = boxRef.current;
    const statue = statueRef.current;
    const mobile = window.matchMedia("(max-width: 767px)");

    let top = 0;
    let height = 0;
    const measure = () => {
      top = root.getBoundingClientRect().top + window.scrollY;
      height = root.offsetHeight;
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);

    let progress = null;
    let applied = null;
    let last = performance.now();
    let frame = 0;

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const target = scrollProgress(window.scrollY, top, height, window.innerHeight, mobile.matches);
      progress = progress === null ? target : damp(progress, target, dt);
      if (applied !== null && Math.abs(progress - applied) < 1e-5) return;
      applied = progress;

      const state = sample(progress, mobile.matches);
      const [r, g, b, a] = state.background;
      motion.current.statue = state.statue;
      stage.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
      box.style.opacity = state.boxOpacity;
      box.style.height = `${state.boxHeight}%`;
      statue.style.opacity = state.statueOpacity;
      statue.style.filter = state.blur > 0.01 ? `blur(${state.blur}px)` : "";
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <section ref={rootRef} className={styles.hero}>
      <div className={`${styles.part} ${styles.intro}`}>
        <div className={styles.wrapper}>
          {title && <h1 className={`${styles.title} ${display.className}`}>{title}</h1>}
          {caption && <p className={`${styles.caption} ${styles.middleCaption}`}>{caption}</p>}
          {scrollHint && <p className={`${styles.caption} ${styles.scrollHint}`}>{scrollHint}</p>}
        </div>
      </div>

      {/* Scroll runway for the statue's orbit; content placed here sits above the statue. */}
      <div className={`${styles.part} ${styles.long}`} />
      <div className={`${styles.part} ${styles.long}`} />
      <div className={`${styles.part} ${styles.outro}`} />

      {/* Sticky to both edges, so it stays pinned for the whole hero, starting at its top. */}
      <div ref={stageRef} className={styles.stage} aria-hidden="true">
        <div ref={boxRef} className={styles.box}>
          <div ref={statueRef} className={styles.statue}>
            <div className={`${styles.reveal} ${loaded ? styles.loaded : ""}`}>
              <StatueCanvas motion={motion} onReady={handleReady} />
            </div>
          </div>
          <FogCanvas className={styles.fog} />
        </div>
      </div>
    </section>
  );
}
