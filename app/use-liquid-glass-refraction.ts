"use client";

import { useEffect, type RefObject } from "react";

export const LIQUID_GLASS_REFRACTION = {
  selector: ".glass-card",
  reach: 580,
  causticWidth: 88,
  causticHeight: 18,
  activeStrength: .68,
  nearbyStrength: .24,
  falloffPower: 1.45,
} as const;

type LiquidSurface = {
  card: HTMLElement;
  caustic: HTMLSpanElement;
  rect: DOMRect;
};

const distanceFromRect = (x: number, y: number, rect: DOMRect) => {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
};

const causticGeometry = (x: number, y: number, rect: DOMRect) => {
  const localX = x - rect.left;
  const localY = y - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const directionX = localX - centerX;
  const directionY = localY - centerY;
  const inside = localX >= 0 && localX <= rect.width && localY >= 0 && localY <= rect.height;
  const angle = directionX === 0 && directionY === 0 ? 0 : Math.atan2(directionY, directionX) + Math.PI / 2;

  if (inside) return { x: localX, y: localY, angle, inside };

  const horizontalScale = directionX === 0 ? Number.POSITIVE_INFINITY : centerX / Math.abs(directionX);
  const verticalScale = directionY === 0 ? Number.POSITIVE_INFINITY : centerY / Math.abs(directionY);
  const edgeScale = Math.min(horizontalScale, verticalScale);

  return {
    x: centerX + directionX * edgeScale,
    y: centerY + directionY * edgeScale,
    angle,
    inside,
  };
};

export function useLiquidGlassRefraction(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(pointer: coarse)").matches) return;

    const config = LIQUID_GLASS_REFRACTION;
    const surfaces: LiquidSurface[] = Array.from(root.querySelectorAll<HTMLElement>(config.selector)).map((card) => {
      const caustic = document.createElement("span");
      caustic.className = "liquid-glass-caustic";
      caustic.setAttribute("aria-hidden", "true");
      card.appendChild(caustic);
      return { card, caustic, rect: card.getBoundingClientRect() };
    });
    let geometryDirty = false;

    const measureSurfaces = () => {
      surfaces.forEach((surface) => {
        surface.rect = surface.card.getBoundingClientRect();
      });
      geometryDirty = false;
    };

    const markGeometryDirty = () => {
      geometryDirty = true;
    };

    const hideCaustics = () => {
      surfaces.forEach(({ caustic }) => {
        caustic.style.opacity = "0";
      });
    };

    const handlePointerMove: EventListener = (nativeEvent) => {
      if (root.hidden) return;
      const pointerEvent = nativeEvent as PointerEvent;
      if (pointerEvent.pointerType === "touch") return;
      const samples = pointerEvent.getCoalescedEvents?.() ?? [];
      const pointer = samples.at(-1) ?? pointerEvent;
      if (geometryDirty) measureSurfaces();

      const updates = surfaces.map((surface) => {
        const distance = distanceFromRect(pointer.clientX, pointer.clientY, surface.rect);
        const proximity = Math.max(0, 1 - distance / config.reach);
        const geometry = causticGeometry(pointer.clientX, pointer.clientY, surface.rect);
        const strength = geometry.inside
          ? config.activeStrength
          : Math.pow(proximity, config.falloffPower) * config.nearbyStrength;
        return { surface, geometry, strength };
      });

      updates.forEach(({ surface, geometry, strength }) => {
        const translateX = geometry.x - config.causticWidth / 2;
        const translateY = geometry.y - config.causticHeight / 2;
        surface.caustic.style.transform = `translate3d(${translateX.toFixed(2)}px,${translateY.toFixed(2)}px,0) rotate(${geometry.angle.toFixed(4)}rad)`;
        surface.caustic.style.opacity = strength.toFixed(3);
      });
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      hideCaustics();
    };

    measureSurfaces();
    const pointerMoveEvent = "onpointerrawupdate" in window ? "pointerrawupdate" : "pointermove";
    window.addEventListener(pointerMoveEvent, handlePointerMove, { passive: true, capture: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    window.addEventListener("resize", markGeometryDirty, { passive: true });
    window.addEventListener("scroll", markGeometryDirty, { passive: true });

    const resizeObserver = new ResizeObserver(markGeometryDirty);
    resizeObserver.observe(root);
    surfaces.forEach(({ card }) => resizeObserver.observe(card));
    const visibilityObserver = new MutationObserver(() => {
      markGeometryDirty();
      if (root.hidden) hideCaustics();
    });
    visibilityObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener(pointerMoveEvent, handlePointerMove, { capture: true });
      window.removeEventListener("pointerout", handlePointerLeave);
      window.removeEventListener("resize", markGeometryDirty);
      window.removeEventListener("scroll", markGeometryDirty);
      surfaces.forEach(({ caustic }) => caustic.remove());
    };
  }, [rootRef]);
}
