"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassGeometry, glassVertex } from "./ice-glass-shader";
import { coatingProgress, useGlassSelection } from "./glass-selection";
import { soapSample } from "./ice-glass-volume";
import { createGlassLenses } from "./ice-glass-lens";
import { switchRect } from "./glass-switch-motion";
import { createDaylightCaustics, DAYLIGHT_GLASS, daylightPlanes } from "./daylight-glass";
import { createDaylightParallax } from "./daylight-parallax";

type ViewportRect = { left: number; top: number; width: number; height: number };
type GlassRect = ViewportRect & { right: number; bottom: number };
type Measurement = { element: HTMLElement; rect: GlassRect; radius: number; tint: number[]; crownHeight: number; reference: boolean };
const GLASS_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice, .heatmap button, [data-glass-selection], .glass-switch-thumb";
const LIFTABLE_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice";
// Keep the overscanned backing store below a conservative Safari allocation
// budget as well as the GPU's per-axis limits. These are physical pixels.
const BUFFER_PIXEL_BUDGET = 8_388_608;

export function IceGlass({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const definitionsRef = useRef<SVGDefsElement>(null);
  const coatings = useGlassSelection(rootRef);
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const definitions = definitionsRef.current;
    if (!canvas || !root || !definitions) return;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) return; // The original dark cards are the no-WebGL fallback.
    const lenses = createGlassLenses(definitions);
    const parallax = createDaylightParallax();
    let caustics: ReturnType<typeof createDaylightCaustics> | undefined;
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
    const lifts = new Map<HTMLElement,{ value: number; updated: number; target?: number }>();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const locations = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program!, name));
      return locations.get(name)!;
    };
    const dispose = () => {
      lenses.clear();
      parallax.clear(); caustics?.dispose(); caustics=undefined;
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
        caustics = createDaylightCaustics(gl, glassGeometry);
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
        const thumbTint = element.matches('.glass-switch-thumb') ? style.color.match(/[\d.]+/g)?.slice(0,3).map(n=>Number(n)/255) : undefined;
        const tint = coatings.current.get(element)?.tint ?? thumbTint ?? (element.matches(".negative-surface, .negative-strong, .critical, .risk-critical, .failed, .loss, .diary-loss, .negative-row, .heat-negative") ? [1,.34,.43]
          : element.matches(".heat-neutral") ? [.56,.64,.71]
          : element.matches(".violet, .insight-card, .lab-validation") ? [.64,.46,1]
          : element.matches(".amber, .calendar-strip, .warning, .risk-warning") ? [1,.62,.24]
          : [.31,.77,.87]);
        const domRect = element.getBoundingClientRect();
        const left = domRect.left-nextViewport.left;
        const top = domRect.top-nextViewport.top;
        const rect = { left, top, width: domRect.width, height: domRect.height, right: left+domRect.width, bottom: top+domRect.height };
        const radius=parseFloat(style.borderTopLeftRadius) || 14;
        const halfWidth=rect.width*.5,halfHeight=rect.height*.5;
        const daylightCard=document.documentElement.dataset.theme === "light" && element.matches(LIFTABLE_SURFACE_SELECTOR);
        const opticalRadius=Math.min(Math.min(halfWidth,halfHeight)*.95,daylightCard ? radius : Math.max(radius*1.75,24));
        const thickness=Math.min(daylightCard ? config.daylightThickness : config.glassThickness*2.1,Math.min(halfWidth,halfHeight)*.5);
        const crownHeight=rect.width && rect.height ? soapSample(0,0,halfWidth,halfHeight,opticalRadius,thickness)[2] : 0;
        const reference=!!element.closest('.today-dashboard') && element.matches(LIFTABLE_SURFACE_SELECTOR);
        return { element, rect, radius, tint, crownHeight, reference };
      });
      cards = cards.filter(card=>card.rect.width>0 && card.rect.height>0);
      const currentElements=new Set(cards.map(card=>card.element));
      for(const element of lifts.keys()) if(!currentElements.has(element)) lifts.delete(element);
      lenses.retain(currentElements);
      const daylight=document.documentElement.dataset.theme === "light";
      const referenceElements=new Set(cards.filter(card=>daylight && card.reference).map(card=>card.element));
      parallax.retain(referenceElements);
      caustics?.retain(referenceElements);
      for(const element of referenceElements) parallax.measure(element);
      dirty = false;
    };
    const fitDrawingBuffer = (quality = 1) => {
      // Page zoom can enlarge the CSS viewport without reducing Safari's DPR.
      // Reduce only raster resolution; all optical lengths stay in CSS pixels.
      for (let attempt = 0; attempt < 3; attempt++) {
        dpr = Math.min((devicePixelRatio || 1)*quality,dprCap,
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
      const lightMode = document.documentElement.dataset.theme === "light";
      // Daylight caustics extend beyond every silhouette. A modest shared raster
      // scale offsets that extra fill cost without creating a second render loop
      // or changing CSS-pixel geometry, pointer coordinates or optical lengths.
      const referenceToday=lightMode && !!root.querySelector('.today-dashboard:not([hidden])');
      const buffer = fitDrawingBuffer(referenceToday ? Math.min(1,1.25/(devicePixelRatio || 1)) : lightMode ? .82 : 1);
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
      gl.uniform1f(uniform("uTheme"),lightMode ? 1 : 0);
      gl.uniform1f(uniform("uDaylightThickness"),config.daylightThickness);
      gl.uniform1f(uniform("uLiftDistance"),config.daylightLift);
      gl.uniform3f(uniform("uSun"),...DAYLIGHT_GLASS.sun);
      gl.enable(gl.SCISSOR_TEST);
      let coatingMoving = false;
      let underlightMoving = false;
      let liftMoving = false;
      // Multiple checked controls retain their own glass and underlight. Keep
      // the existing neighbouring-rim pass anchored to the latest active choice.
      // Reuse measurements; this adds no DOM reads to pointer frames.
      const emitter = cards.reduce<Measurement | undefined>((latest,card) => {
        const candidate = coatings.current.get(card.element);
        if (!candidate) return latest;
        const previous = latest && coatings.current.get(latest.element);
        if (!previous) return card;
        if ((candidate.exiting === undefined) !== (previous.exiting === undefined)) return candidate.exiting === undefined ? card : latest;
        return candidate.started > previous.started ? card : latest;
      },undefined);
      const emission = emitter && coatings.current.get(emitter.element);
      const power = emitter ? Math.max(0,Math.min(1,Number(emitter.element.dataset.glassUnderlight ?? 1)||0)) : 0;
      const emissionPhase = emission ? coatingProgress(emission,time,reduced.matches) : [0,0,0,0,0];
      coatingMoving ||= emissionPhase[3]>0;
      const emissionTint = emission?.tint ?? [1,1,1];
      const emitterRect = emitter && emission?.travel && !reduced.matches
        ? switchRect(emitter.rect,emission.travel,(emission.exiting ?? time)-emission.started) : emitter?.rect;
      gl.uniform4f(uniform("uSpillRect"), emitterRect?.left ?? 0,emitterRect?.top ?? 0,emitterRect?.width ?? 1,emitterRect?.height ?? 1);
      gl.uniform2f(uniform("uSpillOrigin"),...(emission?.origin ?? [.5,.5] as [number,number]));
      gl.uniform3f(uniform("uSpillTint"),emissionTint[0],emissionTint[1],emissionTint[2]);
      for (const { element, rect: measuredRect, radius, tint, crownHeight, reference } of cards) {
        const today=lightMode && !!element.closest('.today-dashboard');
        const referenceGlass=lightMode && reference;
        const coating = coatings.current.get(element);
        const thumb = element.matches('.glass-switch-thumb');
        const thumbOn = thumb && (element.closest('.protection-switch')?.classList.contains('on')
          || element.closest('.lab-cost-toggle')?.querySelector<HTMLInputElement>('input')?.checked);
        const rect = coating?.travel && !reduced.matches
          ? switchRect(measuredRect,coating.travel,(coating.exiting ?? time)-coating.started) : measuredRect;
        const liftable = element.matches(LIFTABLE_SURFACE_SELECTOR);
        const pointerX=pointer.x-viewport.left, pointerY=pointer.y-viewport.top;
        const hovered=lightMode && liftable && pointer.presence>0 && pointerX>=rect.left && pointerX<=rect.right && pointerY>=rect.top && pointerY<=rect.bottom;
        let liftState=lifts.get(element);
        if(!liftState) { liftState={ value: 0, updated: time }; lifts.set(element,liftState); }
        const liftTarget=hovered && !reduced.matches ? 1 : 0;
        if(referenceGlass && reduced.matches) liftState.value=0;
        if(referenceGlass && liftState.target!==liftTarget) liftState.updated=time-16;
        liftState.target=liftTarget;
        const elapsed=referenceGlass ? Math.max(0,time-liftState.updated) : Math.min(64,Math.max(0,time-liftState.updated));
        const response=1-Math.exp(-elapsed/(liftTarget>.5 ? 118 : 185));
        liftState.value+= (liftTarget-liftState.value)*response;
        liftState.updated=time;
        if(Math.abs(liftTarget-liftState.value)<.002) liftState.value=liftTarget;
        else liftMoving=true;
        const lift=liftState.value;
        // Project only the optical layer towards the viewer. Hit testing and
        // DOM content keep the original rectangle, with no X/Y translation.
        const projection=referenceGlass ? daylightPlanes(lift).glassScale : lightMode && liftable
          ? config.daylightPerspective/(config.daylightPerspective-lift*config.daylightLift) : 1;
        if(referenceGlass) parallax.update(element,lift);
        lenses.update(element,{
          width:rect.width,height:rect.height,
          radius:Math.min(rect.width*.475,rect.height*.475,radius),
          thickness:Math.min(config.daylightThickness,rect.width*.25,rect.height*.25),
          ior:config.glassIOR,distance:config.daylightLift,
        },lightMode && liftable && !referenceGlass && !reduced.matches ? lift : 0,projection);
        // Selected compact switches project only a tiny transmitted-light pool.
        // Give it enough scissor room without expanding hit targets or layout.
        const switchPad=lightMode && coating?.luminous ? 7 : 0;
        const projectionPad=referenceGlass ? 72+lift*18 : lightMode && liftable ? 38+lift*10 : switchPad;
        const padX=projectionPad+rect.width*(projection-1)*.5;
        const padY=projectionPad+rect.height*(projection-1)*.5;
        const drawRect={ left:rect.left-padX, top:rect.top-padY, width:rect.width+padX*2,
          height:rect.height+padY*2, right:rect.right+padX, bottom:rect.bottom+padY };
        if (drawRect.bottom <= 0 || drawRect.top >= viewHeight || drawRect.right <= 0 || drawRect.left >= viewWidth || !rect.width) continue;
        // A scissored full-card quad keeps the slab continuous while avoiding work outside it.
        gl.viewport(0,0,width,height);
        gl.scissor(Math.max(0,Math.floor(drawRect.left*dpr)),Math.max(0,Math.floor((viewHeight-drawRect.bottom)*dpr)),Math.ceil(Math.min(drawRect.right,viewWidth)*dpr)-Math.max(0,Math.floor(drawRect.left*dpr)),Math.ceil(Math.min(drawRect.bottom,viewHeight)*dpr)-Math.max(0,Math.floor(drawRect.top*dpr)));
        const [reveal, isControl, opacity, moving, volume] = coating ? coatingProgress(coating, time, reduced.matches) : [1, thumb ? 1 : 0, 1, 0, 1];
        gl.uniform1f(uniform("uControlBrightness"), coating?.luminous || thumb ? 1.5 : 1);
        gl.uniform1f(uniform("uSwitchTint"), coating?.luminous ? 1 : 0);
        coatingMoving ||= moving > 0;
        const receivesSpill = !!(!today && emitter && power > .35 && element.matches('.glass-card')
          && !element.contains(emitter.element) && !emitter.element.contains(element));
        gl.uniform4f(uniform("uSpill"),power,reduced.matches ? 0 : emission ? (time-emission.started)/1000 : 0,
          emissionPhase[0]*emissionPhase[2]*emissionPhase[4],receivesSpill ? 1 : 0);
        underlightMoving ||= receivesSpill && power > .35 && !reduced.matches && emission?.exiting === undefined;
        const underlight = today ? 0 : coating
          ? Math.max(0, Math.min(1, Number(element.dataset.glassUnderlight ?? 1) || 0)) : thumbOn ? .45 : 0;
        underlightMoving ||= underlight > 0 && !reduced.matches && coating?.exiting === undefined;
        gl.uniform2f(uniform("uUnderlight"), underlight,
          reduced.matches ? 0 : coating ? (time-coating.started)/1000 : thumb ? time/1000 : 0);
        gl.uniform4f(uniform("uCoating"), reveal, isControl, opacity, volume);
        gl.uniform2f(uniform("uCoatingOrigin"), ...(coating?.origin ?? [.5, .5] as [number, number]));
        gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
        gl.uniform4f(uniform("uDrawRect"),drawRect.left,drawRect.top,drawRect.width,drawRect.height);
        gl.uniform1f(uniform("uRadius"),radius);
        gl.uniform1f(uniform("uLift"),lift);
        gl.uniform1f(uniform("uProjection"),projection);
        gl.uniform1f(uniform("uReferenceGlass"),referenceGlass ? 1 : 0);
        gl.uniform1f(uniform("uLightGlass"),liftable ? 1 : 0);
        const movingCrown = coating?.travel ? soapSample(0,0,rect.width*.5,rect.height*.5,
          Math.min(Math.min(rect.width,rect.height)*.475,Math.max(radius*1.75,24)),
          Math.min(config.glassThickness*2.1,Math.min(rect.width,rect.height)*.25))[2] : crownHeight;
        gl.uniform1f(uniform("uCrownHeight"),movingCrown);
        gl.uniform3f(uniform("uTint"),tint[0],tint[1],tint[2]);
        gl.drawArrays(gl.TRIANGLES,0,6);
        if(referenceGlass) {
          caustics?.draw(element,width,height,dpr,rect,drawRect,radius,lift,config.glassIOR);
          gl.useProgram(program);
        }
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
      if (settling || coatingMoving || liftMoving) { if (settling) dirty = true; schedule(); }
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
    let hoveredReference: HTMLElement | undefined;
    const move: EventListener = (nativeEvent) => {
      const event = nativeEvent as PointerEvent;
      if (event.pointerType === "touch" || root.hidden || reduced.matches) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.presence = 1;
      const today=lightDaylight();
      if(today) {
        const x=event.clientX-viewport.left,y=event.clientY-viewport.top;
        const next=cards.find(card=>card.reference && x>=card.rect.left && x<=card.rect.right && y>=card.rect.top && y<=card.rect.bottom)?.element;
        if(next===hoveredReference) return;
        hoveredReference=next;
      }
      schedule();
    };
    const lightDaylight=()=>document.documentElement.dataset.theme === "light"
      && !!root.querySelector('.today-dashboard:not([hidden])');
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) { pointer.presence = 0; hoveredReference=undefined; schedule(); } };
    const visibility = () => { if (document.hidden) { clearTimeout(underlightTimer); underlightTimer = undefined; cancelAnimationFrame(frame); frame = 0; } else invalidate(); };
    const contextLost = (event: Event) => {
      event.preventDefault();lost=true;clearTimeout(underlightTimer);underlightTimer=undefined;cancelAnimationFrame(frame);frame=0;
      // Release references while the context is lost. After restoration these
      // handles belong to the old generation and must not be deleted again.
      dispose();delete root.dataset.iceGlass;
    };
    const contextRestored = () => { dispose(); lost = false; initialize(); invalidate(); };
    const themeChanged = () => { settleUntil=performance.now()+650; invalidate(); };
    initialize();
    watchResolution();
    resize = new ResizeObserver(settleLayout);
    resize.observe(root);
    syncObservedSurfaces();
    const mutation = new MutationObserver(records => {
      if(records.every(record=>record.target===canvas || definitions.contains(record.target) || parallax.ownsMutation(record)))return;
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
    root.addEventListener("glassswitchmotion",settleLayout);
    document.addEventListener("visibilitychange",visibility);
    window.addEventListener("bluespherix:theme",themeChanged);
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
      root.removeEventListener("glassswitchmotion",settleLayout);
      window.visualViewport?.removeEventListener("resize",settleLayout); window.visualViewport?.removeEventListener("scroll",invalidate);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      window.removeEventListener("bluespherix:theme",themeChanged);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      delete root.dataset.iceGlass;dispose();
    };
  },[rootRef, coatings]);
  return <>
    <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />
    <svg className="ice-glass-refraction-defs" aria-hidden="true">
      <defs ref={definitionsRef} />
    </svg>
  </>;
}
