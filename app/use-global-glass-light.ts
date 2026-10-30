"use client";

import { useEffect, type RefObject } from "react";

export const INTERACTIVE_DARK_GLASS = {
  selector: ".glass-card",
  lightRadius: 480,
  edgeRadius: 245,
  surfaceRadius: 390,
  surfaceHeight: 265,
  lightIntensity: .86,
  lightSoftness: 1.55,
  edgeReflection: .92,
  surfaceReflection: .18,
  glassOpacity: .9,
  refractionStrength: 1.4,
  movementSmoothing: .34,
  cornerReflection: 1.18,
} as const;

type LightState = {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  currentPresence: number;
  targetPresence: number;
  hasPointer: boolean;
  frame: number | null;
};

const distanceFromRect = (x: number, y: number, rect: DOMRect) => {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
};

const cornerProximity = (x: number, y: number, rect: DOMRect) => {
  const inset = Math.min(22, rect.width / 4, rect.height / 4);
  const corners = [
    [rect.left + inset, rect.top + inset],
    [rect.right - inset, rect.top + inset],
    [rect.left + inset, rect.bottom - inset],
    [rect.right - inset, rect.bottom - inset],
  ];
  const distance = Math.min(...corners.map(([cornerX, cornerY]) => Math.hypot(x - cornerX, y - cornerY)));
  return Math.max(0, 1 - distance / 115);
};

export function useGlobalGlassLight(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(pointer: coarse)").matches) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const config = INTERACTIVE_DARK_GLASS;
    const state: LightState = {
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      currentPresence: 0,
      targetPresence: 0,
      hasPointer: false,
      frame: null,
    };

    root.style.setProperty("--glass-edge-radius", `${config.edgeRadius}px`);
    root.style.setProperty("--glass-surface-radius", `${config.surfaceRadius}px`);
    root.style.setProperty("--glass-surface-height", `${config.surfaceHeight}px`);
    root.style.setProperty("--glass-opacity", `${config.glassOpacity}`);

    const render = () => {
      state.frame = null;
      const cards = Array.from(root.querySelectorAll<HTMLElement>(config.selector));
      if (root.hidden) {
        cards.forEach((card) => {
          card.style.setProperty("--glass-edge-strength", "0");
          card.style.setProperty("--glass-surface-strength", "0");
        });
        return;
      }
      const smoothing = reducedMotion ? 1 : config.movementSmoothing;
      state.currentX += (state.targetX - state.currentX) * smoothing;
      state.currentY += (state.targetY - state.currentY) * smoothing;
      const presenceSmoothing = state.targetPresence === 0 ? Math.max(.48, smoothing) : smoothing;
      state.currentPresence += (state.targetPresence - state.currentPresence) * presenceSmoothing;
      if (state.targetPresence === 0 && state.currentPresence < .004) state.currentPresence = 0;

      const measurements = cards.map((card) => ({ card, rect: card.getBoundingClientRect() }));

      measurements.forEach(({ card, rect }) => {
        const distance = distanceFromRect(state.currentX, state.currentY, rect);
        const normalizedDistance = Math.max(0, 1 - distance / config.lightRadius);
        const falloff = Math.pow(normalizedDistance, config.lightSoftness) * state.currentPresence;
        const cornerBoost = 1 + cornerProximity(state.currentX, state.currentY, rect) * (config.cornerReflection - 1);
        const localX = state.currentX - rect.left;
        const localY = state.currentY - rect.top;
        const directionX = localX - rect.width / 2;
        const directionY = localY - rect.height / 2;
        const directionLength = Math.hypot(directionX, directionY) || 1;
        const refraction = reducedMotion ? 0 : config.refractionStrength;
        const angle = Math.atan2(directionY, directionX) * 180 / Math.PI + 90;

        card.style.setProperty("--glass-light-x", `${localX.toFixed(2)}px`);
        card.style.setProperty("--glass-light-y", `${localY.toFixed(2)}px`);
        card.style.setProperty("--glass-light-angle", `${angle.toFixed(2)}deg`);
        card.style.setProperty("--glass-refract-x", `${(directionX / directionLength * refraction).toFixed(2)}px`);
        card.style.setProperty("--glass-refract-y", `${(directionY / directionLength * refraction).toFixed(2)}px`);
        card.style.setProperty("--glass-edge-strength", `${Math.min(1, falloff * config.lightIntensity * config.edgeReflection * cornerBoost).toFixed(3)}`);
        card.style.setProperty("--glass-surface-strength", `${Math.min(.24, falloff * config.lightIntensity * config.surfaceReflection).toFixed(3)}`);
      });

      const moving = Math.abs(state.targetX - state.currentX) > .15 || Math.abs(state.targetY - state.currentY) > .15;
      const fading = Math.abs(state.targetPresence - state.currentPresence) > .003;
      if (moving || fading) state.frame = window.requestAnimationFrame(render);
    };

    const schedule = () => {
      if (state.frame === null) state.frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      state.targetX = event.clientX;
      state.targetY = event.clientY;
      state.targetPresence = 1;
      if (!state.hasPointer) {
        state.currentX = event.clientX;
        state.currentY = event.clientY;
        state.hasPointer = true;
      }
      schedule();
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      state.targetPresence = 0;
      schedule();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    const visibilityObserver = new MutationObserver(schedule);
    visibilityObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    return () => {
      if (state.frame !== null) window.cancelAnimationFrame(state.frame);
      visibilityObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [rootRef]);
}
