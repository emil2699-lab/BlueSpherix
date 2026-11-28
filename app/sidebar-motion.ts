"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

type Pose = { width: number; height: number; neck: number; sweep: number; room: number; button: number; bounce: number; reflection: number };
const CLOSED: Pose = { width: 0, height: 0, neck: 0, sweep: 0, room: 0, button: 0, bounce: 0, reflection: .07 };
const OPEN: Pose = { ...CLOSED, width: 1, height: 1, room: 1, button: 1, reflection: .93 };
const duration = 510;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function ease(t: number, start: number, end: number) {
  const x = clamp((t - start) / (end - start));
  return x * x * (3 - 2 * x);
}
function pulse(t: number, start: number, peak: number, end: number) {
  return ease(t, start, peak) * (1 - ease(t, peak, end));
}

function poseAt(from: Pose, open: boolean, t: number): Pose {
  const to = open ? OPEN : CLOSED;
  const stretch = open ? pulse(t, .37, .76, 1) : 0;
  const curl = pulse(t, 0, .34, .70);
  return {
    width: mix(from.width, to.width, open ? ease(t, .03, .74) : ease(t, 0, .71)) + .036 * stretch,
    height: mix(from.height, to.height, open ? ease(t, 0, .67) : ease(t, .07, .71)) + .014 * stretch,
    neck: Math.min(.92, from.neck * (1 - ease(t, 0, .35)) + .85 * curl),
    sweep: mix(from.sweep, 0, ease(t, 0, .40)) + (open ? -.42 : 1) * curl,
    room: mix(from.room, to.room, ease(t, .02, .82)) + .016 * stretch,
    button: mix(from.button, to.button, ease(t, 0, .65)),
    bounce: from.bounce * (1 - ease(t, 0, .32)) + (open ? 0 : pulse(t, .67, .81, 1) * 5),
    reflection: mix(from.reflection, to.reflection, ease(t, 0, 1)),
  };
}

function paintFold(ctx: CanvasRenderingContext2D, pose: Pose, w: number, h: number, button: number, light: boolean) {
  const rebound = pose.bounce;
  const width = mix(button, w, pose.width) + rebound;
  const height = mix(button, h, pose.height) + rebound;
  const inset = rebound / 2;
  const topWidth = mix(width, button + rebound, pose.neck);
  const radius = Math.min(mix(18, 36, clamp(pose.width)), width * .42, height * .48);
  const lip = Math.min(topWidth * .42, radius);
  const drift = pose.sweep * Math.min(19, (height - button) * .18);
  const neckY = Math.max(lip, height * .27);
  const sideX = width + drift;
  const sideY = height - radius;
  const outline = new Path2D();
  outline.moveTo(lip, 0);
  outline.lineTo(topWidth - lip, 0);
  outline.quadraticCurveTo(topWidth, 0, topWidth, lip);
  outline.bezierCurveTo(topWidth, neckY, sideX, height * .49, sideX, sideY);
  outline.quadraticCurveTo(sideX, height, sideX - radius, height);
  outline.lineTo(drift + radius, height);
  outline.quadraticCurveTo(drift, height, drift, sideY);
  outline.bezierCurveTo(drift, height * .56, 0, neckY, 0, lip);
  outline.quadraticCurveTo(0, 0, lip, 0);
  outline.closePath();

  ctx.save();
  ctx.translate(-inset, -inset);
  const body = ctx.createLinearGradient(0, 0, width * .91, height * .44);
  body.addColorStop(0, light ? "rgba(230,252,252,.61)" : "rgba(17,31,43,.82)");
  body.addColorStop(.48, light ? "rgba(173,218,226,.16)" : "rgba(14,24,36,.55)");
  body.addColorStop(1, light ? "rgba(161,205,222,.34)" : "rgba(27,49,66,.63)");
  ctx.fillStyle = body;
  ctx.fill(outline);

  // A travelling reflection follows the bowed side and turns across the toe.
  const wave = pose.reflection;
  const rim = ctx.createLinearGradient(0, 0, 0, height);
  rim.addColorStop(0, light ? "rgba(255,255,255,.9)" : "rgba(173,214,236,.34)");
  rim.addColorStop(Math.max(0, wave - .17), light ? "rgba(94,138,157,.27)" : "rgba(96,158,192,.24)");
  rim.addColorStop(wave, light ? "rgba(255,255,255,.98)" : "rgba(219,250,255,.84)");
  rim.addColorStop(Math.min(1, wave + .17), light ? "rgba(95,151,176,.3)" : "rgba(67,120,159,.24)");
  rim.addColorStop(1, light ? "rgba(255,255,255,.73)" : "rgba(146,202,231,.4)");
  ctx.save();
  ctx.clip(outline);
  ctx.lineWidth = light ? 5.5 : 6.5;
  ctx.strokeStyle = light ? "rgba(81,155,180,.22)" : "rgba(53,125,172,.21)";
  ctx.stroke(outline);
  const fold = new Path2D();
  fold.moveTo(topWidth * .38, height * .07);
  fold.bezierCurveTo(topWidth * .92, height * .39, sideX * .45, height * .73, sideX, height * .87);
  fold.bezierCurveTo(sideX * .36, height * .75, topWidth * .82, height * .45, topWidth * .38, height * .07);
  ctx.globalAlpha = Math.min(.51, pose.neck * .69);
  ctx.fillStyle = rim;
  ctx.fill(fold);
  ctx.restore();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rim;
  ctx.stroke(outline);
  ctx.restore();
}

