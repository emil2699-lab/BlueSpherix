"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { buildLensField } from "../ice-glass-lens";
import styles from "./prototype.module.css";

type GlassVariables = CSSProperties & Record<`--${string}`, string>;

const GLASS = {
  radius: 56,
  thickness: 18,
  ior: 1.49,
  lift: 82,
  perspective: 1100,
} as const;

export function ConvexGlassDemo() {
  const reactId = useId();
  const filterId = `convex-glass-${reactId.replaceAll(":", "")}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SVGFEImageElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const targetRef = useRef(0);
  const progressRef = useRef(0);
  const rangeRef = useRef(1);
  const frameRef = useRef(0);
  const renderFrameRef = useRef<(time: number) => void>(() => undefined);
  const lastFrameRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const [refraction, setRefraction] = useState<"ready" | "fallback">("fallback");

  const renderFrame = useCallback((time: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const elapsed = lastFrameRef.current ? Math.min(500, time - lastFrameRef.current) : 16;
    lastFrameRef.current = time;
    const target = reducedMotionRef.current ? 0 : targetRef.current;
    const response = 1 - Math.exp(-elapsed / (target > progressRef.current ? 90 : 210));
    const next = progressRef.current + (target - progressRef.current) * response;
    progressRef.current = Math.abs(target - next) < 0.001 ? target : next;

    const lift = progressRef.current;
    const z = GLASS.lift * lift;
    const shadowX = 12 + 12 * lift;
    const shadowY = 20 + 18 * lift;
    const shadowBlur = 32 + 20 * lift;
    const shadowSpread = -8 + 6 * lift;
    const shadowAlpha = 0.26 - 0.08 * lift;
    const variables: GlassVariables = {
      "--lift": lift.toFixed(4),
      "--glass-z": `${z.toFixed(2)}px`,
      "--shadow-x": `${shadowX.toFixed(2)}px`,
      "--shadow-y": `${shadowY.toFixed(2)}px`,
      "--shadow-blur": `${shadowBlur.toFixed(2)}px`,
      "--shadow-spread": `${shadowSpread.toFixed(2)}px`,
      "--shadow-alpha": shadowAlpha.toFixed(4),
      "--reflection-shift": `${(lift * 7).toFixed(2)}px`,
    };
    for (const [name, value] of Object.entries(variables)) stage.style.setProperty(name, value);

    const displacement = rangeRef.current * 2 * (0.11 + 0.89 * lift);
    displacementRef.current?.setAttribute("scale", displacement.toFixed(3));

    if (progressRef.current !== target) frameRef.current = requestAnimationFrame((nextTime) => renderFrameRef.current(nextTime));
    else {
      frameRef.current = 0;
      lastFrameRef.current = 0;
    }
  }, []);

  useEffect(() => {
    renderFrameRef.current = renderFrame;
  }, [renderFrame]);

  const animateTo = useCallback((target: number) => {
    targetRef.current = reducedMotionRef.current ? 0 : target;
    if (!frameRef.current) frameRef.current = requestAnimationFrame((time) => renderFrameRef.current(time));
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const glass = glassRef.current;
    const map = mapRef.current;
    if (!stage || !glass || !map) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      reducedMotionRef.current = motion.matches;
      if (motion.matches) animateTo(0);
    };
    syncMotion();
    motion.addEventListener("change", syncMotion);

    const userAgent = navigator.userAgent;
    const browserRejectsSvgBackdrop = /Firefox/.test(userAgent) || (/Safari/.test(userAgent) && !/Chrome|Chromium|Edg/.test(userAgent));
    const supportsSvgBackdrop = !browserRejectsSvgBackdrop && CSS.supports("backdrop-filter", "url(#glass)");
    const opticalFilter = supportsSvgBackdrop
      ? `url(#${filterId}) blur(0.6px) saturate(1.08)`
      : "blur(10px) saturate(1.06)";
    glass.style.backdropFilter = opticalFilter;
    glass.style.setProperty("-webkit-backdrop-filter", opticalFilter);
    setRefraction(supportsSvgBackdrop ? "ready" : "fallback");

    let resizeFrame = 0;
    const buildMap = () => {
      const width = glass.offsetWidth;
      const height = glass.offsetHeight;
      if (!width || !height) return;
      const radius = Math.min(GLASS.radius, width * 0.475, height * 0.475);
      const field = buildLensField({
        width,
        height,
        radius,
        thickness: Math.min(GLASS.thickness, width * 0.2, height * 0.2),
        ior: GLASS.ior,
        distance: GLASS.lift,
        paraxial: 0.075,
      });
      const bitmap = document.createElement("canvas");
      bitmap.width = field.width;
      bitmap.height = field.height;
      const context = bitmap.getContext("2d");
      if (!context) return;
      const pixels = context.createImageData(field.width, field.height);
      pixels.data.set(field.data);
      context.putImageData(pixels, 0, 0);
      rangeRef.current = field.range;
      map.setAttribute("href", bitmap.toDataURL("image/png"));
      map.setAttribute("width", String(width));
      map.setAttribute("height", String(height));
      renderFrame(performance.now());
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(buildMap);
    });
    observer.observe(glass);
    buildMap();

    return () => {
      observer.disconnect();
      motion.removeEventListener("change", syncMotion);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(frameRef.current);
    };
  }, [animateTo, filterId, renderFrame]);

  const initialVariables: GlassVariables = {
    "--lift": "0",
    "--glass-z": "0px",
    "--shadow-x": "12px",
    "--shadow-y": "20px",
    "--shadow-blur": "32px",
    "--shadow-spread": "-8px",
    "--shadow-alpha": "0.26",
    "--reflection-shift": "0px",
  };

  return (
    <main className={styles.root}>
      <svg className={styles.filterHost} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feImage ref={mapRef} x="0" y="0" preserveAspectRatio="none" result="lensMap" />
            <feComponentTransfer in="lensMap" result="lensCoordinates">
              <feFuncR type="linear" slope={255 / 254} intercept={-1 / 254} />
              <feFuncG type="linear" slope={255 / 254} intercept={-1 / 254} />
            </feComponentTransfer>
            <feDisplacementMap ref={displacementRef} in="SourceGraphic" in2="lensCoordinates" scale="0" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <header className={styles.header}>
        <span>BlueSpherix · Material Lab</span>
        <strong>Convex Glass 01</strong>
      </header>

      <section className={styles.presentation} aria-labelledby="prototype-title">
        <div className={styles.intro}>
          <p>Prototipo isolato</p>
          <h1 id="prototype-title">Vetro chiaro, spesso e vivo.</h1>
          <span>Passa il cursore sulla lente: il contenuto rimane sulla base.</span>
        </div>

        <div
          ref={stageRef}
          className={styles.stage}
          style={initialVariables}
          tabIndex={0}
          data-refraction={refraction}
          onPointerEnter={() => animateTo(1)}
          onPointerLeave={() => animateTo(0)}
          onFocus={() => animateTo(1)}
          onBlur={() => animateTo(0)}
          aria-label="Prototipo interattivo di una lente di vetro convessa"
        >
          <div className={styles.shadow} aria-hidden="true" />
          <div className={styles.baseContent}>
            <div className={styles.row}>
              <strong>Trader A:</strong>
              <span className={styles.loading}><i aria-hidden="true" /> Loading</span>
            </div>
            <div className={styles.row}>
              <strong>Trader B:</strong>
              <span className={styles.loading}><i aria-hidden="true" /> Loading</span>
            </div>
            <div className={styles.row}>
              <strong>BlueSpherix Traders:</strong>
              <span className={styles.completed}><i aria-hidden="true">✓</i> Completed</span>
            </div>
          </div>
          <div ref={glassRef} className={styles.glass} aria-hidden="true" />
        </div>

        <div className={styles.status} aria-live="polite">
          <i data-state={refraction} />
          {refraction === "ready" ? "Rifrazione SVG del backdrop attiva" : "Fallback ottico attivo"}
        </div>
      </section>
    </main>
  );
}
