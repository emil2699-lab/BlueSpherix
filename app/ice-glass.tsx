"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassVertex } from "./ice-glass-shader";

type Measurement = { element: HTMLElement; rect: DOMRect; radius: number; tint: number[] };

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
    let lastRender = 0;
    let slowFrames = 0;
    const pointer = { x: -10000, y: -10000, presence: 0 };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
    const measure = () => {
      cards = Array.from(root.querySelectorAll<HTMLElement>(".glass-card, .calendar-strip, .today-notice")).map((element) => {
        const style = getComputedStyle(element);
        const tint = element.classList.contains("violet") || element.classList.contains("insight-card") ? [.64,.46,1] : element.classList.contains("amber") || element.classList.contains("calendar-strip") ? [1,.62,.24] : [.31,.77,.87];
        return { element, rect: element.getBoundingClientRect(), radius: parseFloat(style.borderTopLeftRadius) || 14, tint };
      });
      dirty = false;
    };
    const draw = (time: number) => {
      frame = 0;
      if (lost || !program || document.hidden) return;
      if (dirty) measure();
      const width = Math.round(innerWidth*dpr), height = Math.round(innerHeight*dpr);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (root.hidden) return;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniform("uResolution"), width, height);
      gl.uniform1f(uniform("uDPR"),dpr);
      gl.uniform3f(uniform("uLight"),pointer.x,pointer.y,reduced.matches ? 0 : pointer.presence);
      gl.uniform4f(uniform("uGlass"),config.glassIOR,config.glassThickness,config.glassRoughness,config.glassOpacity);
      gl.uniform4f(uniform("uOptics"),config.fresnelStrength,config.chromaticDispersion,config.edgeRefraction,config.internalReflection);
      gl.uniform4f(uniform("uEnergy"),config.ambientReflection,config.lightIntensity,config.lightHeight,config.lightFalloff);
      gl.uniform3f(uniform("uFinish"),config.specularSharpness,config.bloomIntensity,config.bloomRadius);
      gl.enable(gl.SCISSOR_TEST);
      for (const { rect, radius, tint } of cards) {
        if (rect.bottom <= 0 || rect.top >= innerHeight || !rect.width) continue;
        // A scissored quad per card avoids evaluating every card at every pixel.
        gl.viewport(0,0,width,height);
        gl.scissor(Math.max(0,Math.floor(rect.left*dpr)),Math.max(0,Math.floor((innerHeight-rect.bottom)*dpr)),Math.ceil(Math.min(rect.right,innerWidth)*dpr)-Math.max(0,Math.floor(rect.left*dpr)),Math.ceil(Math.min(rect.bottom,innerHeight)*dpr)-Math.max(0,Math.floor(rect.top*dpr)));
        gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
        gl.uniform1f(uniform("uRadius"),radius);
        gl.uniform3f(uniform("uTint"),tint[0],tint[1],tint[2]);
        gl.drawArrays(gl.TRIANGLES,0,24);
      }
      canvas.dataset.pointer = `${pointer.x},${pointer.y}`;
      // Adapt resolution only under sustained activity, never interpolate position.
      if (lastRender && time-lastRender < 120 && time-lastRender > 30) slowFrames++;
      else slowFrames = Math.max(0,slowFrames-1);
      lastRender = time;
      if (slowFrames > 15 && dpr > 1) { dpr = 1; slowFrames = 0; }
    };
    const schedule = () => { if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(draw); };
    const invalidate = () => { dirty = true; schedule(); };
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
    const resize = new ResizeObserver(invalidate);
    resize.observe(root);
    root.querySelectorAll(".glass-card, .calendar-strip, .today-notice").forEach((card) => resize.observe(card));
    const mutation = new MutationObserver(invalidate);
    mutation.observe(root,{ attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerrawupdate",move,{passive:true});
    window.addEventListener("pointerout",leave,{passive:true});
    window.addEventListener("resize",invalidate,{passive:true});
    window.addEventListener("scroll",invalidate,{passive:true,capture:true});
    root.addEventListener("transitionend",invalidate);
    document.addEventListener("visibilitychange",visibility);
    reduced.addEventListener("change",schedule);
    canvas.addEventListener("webglcontextlost",contextLost);
    canvas.addEventListener("webglcontextrestored",contextRestored);
    invalidate();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect();
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerrawupdate",move);
      window.removeEventListener("pointerout",leave); window.removeEventListener("resize",invalidate);
      window.removeEventListener("scroll",invalidate,true); root.removeEventListener("transitionend",invalidate);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      delete root.dataset.iceGlass; dispose();
    };
  },[rootRef]);
  return <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />;
}