export function useSidebarMotion(shellRef: RefObject<HTMLElement | null>, open: boolean, compact: boolean) {
  const previous = useRef({ open, compact });
  const active = useRef<{ pose: Pose; layout: boolean; stop: () => void } | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { open, compact };
    const shell = shellRef.current;
    if (!shell || before.open === open || before.compact !== compact) {
      if (before.compact !== compact) active.current?.stop();
      return;
    }
    const workspace = shell.querySelector<HTMLElement>(":scope > .workspace");
    const canvas = shell.querySelector<HTMLCanvasElement>(".sidebar-motion-canvas");
    const content = shell.querySelector<HTMLElement>(".sidebar-content");
    const toggle = shell.querySelector<HTMLButtonElement>(".sidebar-toggle");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    // Keep this small animated overlay away from the shared WebGL queue.
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!workspace?.animate || !canvas || !content || !toggle || !ctx || reducedMotion.matches) {
      active.current?.stop();
      return;
    }

    const from = active.current?.pose ?? (before.open ? OPEN : CLOSED);
    const layout = active.current?.layout ?? before.open;
    active.current?.stop();
    shell.dataset.sidebarLayout = layout ? "open" : "closed";
    shell.dataset.sidebarMotion = "";
    shell.dispatchEvent(new Event("sidebarmotionstart"));

    const button = toggle.offsetWidth + 2;
    const width = content.offsetWidth + 2;
    const height = content.offsetHeight + 2;
    const style = getComputedStyle(shell);
    const travel = compact ? 18 : parseFloat(style.getPropertyValue("--sidebar-width"));
    const viewportWidth = shell.clientWidth;
    const base = layout ? 1 : 0;
    const light = document.documentElement.dataset.theme === "light";
    const padding = parseFloat(style.getPropertyValue("--sidebar-motion-padding"));
    const dpr = Math.min(devicePixelRatio || 1, 1.25);
    const paintWidth = Math.ceil(width * 1.04 + padding * 2);
    const paintHeight = Math.ceil(height * 1.02 + padding * 2);
    canvas.style.width = `${paintWidth}px`;
    canvas.style.height = `${paintHeight}px`;
    canvas.width = Math.ceil(paintWidth * dpr);
    canvas.height = Math.ceil(paintHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, padding * dpr, padding * dpr);

    // Keep the layout and the dashboard's last glass frame together. Sample
    // the same motion for a compositor transform, with one reflow at handoff.
    const samples = Array.from({ length: 25 }, (_, i) => {
      const offset = i / 24;
      const { room } = poseAt(from, open, offset);
      const shift = (room - base) * travel;
      const scale = compact ? 1 : (viewportWidth - room * travel) / (viewportWidth - base * travel);
      return { offset, room, shift, scale };
    });
    const timing: KeyframeAnimationOptions = { duration, fill: "both" };
    const animation = workspace.animate(samples.map(({ offset, shift, scale }) => ({
      offset, transform: `translateX(${shift}px) scaleX(${scale})`,
    })), timing);
    const search = compact ? null : workspace.querySelector<HTMLElement>(".topbar-start");
    const searchInset = parseFloat(style.getPropertyValue("--sidebar-closed-header-space"));
    const searchAnimation = search?.animate(samples.map(({ offset, room, scale }) => ({
      offset, transform: `translateX(${(base - room) * searchInset / scale}px)`,
    })), timing);
    const start = document.timeline.currentTime;
    if (start !== null) {
      animation.startTime = start;
      if (searchAnimation) searchAnimation.startTime = start;
    }
    let frame = 0;
    const motion = {
      pose: from,
      layout,
      stop() {
        if (active.current !== motion) return;
        active.current = null;
        cancelAnimationFrame(frame);
        animation.cancel();
        searchAnimation?.cancel();
        toggle.style.transform = "";
        delete shell.dataset.sidebarLayout;
        delete shell.dataset.sidebarMotion;
        canvas.width = 1;
        canvas.height = 1;
        window.removeEventListener("resize", motion.stop);
        reducedMotion.removeEventListener("change", motion.stop);
        document.removeEventListener("visibilitychange", motion.stop);
        shell.dispatchEvent(new Event("sidebarmotionend"));
      },
    };
    active.current = motion;
    window.addEventListener("resize", motion.stop);
    reducedMotion.addEventListener("change", motion.stop);
    document.addEventListener("visibilitychange", motion.stop);

    const draw = () => {
      const t = clamp(Number(animation.currentTime ?? 0) / duration);
      if (t >= 1) {
        motion.stop();
        return;
      }
      const pose = poseAt(from, open, t);
      motion.pose = pose;
      ctx.clearRect(-padding, -padding, paintWidth, paintHeight);
      paintFold(ctx, pose, width, height, button, light);
      const offset = 6 * clamp(pose.button);
      toggle.style.transform = `translate(${offset}px, ${offset}px) scale(${1 + pose.bounce / button})`;
      frame = requestAnimationFrame(draw);
    };
    draw();
  }, [open, compact, shellRef]);

  useLayoutEffect(() => () => active.current?.stop(), []);
}
