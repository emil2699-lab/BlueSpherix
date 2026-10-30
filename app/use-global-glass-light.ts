"use client";

import { useEffect, type RefObject } from "react";

export const INTERACTIVE_DARK_GLASS = {
  selector: ".glass-card",
  lightRadius: 720,
  edgeRadius: 245,
  lightIntensity: .86,
  lightSoftness: 1.55,
  edgeReflection: .92,
  glassOpacity: .9,
  exitFade: .52,
  cornerReflection: 1.18,
} as const;

type LightState = {
  pointerX: number;
  pointerY: number;
  currentPresence: number;
  targetPresence: number;
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

const reflectedEdgePoint = (x: number, y: number, rect: DOMRect) => {
  const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  if (inside) return { x: x - rect.left, y: y - rect.top };
  return {
    x: Math.min(rect.width, Math.max(0, x - rect.left)),
    y: Math.min(rect.height, Math.max(0, y - rect.top)),
  };
};

export function useGlobalGlassLight(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(pointer: coarse)").matches) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const config = INTERACTIVE_DARK_GLASS;
    const state: LightState = {
      pointerX: 0,
      pointerY: 0,
      currentPresence: 0,
      targetPresence: 0,
      frame: null,
    };

    root.style.setProperty("--glass-edge-radius", `${config.edgeRadius}px`);
    root.style.setProperty("--glass-opacity", `${config.glassOpacity}`);

    const render = () => {
      state.frame = null;
      const cards = Array.from(root.querySelectorAll<HTMLElement>(config.selector));
      if (root.hidden) {
        cards.forEach((card) => {
          card.style.setProperty("--glass-edge-strength", "0");
        });
        return;
      }
      const presenceSmoothing = reducedMotion || state.targetPresence === 1 ? 1 : config.exitFade;
      state.currentPresence += (state.targetPresence - state.currentPresence) * presenceSmoothing;
      if (state.targetPresence === 0 && state.currentPresence < .004) state.currentPresence = 0;

      const measurements = cards.map((card) => ({ card, rect: card.getBoundingClientRect() }));

      measurements.forEach(({ card, rect }) => {
        const distance = distanceFromRect(state.pointerX, state.pointerY, rect);
        const normalizedDistance = Math.max(0, 1 - distance / config.lightRadius);
        const falloff = Math.pow(normalizedDistance, config.lightSoftness) * state.currentPresence;
        const cornerBoost = 1 + cornerProximity(state.pointerX, state.pointerY, rect) * (config.cornerReflection - 1);
        const edgePoint = reflectedEdgePoint(state.pointerX, state.pointerY, rect);

        card.style.setProperty("--glass-light-x", `${edgePoint.x.toFixed(2)}px`);
        card.style.setProperty("--glass-light-y", `${edgePoint.y.toFixed(2)}px`);
        card.style.setProperty("--glass-edge-strength", `${Math.min(1, falloff * config.lightIntensity * config.edgeReflection * cornerBoost).toFixed(3)}`);
      });

      const fading = Math.abs(state.targetPresence - state.currentPresence) > .003;
      if (fading) state.frame = window.requestAnimationFrame(render);
    };

    const schedule = () => {
      if (state.frame === null) state.frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.targetPresence = 1;
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
