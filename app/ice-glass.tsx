"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassVertex } from "./ice-glass-shader";
import { coatingProgress, useGlassSelection } from "./glass-selection";
import { soapSample } from "./ice-glass-volume";

type ViewportRect = { left: number; top: number; width: number; height: number };
type GlassRect = ViewportRect & { right: number; bottom: number };
type Measurement = { element: HTMLElement; rect: GlassRect; radius: number; tint: number[]; crownHeight: number };
const GLASS_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice, [data-glass-selection]";
// Keep the overscanned backing store below a conservative Safari allocation
// budget as well as the GPU's per-axis limits. These are physical pixels.
const BUFFER_PIXEL_BUDGET = 8_388_608;

export function IceGlass({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coatings = useGlassSelection(rootRef);
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
    let underlightTimer: ReturnType<typeof setTimeout> | undefined;
    let dirty = true;
    let lost = false;
    let cards: Measurement[] = [];
    let dpr = Math.min(devicePixelRatio || 1, config.maxDPR);
    let dprCap: number = config.maxDPR;
    let maxBufferWidth = 1;
    let maxBufferHeight = 1;
    let resolutionQuery: MediaQueryList | null = null;
    let viewport: ViewportRect = { left: 0, top: 0, width: innerWidth, height: innerHeight };
    let lastRender = 0;
    let slowFrames = 0;
    let settleUntil = 0;
    let resize: ResizeObserver | null = null;
    const observedSurfaces = new Set<Element>();
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
        const viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        const sideLimit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_TEXTURE_SIZE));
        maxBufferWidth = Math.min(sideLimit,viewportLimits[0]);
        maxBufferHeight = Math.min(sideLimit,viewportLimits[1]);
        dprCap = config.maxDPR;
      } catch (error) {
        console.warn("Ice Glass uses the dark-card fallback:", error);
        dispose();
        delete root.dataset.iceGlass;
      }
    };
    const readViewport = (): ViewportRect => {
      // The canvas shares the content's scrolling layer. Overscan keeps glass
      // attached even while Safari scrolls without waiting for JavaScript.
      const bounds=root.getBoundingClientRect();
      const screenHeight=Math.max(1,window.visualViewport?.height || innerHeight);
      const height=Math.max(1,Math.min(bounds.height,screenHeight*2));
      const visibleTop=Math.max(0,-bounds.top+(window.visualViewport?.offsetTop || 0));
      const step=screenHeight*.25;
      const top=Math.max(0,Math.min(Math.floor((visibleTop-screenHeight*.5)/step)*step,bounds.height-height));
      const cssHeight=`${height}px`,cssTop=`${top}px`;
      if(canvas.style.height!==cssHeight)canvas.style.height=cssHeight;
      if(canvas.style.top!==cssTop)canvas.style.top=cssTop;
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
        const tint = coatings.current.get(element)?.tint ?? (element.matches(".negative-surface, .negative-strong, .critical, .risk-critical, .failed, .loss, .diary-loss, .negative-row") ? [1,.34,.43]
          : element.matches(".violet, .insight-card, .lab-validation") ? [.64,.46,1]
          : element.matches(".amber, .calendar-strip, .warning, .risk-warning") ? [1,.62,.24]
          : [.31,.77,.87]);
        const domRect = element.getBoundingClientRect();
        const left = domRect.left-nextViewport.left;
        const top = domRect.top-nextViewport.top;
        const rect = { left, top, width: domRect.width, height: domRect.height, right: left+domRect.width, bottom: top+domRect.height };
        const radius=parseFloat(style.borderTopLeftRadius) || 14;
        const halfWidth=rect.width*.5,halfHeight=rect.height*.5;
        const opticalRadius=Math.min(Math.min(halfWidth,halfHeight)*.95,Math.max(radius*1.75,24));
        const thickness=Math.min(config.glassThickness*2.1,Math.min(halfWidth,halfHeight)*.5);
        const crownHeight=rect.width && rect.height ? soapSample(0,0,halfWidth,halfHeight,opticalRadius,thickness)[2] : 0;
        return { element, rect, radius, tint, crownHeight };
      });
      cards = cards.filter(card=>card.rect.width>0 && card.rect.height>0);
      dirty = false;
    };
    const fitDrawingBuffer = () => {
      // Page zoom can enlarge the CSS viewport without reducing Safari's DPR.
      // Reduce only raster resolution; all optical lengths stay in CSS pixels.
      for (let attempt = 0; attempt < 3; attempt++) {
        dpr = Math.min(devicePixelRatio || 1,dprCap,
          maxBufferWidth/viewport.width,maxBufferHeight/viewport.height,
          Math.sqrt(BUFFER_PIXEL_BUDGET/(viewport.width*viewport.height)));
        const width = Math.max(1,Math.floor(viewport.width*dpr));
        const height = Math.max(1,Math.floor(viewport.height*dpr));
        if (canvas.width !== width || canvas.height !== height || !gl.drawingBufferWidth || !gl.drawingBufferHeight) {
          canvas.width = width;
          canvas.height = height;
        }
        // The requested attributes can survive a failed allocation. Hide the
        // CSS fallback only after the actual WebGL buffer matches the request.
        if (gl.drawingBufferWidth === width && gl.drawingBufferHeight === height) return { width, height };
        if (gl.isContextLost()) break;
        dprCap = dpr*.5;
      }
      delete root.dataset.iceGlass;
      return null;
    };
    const draw = (time: number) => {
      frame = 0;
      if (lost || !program || document.hidden) return;
      const nextViewport = readViewport();
      if (dirty || viewportChanged(nextViewport)) measure(nextViewport);
      const viewWidth = viewport.width, viewHeight = viewport.height;
      const buffer = fitDrawingBuffer();
      if (!buffer) return;
      const { width, height } = buffer;
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
      gl.uniform1f(uniform("uBodyOpacity"),config.glassBodyOpacity);
      gl.uniform4f(uniform("uOptics"),config.fresnelStrength,config.chromaticDispersion,config.edgeRefraction,config.internalReflection);
      gl.uniform4f(uniform("uEnergy"),config.ambientReflection,config.lightIntensity,config.lightHeight,config.lightFalloff);
      gl.uniform3f(uniform("uFinish"),config.specularSharpness,config.bloomIntensity,config.bloomRadius);
      gl.enable(gl.SCISSOR_TEST);
      let coatingMoving = false;
      let underlightMoving = false;
      // One selected area emits; retain a fading selection only during its exit.
      // Reuse measured rectangles so this adds no layout reads to pointer frames.
      const emitter = cards.find(({element}) => coatings.current.has(element)
        && coatings.current.get(element)?.exiting === undefined)
        ?? cards.find(({element}) => coatings.current.has(element));
      const emission = emitter && coatings.current.get(emitter.element);
      const power = emitter ? Math.max(0,Math.min(1,Number(emitter.element.dataset.glassUnderlight ?? 1)||0)) : 0;
      const emissionPhase = emission ? coatingProgress(emission,time,reduced.matches) : [0,0,0,0,0];
      coatingMoving ||= emissionPhase[3]>0;
      const emissionTint = emission?.tint ?? [1,1,1];
      gl.uniform4f(uniform("uSpillRect"), emitter?.rect.left ?? 0,emitter?.rect.top ?? 0,emitter?.rect.width ?? 1,emitter?.rect.height ?? 1);
      gl.uniform2f(uniform("uSpillOrigin"),...(emission?.origin ?? [.5,.5] as [number,number]));
      gl.uniform3f(uniform("uSpillTint"),emissionTint[0],emissionTint[1],emissionTint[2]);
      for (const { element, rect, radius, tint, crownHeight } of cards) {
        if (rect.bottom <= 0 || rect.top >= viewHeight || rect.right <= 0 || rect.left >= viewWidth || !rect.width) continue;
        // A scissored full-card quad keeps the slab continuous while avoiding work outside it.
        gl.viewport(0,0,width,height);
        gl.scissor(Math.max(0,Math.floor(rect.left*dpr)),Math.max(0,Math.floor((viewHeight-rect.bottom)*dpr)),Math.ceil(Math.min(rect.right,viewWidth)*dpr)-Math.max(0,Math.floor(rect.left*dpr)),Math.ceil(Math.min(rect.bottom,viewHeight)*dpr)-Math.max(0,Math.floor(rect.top*dpr)));
        const coating = coatings.current.get(element);
        const [reveal, isControl, opacity, moving, volume] = coating ? coatingProgress(coating, time, reduced.matches) : [1, 0, 1, 0, 1];
        coatingMoving ||= moving > 0;
        const receivesSpill = !!(emitter && power > .35 && element.matches('.glass-card')
          && !element.contains(emitter.element) && !emitter.element.contains(element));
        gl.uniform4f(uniform("uSpill"),power,reduced.matches ? 0 : emission ? (time-emission.started)/1000 : 0,
          emissionPhase[0]*emissionPhase[2]*emissionPhase[4],receivesSpill ? 1 : 0);
        underlightMoving ||= receivesSpill && power > .35 && !reduced.matches && emission?.exiting === undefined;
        const underlight = coating
          ? Math.max(0, Math.min(1, Number(element.dataset.glassUnderlight ?? 1) || 0)) : 0;
        underlightMoving ||= underlight > 0 && !reduced.matches && coating?.exiting === undefined;
        gl.uniform2f(uniform("uUnderlight"), underlight,
          reduced.matches ? 0 : coating ? (time-coating.started)/1000 : 0);
        gl.uniform4f(uniform("uCoating"), reveal, isControl, opacity, volume);
        gl.uniform2f(uniform("uCoatingOrigin"), ...(coating?.origin ?? [.5, .5] as [number, number]));
        gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
        gl.uniform1f(uniform("uRadius"),radius);
        gl.uniform1f(uniform("uCrownHeight"),crownHeight);
        gl.uniform3f(uniform("uTint"),tint[0],tint[1],tint[2]);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
      if (root.dataset.iceGlass !== "ready") root.dataset.iceGlass = "ready";
      canvas.dataset.pointer = `${pointer.x},${pointer.y}`;
      // Adapt resolution only under sustained activity, never interpolate position.
      const settling = time < settleUntil;
      if (!settling && !underlightMoving && lastRender && time-lastRender < 120 && time-lastRender > 30) slowFrames++;
      else slowFrames = Math.max(0,slowFrames-1);
      lastRender = time;
      if (slowFrames > 15 && dprCap > 1) { dprCap = 1; slowFrames = 0; }
      // A browser zoom can move a card for several frames while responsive CSS
      // and font metrics settle. ResizeObserver sees size changes, not every
      // positional shift caused by siblings, so remeasure briefly after zoom.
      if (settling || coatingMoving) { if (settling) dirty = true; schedule(); }
      // Slow under-glass motion needs only about 30 fps at rest. Pointer/layout
      // events bypass the timer and still render on the next available frame.
      else if (underlightMoving) underlightTimer = setTimeout(schedule, 16);
    };
    const schedule = () => {
      if (underlightTimer !== undefined) { clearTimeout(underlightTimer); underlightTimer = undefined; }
      if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const invalidate = () => { dirty = true; schedule(); };
    const settleLayout = () => { settleUntil = performance.now()+700; invalidate(); };
    const watchResolution = () => {
      resolutionQuery?.removeEventListener("change",resolutionChanged);
      resolutionQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener("change",resolutionChanged);
    };
    const resolutionChanged = () => { watchResolution(); settleLayout(); };
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
    const visibility = () => { if (document.hidden) { clearTimeout(underlightTimer); underlightTimer = undefined; cancelAnimationFrame(frame); frame = 0; } else invalidate(); };
    const contextLost = (event: Event) => {
      event.preventDefault();lost=true;clearTimeout(underlightTimer);underlightTimer=undefined;cancelAnimationFrame(frame);frame=0;
      // Release references while the context is lost. After restoration these
      // handles belong to the old generation and must not be deleted again.
      dispose();delete root.dataset.iceGlass;
    };
    const contextRestored = () => { dispose(); lost = false; initialize(); invalidate(); };
    initialize();
    watchResolution();
    resize = new ResizeObserver(settleLayout);
    resize.observe(root);
    syncObservedSurfaces();
    const mutation = new MutationObserver(records => {
      if(records.every(record=>record.target===canvas))return;
      syncObservedSurfaces();
      // A coating changes material coverage, not layout. Reuse cached rectangles.
      if (records.every(record => record.attributeName === "data-glass-selection")) invalidate();
      else settleLayout();
    });
    mutation.observe(root,{ childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style", "data-glass-selection", "data-glass-underlight"] });
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
      clearTimeout(underlightTimer); cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect();
      resolutionQuery?.removeEventListener("change",resolutionChanged);
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerrawupdate",move);
      window.removeEventListener("pointerout",leave); window.removeEventListener("resize",settleLayout);
      window.removeEventListener("scroll",invalidate,true); root.removeEventListener("transitionrun",settleLayout); root.removeEventListener("transitionend",invalidate);
      window.visualViewport?.removeEventListener("resize",settleLayout); window.visualViewport?.removeEventListener("scroll",invalidate);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      delete root.dataset.iceGlass;dispose();
    };
  },[rootRef, coatings]);
  return <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />;
}
