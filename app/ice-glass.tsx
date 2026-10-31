"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassVertex } from "./ice-glass-shader";
import { secondaryBeam } from "./ice-glass-transport";

type ViewportRect = { left: number; top: number; width: number; height: number };
type GlassRect = ViewportRect & { right: number; bottom: number };
type Measurement = { element: HTMLElement; rect: GlassRect; radius: number; tint: number[] };
const GLASS_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice";

export function IceGlass({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) return; // The original dark cards are the no-WebGL fallback.
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let shaders: WebGLShader[] = [];
    let frame = 0;
    let dirty = true;
    let lost = false;
    let cards: Measurement[] = [];
    let dpr = Math.min(devicePixelRatio || 1, config.maxDPR);
    let dprCap: number = config.maxDPR;
    let viewport: ViewportRect = { left: 0, top: 0, width: innerWidth, height: innerHeight };
    let lastRender = 0;
    let slowFrames = 0;
    let settleUntil = 0;
    let resize: ResizeObserver | null = null;
    const observedSurfaces = new Set<Element>();
    const pointer = { x: -10000, y: -10000, presence: 0 };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const debug = process.env.NODE_ENV === "development" && new URLSearchParams(location.search).get("iceGlassDebug") === "1" ? document.createElement("canvas") : null;
    if (debug) { debug.className = "ice-glass-canvas"; debug.style.zIndex = "9"; root.appendChild(debug); }
    const locations = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program!, name));
      return locations.get(name)!;
    };
    const dispose = () => {
      shaders.forEach((shader) => gl.deleteShader(shader));
      shaders = [];
      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      program = null;
      vao = null;
      locations.clear();
    };
    const initialize = () => {
      try {
        program = gl.createProgram();
        if (!program) throw new Error("Ice Glass: program unavailable");
        for (const [type, source] of [[gl.VERTEX_SHADER, glassVertex], [gl.FRAGMENT_SHADER, glassFragment]] as const) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error("Ice Glass: shader unavailable");
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Ice Glass compilation");
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Ice Glass link");
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.useProgram(program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        root.dataset.iceGlass = "ready";
      } catch (error) {
        console.warn("Ice Glass uses the dark-card fallback:", error);
        dispose();
        delete root.dataset.iceGlass;
      }
    };
    const readViewport = (): ViewportRect => {
      const rect = canvas.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width || document.documentElement.clientWidth,
        height: rect.height || document.documentElement.clientHeight,
      };
    };
    const viewportChanged = (next: ViewportRect) =>
      Math.abs(next.left-viewport.left) > .05 || Math.abs(next.top-viewport.top) > .05 ||
      Math.abs(next.width-viewport.width) > .05 || Math.abs(next.height-viewport.height) > .05;
    const measure = (nextViewport = readViewport()) => {
      viewport = nextViewport;
      cards = Array.from(root.querySelectorAll<HTMLElement>(GLASS_SURFACE_SELECTOR)).map((element) => {
        const style = getComputedStyle(element);
        const tint = element.matches(".negative-surface, .negative-strong, .critical, .risk-critical, .failed") ? [1,.34,.43]
          : element.matches(".violet, .insight-card, .lab-validation") ? [.64,.46,1]
          : element.matches(".amber, .calendar-strip, .warning, .risk-warning") ? [1,.62,.24]
          : [.31,.77,.87];
        const domRect = element.getBoundingClientRect();
        const left = domRect.left-nextViewport.left;
        const top = domRect.top-nextViewport.top;
        const rect = { left, top, width: domRect.width, height: domRect.height, right: left+domRect.width, bottom: top+domRect.height };
        return { element, rect, radius: parseFloat(style.borderTopLeftRadius) || 14, tint };
      });
      dirty = false;
    };
    const draw = (time: number) => {
      frame = 0;
      if (lost || !program || document.hidden) return;
      const nextViewport = readViewport();
      if (dirty || viewportChanged(nextViewport)) measure(nextViewport);
      // Safari changes devicePixelRatio independently from layout while browser
      // zoom is in progress. Read it per frame so backing store and DOM remain
      // in the same coordinate space throughout the zoom gesture.
      dpr = Math.min(devicePixelRatio || 1,dprCap);
      const viewWidth = viewport.width, viewHeight = viewport.height;
      const width = Math.max(1,Math.round(viewWidth*dpr)), height = Math.max(1,Math.round(viewHeight*dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (root.hidden) return;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniform("uResolution"), width, height);
      gl.uniform1f(uniform("uDPR"),dpr);
      gl.uniform3f(uniform("uLight"),pointer.x-viewport.left,pointer.y-viewport.top,reduced.matches ? 0 : pointer.presence);
      gl.uniform4f(uniform("uGlass"),config.glassIOR,config.glassThickness,config.glassRoughness,config.glassOpacity);
      gl.uniform4f(uniform("uOptics"),config.fresnelStrength,config.chromaticDispersion,config.edgeRefraction,config.internalReflection);
      gl.uniform4f(uniform("uEnergy"),config.ambientReflection,config.lightIntensity,config.lightHeight,config.lightFalloff);
      gl.uniform3f(uniform("uFinish"),config.specularSharpness,config.bloomIntensity,config.bloomRadius);
      gl.enable(gl.SCISSOR_TEST);
      const surfaces = cards.map(card=>card.rect);
      for (const { rect, radius, tint } of cards) {
        if (rect.bottom <= 0 || rect.top >= viewHeight || rect.right <= 0 || rect.left >= viewWidth || !rect.width) continue;
        // A scissored full-card quad keeps the slab continuous while avoiding work outside it.
        gl.viewport(0,0,width,height);
        gl.scissor(Math.max(0,Math.floor(rect.left*dpr)),Math.max(0,Math.floor((viewHeight-rect.bottom)*dpr)),Math.ceil(Math.min(rect.right,viewWidth)*dpr)-Math.max(0,Math.floor(rect.left*dpr)),Math.ceil(Math.min(rect.bottom,viewHeight)*dpr)-Math.max(0,Math.floor(rect.top*dpr)));
        gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
        gl.uniform1f(uniform("uRadius"),radius);
        gl.uniform3f(uniform("uTint"),tint[0],tint[1],tint[2]);
        const localPointer = { x: pointer.x-viewport.left, y: pointer.y-viewport.top };
        const beam=pointer.presence ? secondaryBeam(localPointer,rect,surfaces,config.maxBounces) : null;
        gl.uniform4f(uniform("uSecondary"),beam?.x ?? 0,beam?.y ?? 0,beam?.dx ?? 0,beam?.dy ?? 0);
        gl.uniform1f(uniform("uSecondaryEnergy"),beam?.energy ?? 0);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
      if (debug) {
        debug.width=width;debug.height=height;
        const ctx=debug.getContext("2d");
        if (ctx) {
          ctx.scale(dpr,dpr);ctx.clearRect(0,0,viewWidth,viewHeight);
          const localPointer = { x: pointer.x-viewport.left, y: pointer.y-viewport.top };
          for (const {rect} of cards) {
            const beam=secondaryBeam(localPointer,rect,surfaces,config.maxBounces);
            if (!beam) continue;
            ctx.strokeStyle="rgba(125,235,255,.8)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(localPointer.x,localPointer.y);ctx.lineTo(beam.x,beam.y);ctx.lineTo(beam.x+beam.dx*170,beam.y+beam.dy*170);ctx.stroke();
            ctx.fillStyle="rgba(255,215,125,.95)";ctx.beginPath();ctx.arc(beam.x,beam.y,4,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle="rgba(136,169,255,.22)";ctx.lineWidth=26*beam.energy;ctx.beginPath();ctx.moveTo(beam.x,beam.y);ctx.lineTo(beam.x+beam.dx*170,beam.y+beam.dy*170);ctx.stroke();
          }
          for (const {rect} of cards) {
            const x=rect.left+rect.width*.5,y=rect.top;
            ctx.strokeStyle="rgba(135,255,171,.65)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-18);ctx.stroke();
          }
        }
      }
      canvas.dataset.pointer = `${pointer.x},${pointer.y}`;
      // Adapt resolution only under sustained activity, never interpolate position.
      const settling = time < settleUntil;
      if (!settling && lastRender && time-lastRender < 120 && time-lastRender > 30) slowFrames++;
      else slowFrames = Math.max(0,slowFrames-1);
      lastRender = time;
      if (slowFrames > 15 && dprCap > 1) { dprCap = 1; slowFrames = 0; }
      // A browser zoom can move a card for several frames while responsive CSS
      // and font metrics settle. ResizeObserver sees size changes, not every
      // positional shift caused by siblings, so remeasure briefly after zoom.
      if (settling) { dirty = true; schedule(); }
    };
    const schedule = () => { if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(draw); };
    const invalidate = () => { dirty = true; schedule(); };
    const settleLayout = () => { settleUntil = performance.now()+700; invalidate(); };
    const syncObservedSurfaces = () => {
      if (!resize) return;
      const current = new Set(root.querySelectorAll(GLASS_SURFACE_SELECTOR));
      for (const surface of observedSurfaces) {
        if (!current.has(surface)) { resize.unobserve(surface); observedSurfaces.delete(surface); }
      }
      for (const surface of current) {
        if (!observedSurfaces.has(surface)) { resize.observe(surface); observedSurfaces.add(surface); }
      }
    };
    const move: EventListener = (nativeEvent) => {
      const event = nativeEvent as PointerEvent;
      if (event.pointerType === "touch" || root.hidden || reduced.matches) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.presence = 1;
      schedule();
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) { pointer.presence = 0; schedule(); } };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; delete root.dataset.iceGlass; };
    const contextRestored = () => { dispose(); lost = false; initialize(); invalidate(); };
    initialize();
    resize = new ResizeObserver(settleLayout);
    resize.observe(root);
    syncObservedSurfaces();
    const mutation = new MutationObserver(() => { syncObservedSurfaces(); settleLayout(); });
    mutation.observe(root,{ childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerrawupdate",move,{passive:true});
    window.addEventListener("pointerout",leave,{passive:true});
    window.addEventListener("resize",settleLayout,{passive:true});
    window.addEventListener("scroll",invalidate,{passive:true,capture:true});
    window.visualViewport?.addEventListener("resize",settleLayout,{passive:true});
    window.visualViewport?.addEventListener("scroll",invalidate,{passive:true});
    root.addEventListener("transitionrun",settleLayout);
    root.addEventListener("transitionend",invalidate);
    document.addEventListener("visibilitychange",visibility);
    reduced.addEventListener("change",schedule);
    canvas.addEventListener("webglcontextlost",contextLost);
    canvas.addEventListener("webglcontextrestored",contextRestored);
    invalidate();
    return () => {
      cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect();
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerrawupdate",move);
      window.removeEventListener("pointerout",leave); window.removeEventListener("resize",settleLayout);
      window.removeEventListener("scroll",invalidate,true); root.removeEventListener("transitionrun",settleLayout); root.removeEventListener("transitionend",invalidate);
      window.visualViewport?.removeEventListener("resize",settleLayout); window.visualViewport?.removeEventListener("scroll",invalidate);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      debug?.remove(); delete root.dataset.iceGlass; dispose();
    };
  },[rootRef]);
  return <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />;
}
