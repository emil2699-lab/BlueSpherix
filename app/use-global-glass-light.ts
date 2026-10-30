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
  frame: number | null;
};

type CardMeasurement = {
  card: HTMLElement;
  rect: DOMRect;
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

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const directionX = x - (rect.left + centerX);
  const directionY = y - (rect.top + centerY);
  const horizontalScale = directionX === 0 ? Number.POSITIVE_INFINITY : centerX / Math.abs(directionX);
  const verticalScale = directionY === 0 ? Number.POSITIVE_INFINITY : centerY / Math.abs(directionY);
  const edgeScale = Math.min(horizontalScale, verticalScale);

  return {
    x: centerX + directionX * edgeScale,
    y: centerY + directionY * edgeScale,
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
      frame: null,
    };
    let measurements: CardMeasurement[] = [];

    root.style.setProperty("--glass-edge-radius", `${config.edgeRadius}px`);
    root.style.setProperty("--glass-opacity", `${config.glassOpacity}`);

    const refreshMeasurements = () => {
      measurements = Array.from(root.querySelectorAll<HTMLElement>(config.selector)).map((card) => ({
        card,
        rect: card.getBoundingClientRect(),
      }));
    };

    const renderAtPointer = (presence: number) => {
      if (root.hidden) {
        measurements.forEach(({ card }) => {
          card.style.setProperty("--glass-edge-strength", "0");
        });
        return;
      }

      measurements.forEach(({ card, rect }) => {
        const distance = distanceFromRect(state.pointerX, state.pointerY, rect);
        const normalizedDistance = Math.max(0, 1 - distance / config.lightRadius);
        const falloff = Math.pow(normalizedDistance, config.lightSoftness) * presence;
        const cornerBoost = 1 + cornerProximity(state.pointerX, state.pointerY, rect) * (config.cornerReflection - 1);
        const edgePoint = reflectedEdgePoint(state.pointerX, state.pointerY, rect);

        card.style.setProperty("--glass-light-x", `${edgePoint.x.toFixed(2)}px`);
        card.style.setProperty("--glass-light-y", `${edgePoint.y.toFixed(2)}px`);
        card.style.setProperty("--glass-edge-strength", `${Math.min(1, falloff * config.lightIntensity * config.edgeReflection * cornerBoost).toFixed(3)}`);
      });
    };

    const fadeOut = () => {
      state.frame = null;
      state.currentPresence = reducedMotion ? 0 : state.currentPresence * (1 - config.exitFade);
      if (state.currentPresence < .004) state.currentPresence = 0;
      renderAtPointer(state.currentPresence);
      if (state.currentPresence > 0) state.frame = window.requestAnimationFrame(fadeOut);
    };

    const refreshAndRender = () => {
      refreshMeasurements();
      renderAtPointer(state.currentPresence);
    };

    const handlePointerMove: EventListener = (nativeEvent) => {
      const event = nativeEvent as PointerEvent;
      if (event.pointerType === "touch") return;
      if (state.frame !== null) {
        window.cancelAnimationFrame(state.frame);
        state.frame = null;
      }
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.currentPresence = 1;
      renderAtPointer(1);
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      if (state.frame === null) state.frame = window.requestAnimationFrame(fadeOut);
    };

    refreshMeasurements();
    const pointerMoveEvent = "onpointerrawupdate" in window ? "pointerrawupdate" : "pointermove";
    window.addEventListener(pointerMoveEvent, handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("resize", refreshAndRender, { passive: true });
    window.addEventListener("scroll", refreshAndRender, { passive: true });
    const resizeObserver = new ResizeObserver(refreshAndRender);
    resizeObserver.observe(root);
    const visibilityObserver = new MutationObserver(refreshAndRender);
    visibilityObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    return () => {
      if (state.frame !== null) window.cancelAnimationFrame(state.frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener(pointerMoveEvent, handlePointerMove);
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("resize", refreshAndRender);
      window.removeEventListener("scroll", refreshAndRender);
    };
  }, [rootRef]);
}
