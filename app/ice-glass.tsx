"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassGeometry, glassVertex } from "./ice-glass-shader";
import { coatingProgress, useGlassSelection } from "./glass-selection";
import { soapSample } from "./ice-glass-volume";
import { createGlassLenses } from "./ice-glass-lens";
import { switchRect } from "./glass-switch-motion";
import { createDaylightCaustics, DAYLIGHT_GLASS, daylightPlanes } from "./daylight-glass";
import { createDaylightParallax, DAYLIGHT_LABEL_SELECTOR, isDaylightStaticVisual } from "./daylight-parallax";

type ViewportRect = { left: number; top: number; width: number; height: number };
type GlassRect = ViewportRect & { right: number; bottom: number };
type Measurement = { element: HTMLElement; rect: GlassRect; radius: number; tint: number[]; crownHeight: number; reference: boolean };
const GLASS_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice, .heatmap button, [data-glass-selection], .glass-switch-thumb";
const LIFTABLE_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice";
const DEFAULT_TINT = [.31,.77,.87];
// Keep the overscanned backing store below a conservative Safari allocation
// budget as well as the GPU's per-axis limits. These are physical pixels.
const BUFFER_PIXEL_BUDGET = 8_388_608;

function crownFor(width: number, height: number, radius: number, daylight: boolean) {
  const halfWidth = width * .5, halfHeight = height * .5;
  const halfSide = Math.min(halfWidth,halfHeight);
  const opticalRadius = Math.min(halfSide*.95, daylight ? radius : Math.max(radius*1.75,24));
  const thickness = Math.min(daylight ? config.daylightThickness : config.glassThickness*2.1,halfSide*.5);
  return halfSide > 0 ? soapSample(0,0,halfWidth,halfHeight,opticalRadius,thickness)[2] : 0;
}

export function IceGlass({ rootRef, sidebarRef, sidebarCanvasRef }: {
  rootRef: RefObject<HTMLElement | null>;
  sidebarRef: RefObject<HTMLElement | null>;
  sidebarCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
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
    const sidebar = sidebarRef.current ?? undefined;
    const sidebarShell = sidebar?.parentElement;
    const sidebarCanvas = sidebarCanvasRef.current;
    const sidebarOutput = sidebarCanvas?.getContext("2d");
    let sidebarBounds: DOMRect | undefined;
    let sidebarRadius = 0;
    let sidebarDirty = true;
    let sidebarKey = "";
    let sidebarMoving = sidebarShell?.hasAttribute("data-sidebar-motion") ?? false;
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
    let surfaces = new Map<HTMLElement,Measurement>();
    let heatBounds: Pick<GlassRect,"left" | "top" | "right" | "bottom"> | undefined;
    let dpr = Math.min(devicePixelRatio || 1, config.maxDPR);
    let dprCap: number = config.maxDPR;
    let softwareRenderer = false;
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
    let heatSelection: HTMLElement | undefined;
    let heatSelectionStarted=0;
    const lifts = new Map<HTMLElement,{ value: number; updated: number; target?: number }>();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const locations = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program!, name));
      return locations.get(name)!;
    };
    const dispose = () => {
      sidebarKey = "";
      if (sidebar) delete sidebar.dataset.iceGlass;
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
        const rendererInfo=gl.getExtension("WEBGL_debug_renderer_info");
        const renderer=rendererInfo ? String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)) : "";
        softwareRenderer=/swiftshader|software|llvmpipe/i.test(renderer);
        maxBufferWidth = Math.min(sideLimit,viewportLimits[0]);
        maxBufferHeight = Math.min(sideLimit,viewportLimits[1]);
        dprCap = config.maxDPR;
        // The material remains available on software WebGL, but the external
        // multi-pass caustic field is reserved for hardware acceleration.
        // This is the graceful low-power fallback for SwiftShader/llvmpipe.
        caustics = softwareRenderer ? undefined : createDaylightCaustics(gl, glassGeometry);
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
          : DEFAULT_TINT);
        const domRect = element.getBoundingClientRect();
        let left = domRect.left-nextViewport.left,top = domRect.top-nextViewport.top;
        let rectWidth=domRect.width,rectHeight=domRect.height;
        // Label descendants may already be projected by the preceding frame.
        // Recover their dashboard-plane bounds before caching measurements, so
        // the shared renderer applies the current projection exactly once.
        const labelLayer=!element.matches(LIFTABLE_SURFACE_SELECTOR) ? element.closest<HTMLElement>(DAYLIGHT_LABEL_SELECTOR) : null;
        const hostElement=labelLayer?.closest<HTMLElement>(LIFTABLE_SURFACE_SELECTOR);
        if(document.documentElement.dataset.theme === "light" && hostElement) {
          const hostRect=hostElement.getBoundingClientRect();
          const scale=daylightPlanes(lifts.get(hostElement)?.value ?? 0).labelScale;
          const hostX=hostRect.left-nextViewport.left+hostRect.width*.5;
          const hostY=hostRect.top-nextViewport.top+hostRect.height*.5;
          const centreX=left+rectWidth*.5,centreY=top+rectHeight*.5;
          rectWidth/=scale;rectHeight/=scale;
          left=hostX+(centreX-hostX)/scale-rectWidth*.5;
          top=hostY+(centreY-hostY)/scale-rectHeight*.5;
        }
        const rect = { left, top, width: rectWidth, height: rectHeight, right: left+rectWidth, bottom: top+rectHeight };
        const radius=parseFloat(style.borderTopLeftRadius) || 14;
        const reference=element.matches(LIFTABLE_SURFACE_SELECTOR);
        const crownHeight=crownFor(rect.width,rect.height,radius,reference && document.documentElement.dataset.theme === "light");
        return { element, rect, radius, tint, crownHeight, reference };
      });
      cards = cards.filter(card=>card.rect.width>0 && card.rect.height>0);
      surfaces = new Map(cards.map(card=>[card.element,card]));
      const heatSurfaces=cards.filter(card=>card.element.matches('.heatmap button'));
      heatBounds=heatSurfaces.length ? heatSurfaces.reduce((bounds,card)=>({
        left:Math.min(bounds.left,card.rect.left),top:Math.min(bounds.top,card.rect.top),
        right:Math.max(bounds.right,card.rect.right),bottom:Math.max(bounds.bottom,card.rect.bottom),
      }),{ left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity }) : undefined;
      const currentElements=new Set(cards.map(card=>card.element));
      if (sidebar) currentElements.add(sidebar);
      for(const element of lifts.keys()) if(!currentElements.has(element)) lifts.delete(element);
      lenses.retain(currentElements);
      const daylight=document.documentElement.dataset.theme === "light";
      const referenceElements=new Set(cards.filter(card=>daylight && card.reference).map(card=>card.element));
      parallax.retain(referenceElements);
      caustics?.retain(daylight && sidebar ? new Set([...referenceElements,sidebar]) : referenceElements);
      for(const element of referenceElements) parallax.measure(element);
      dirty = false;
    };
    const advanceLift = (element: HTMLElement, target: number, time: number, reference: boolean) => {
      let state = lifts.get(element);
      if (!state) { state = { value: 0, updated: time }; lifts.set(element,state); }
      if (reference && reduced.matches) state.value = 0;
      if (reference && state.target !== target) state.updated = time-16;
      state.target = target;
      const elapsed = reference ? Math.max(0,time-state.updated) : Math.min(64,Math.max(0,time-state.updated));
      state.value += (target-state.value)*(1-Math.exp(-elapsed/(target > .5 ? 118 : 185)));
      state.updated = time;
      if (Math.abs(target-state.value) < .002) state.value = target;
      return state.value;
    };
    const pointerOverSidebar = () => !!sidebarBounds && pointer.presence > 0
      && pointer.x >= sidebarBounds.left && pointer.x <= sidebarBounds.right
      && pointer.y >= sidebarBounds.top && pointer.y <= sidebarBounds.bottom;

    // The fixed menu paints above the mobile scrim. Use a small tile in the
    // shared WebGL buffer and copy it to its DOM layer before painting cards.
    const paintSidebar = (width: number, height: number, time: number, daylight: boolean) => {
      if (!sidebar || !sidebarCanvas || !sidebarOutput) return false;
      if (sidebarDirty) {
        sidebarBounds = sidebar.getBoundingClientRect();
        const style = getComputedStyle(sidebar);
        sidebarRadius = parseFloat(style.borderTopLeftRadius) || 18;
        sidebarDirty = false;
      }
      if (!sidebarBounds || !sidebarBounds.width || !sidebarBounds.height) return false;
      const target = daylight && pointerOverSidebar() && !reduced.matches ? 1 : 0;
      const lift = advanceLift(sidebar,target,time,daylight);
      const projection = daylight ? daylightPlanes(lift).glassScale : 1;
      const bounds = sidebarBounds;
      const pad = daylight ? 72+lift*18 : 0;
      const padX = pad+bounds.width*(projection-1)*.5;
      const padY = pad+bounds.height*(projection-1)*.5;
      const left = Math.max(0,Math.floor(bounds.left-padX));
      const top = Math.max(0,Math.floor(bounds.top-padY));
      const tileWidth = Math.max(1,Math.ceil(Math.min(innerWidth,bounds.right+padX)-left));
      const tileHeight = Math.max(1,Math.ceil(Math.min(innerHeight,bounds.bottom+padY)-top));
      const tileDpr = Math.min(dpr,width/tileWidth,height/tileHeight);
      const w = Math.max(1,Math.floor(tileWidth*tileDpr)), h = Math.max(1,Math.floor(tileHeight*tileDpr));
      const lightDistance = Math.hypot(
        Math.max(0,bounds.left-pointer.x,pointer.x-bounds.right),
        Math.max(0,bounds.top-pointer.y,pointer.y-bounds.bottom),
      );
      // sampleGlassLight has zero radiance beyond this exact cutoff.
      const presence = daylight || reduced.matches || lightDistance >= config.lightFalloff*2.75 ? 0 : pointer.presence;
      const key = [bounds.left,bounds.top,bounds.width,bounds.height,sidebarRadius,daylight,
        lift,w,h,tileDpr,presence,presence ? pointer.x : 0,presence ? pointer.y : 0].join();
      if (key === sidebarKey) return lift !== target;

      const rect = { left: bounds.left-left, top: bounds.top-top, width: bounds.width, height: bounds.height };
      const drawn = { left: rect.left-padX, top: rect.top-padY, width: rect.width+2*padX, height: rect.height+2*padY };
      gl.viewport(0,0,w,h);
      gl.scissor(0,0,w,h);
      gl.uniform2f(uniform("uResolution"),w,h);
      gl.uniform1f(uniform("uDPR"),tileDpr);
      gl.uniform3f(uniform("uLight"),pointer.x-left,pointer.y-top,presence);
      gl.uniform3f(uniform("uCursorLight"),0,0,0);
      gl.uniform1f(uniform("uInteractiveLight"),0);
      gl.uniform1f(uniform("uControlBrightness"),1);
      gl.uniform1f(uniform("uSwitchGlass"),0);
      gl.uniform1f(uniform("uSelectedSwitch"),0);
      gl.uniform2f(uniform("uUnderlight"),0,0);
      gl.uniform4f(uniform("uSpill"),0,0,0,0);
      gl.uniform4f(uniform("uCoating"),1,0,1,1);
      gl.uniform2f(uniform("uCoatingOrigin"),.5,.5);
      gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
      gl.uniform4f(uniform("uDrawRect"),drawn.left,drawn.top,drawn.width,drawn.height);
      gl.uniform1f(uniform("uRadius"),sidebarRadius);
      gl.uniform1f(uniform("uLift"),lift);
      gl.uniform1f(uniform("uProjection"),projection);
      gl.uniform1f(uniform("uReferenceGlass"),daylight ? 1 : 0);
      gl.uniform1f(uniform("uLightGlass"),1);
      gl.uniform1f(uniform("uCrownHeight"),crownFor(rect.width,rect.height,sidebarRadius,daylight));
      gl.uniform3f(uniform("uTint"),DEFAULT_TINT[0],DEFAULT_TINT[1],DEFAULT_TINT[2]);
      gl.drawArrays(gl.TRIANGLES,0,6);
      if (daylight) caustics?.draw(sidebar,w,h,tileDpr,rect,drawn,sidebarRadius,lift,config.glassIOR);

      if (sidebarCanvas.width !== w) sidebarCanvas.width = w;
      if (sidebarCanvas.height !== h) sidebarCanvas.height = h;
      sidebarCanvas.style.left = `${left-bounds.left-sidebar.clientLeft}px`;
      sidebarCanvas.style.top = `${top-bounds.top-sidebar.clientTop}px`;
      sidebarCanvas.style.width = `${w/tileDpr}px`;
      sidebarCanvas.style.height = `${h/tileDpr}px`;
      sidebarOutput.clearRect(0,0,w,h);
      sidebarOutput.drawImage(canvas,0,height-h,w,h,0,0,w,h);
      sidebarKey = key;
      if (sidebar.dataset.iceGlass !== "ready") sidebar.dataset.iceGlass = "ready";

      gl.scissor(0,0,w,h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniform("uResolution"),width,height);
      gl.uniform1f(uniform("uDPR"),dpr);
      return lift !== target;
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
      if (sidebar) delete sidebar.dataset.iceGlass;
      sidebarKey = "";
      return null;
    };
    const draw = (time: number) => {
      frame = 0;
      if (lost || !program || document.hidden || sidebarMoving) return;
      const nextViewport = readViewport();
      if (dirty || viewportChanged(nextViewport)) measure(nextViewport);
      const viewWidth = viewport.width, viewHeight = viewport.height;
      const lightMode = document.documentElement.dataset.theme === "light";
      // Daylight caustics extend beyond every silhouette. A modest shared raster
      // scale offsets that extra fill cost without creating a second render loop
      // or changing CSS-pixel geometry, pointer coordinates or optical lengths.
      const referenceVisible=lightMode && cards.some(card=>card.reference);
      const referenceQuality=softwareRenderer ? Math.min(.58,.9/(devicePixelRatio || 1))
        : Math.min(.86,1.15/(devicePixelRatio || 1));
      const quality=referenceVisible ? referenceQuality : lightMode ? .82
        : softwareRenderer ? Math.min(.73,.67/(devicePixelRatio || 1)) : 1;
      const buffer = fitDrawingBuffer(quality);
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
      let liftMoving = paintSidebar(width,height,time,lightMode);
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
      const selectedHeat = cards.find(card=>card.element.matches('.heatmap button.selected'));
      if(heatSelection!==selectedHeat?.element) {
        heatSelection=selectedHeat?.element;
        heatSelectionStarted=time;
      }
      const selectedHeatX = selectedHeat ? selectedHeat.rect.left+selectedHeat.rect.width*.5 : 0;
      const selectedHeatY = selectedHeat ? selectedHeat.rect.top+selectedHeat.rect.height*.5 : 0;
      const pointerX=pointer.x-viewport.left,pointerY=pointer.y-viewport.top;
      const pointerInHeatmap=!!heatBounds && pointer.presence>0
        && pointerX>=heatBounds.left && pointerX<=heatBounds.right
        && pointerY>=heatBounds.top && pointerY<=heatBounds.bottom;
      gl.uniform4f(uniform("uSpillRect"), emitterRect?.left ?? 0,emitterRect?.top ?? 0,emitterRect?.width ?? 1,emitterRect?.height ?? 1);
      gl.uniform2f(uniform("uSpillOrigin"),...(emission?.origin ?? [.5,.5] as [number,number]));
      gl.uniform3f(uniform("uSpillTint"),emissionTint[0],emissionTint[1],emissionTint[2]);
      for (const { element, rect: measuredRect, radius, tint, crownHeight, reference } of cards) {
        const referenceGlass=lightMode && reference;
        const coating = coatings.current.get(element);
        const selectedHeatSurface=element===selectedHeat?.element;
        const nightHeatSelection=!lightMode && selectedHeatSurface;
        const thumb = element.matches('.glass-switch-thumb');
        const thumbOn = thumb && (element.closest('.protection-switch')?.classList.contains('on')
          || element.closest('.lab-cost-toggle')?.querySelector<HTMLInputElement>('input')?.checked);
        const baseRect = coating?.travel && !reduced.matches
          ? switchRect(measuredRect,coating.travel,(coating.exiting ?? time)-coating.started) : measuredRect;
        const liftable = element.matches(LIFTABLE_SURFACE_SELECTOR);
        const hovered=lightMode && liftable && pointer.presence>0 && pointerX>=baseRect.left && pointerX<=baseRect.right && pointerY>=baseRect.top && pointerY<=baseRect.bottom;
        const liftTarget=hovered && !reduced.matches ? 1 : 0;
        const lift=advanceLift(element,liftTarget,time,referenceGlass);
        liftMoving ||= lift !== liftTarget;
        // Project only the optical layer towards the viewer. Hit testing and
        // DOM content keep the original rectangle, with no X/Y translation.
        let projection=referenceGlass ? daylightPlanes(lift).glassScale : lightMode && liftable
          ? config.daylightPerspective/(config.daylightPerspective-lift*config.daylightLift) : 1;
        let rect=baseRect;
        // A selected control is a separate WebGL surface, while its real DOM
        // lives on the card's label plane. Project its centre around the same
        // card origin and let the shader scale its soap volume by that exact
        // amount, so the control cannot remain pinned to the dashboard base.
        const labelLayer=!liftable ? element.closest<HTMLElement>(DAYLIGHT_LABEL_SELECTOR) : null;
        const hostElement=labelLayer?.closest<HTMLElement>(LIFTABLE_SURFACE_SELECTOR)
          ?? (!isDaylightStaticVisual(element) ? element.closest<HTMLElement>(LIFTABLE_SURFACE_SELECTOR) : null);
        const host=hostElement ? surfaces.get(hostElement) : undefined;
        if(lightMode && host?.reference) {
          const hostLift=lifts.get(host.element)?.value ?? 0;
          projection=daylightPlanes(hostLift).labelScale;
          const hostX=host.rect.left+host.rect.width*.5,hostY=host.rect.top+host.rect.height*.5;
          const centreX=baseRect.left+baseRect.width*.5,centreY=baseRect.top+baseRect.height*.5;
          const projectedX=hostX+(centreX-hostX)*projection;
          const projectedY=hostY+(centreY-hostY)*projection;
          rect={ left:projectedX-baseRect.width*.5,top:projectedY-baseRect.height*.5,
            width:baseRect.width,height:baseRect.height,right:projectedX+baseRect.width*.5,bottom:projectedY+baseRect.height*.5 };
        }
        if(referenceGlass) parallax.update(element,lift);
        lenses.update(element,{
          width:rect.width,height:rect.height,
          radius:Math.min(rect.width*.475,rect.height*.475,radius),
          thickness:Math.min(config.daylightThickness,rect.width*.25,rect.height*.25),
          ior:config.glassIOR,distance:config.daylightLift,
        },lightMode && liftable && !referenceGlass && !reduced.matches ? lift : 0,projection);
        const projectionPad=referenceGlass ? 72+lift*18 : lightMode && liftable ? 38+lift*10 : 0;
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
        gl.uniform1f(uniform("uSwitchGlass"), coating?.luminous || thumb ? 1 : 0);
        gl.uniform1f(uniform("uSelectedSwitch"), coating?.luminous ? 1 : 0);
        coatingMoving ||= moving > 0;
        // The Today material has no animated underlight. Keep that rule global
        // in daylight so selected controls do not force a permanent render loop.
        const referenceContext=lightMode;
        const receivesSpill = !!(!referenceContext && emitter && power > .35 && element.matches('.glass-card')
          && !element.contains(emitter.element) && !emitter.element.contains(element));
        gl.uniform4f(uniform("uSpill"),power,reduced.matches ? 0 : emission ? (time-emission.started)/1000 : 0,
          emissionPhase[0]*emissionPhase[2]*emissionPhase[4],receivesSpill ? 1 : 0);
        underlightMoving ||= receivesSpill && power > .35 && !reduced.matches && emission?.exiting === undefined;
        const underlightPower=Math.max(0, Math.min(1, Number(element.dataset.glassUnderlight ?? 1) || 0));
        // Selection has its own lamp, including empty P&L cells. Keep the result
        // weighting, but never confuse a zero result with an unlit selection.
        const underlight = referenceContext ? 0 : nightHeatSelection
          ? .65+.35*underlightPower : coating ? underlightPower : thumbOn ? .45 : 0;
        underlightMoving ||= underlight > 0 && !reduced.matches && coating?.exiting === undefined;
        gl.uniform2f(uniform("uUnderlight"), underlight,
          reduced.matches ? 0 : coating ? (time-coating.started)/1000
            : nightHeatSelection ? (time-heatSelectionStarted)/1000 : thumb ? time/1000 : 0);
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
        // Daylight uses mustard transmission. The night room retains the
        // original cell pigment and its softly varying internal light.
        const tintLuminance=tint[0]*.2126+tint[1]*.7152+tint[2]*.0722;
        const materialTint=selectedHeatSurface ? lightMode ? [.722,.541,.141]
          : tint.map(channel=>Math.max(0,Math.min(1,tintLuminance+(channel-tintLuminance)*1.4))) : tint;
        gl.uniform3f(uniform("uTint"),materialTint[0],materialTint[1],materialTint[2]);
        // In the dark room the selected source stays on while the independent
        // cursor source moves across it. Both use the same curved surface.
        // Keep the existing daylight interaction unchanged.
        const usesSelectedHeatLight=!!selectedHeat && element.matches('.heatmap button');
        const usesPointerHeatLight=lightMode && usesSelectedHeatLight && pointerInHeatmap;
        gl.uniform3f(uniform("uLight"),usesPointerHeatLight ? pointerX : usesSelectedHeatLight ? selectedHeatX : pointerX,
          usesPointerHeatLight ? pointerY : usesSelectedHeatLight ? selectedHeatY : pointerY,
          usesSelectedHeatLight ? 1 : reduced.matches ? 0 : pointer.presence);
        gl.uniform3f(uniform("uCursorLight"),pointerX,pointerY,
          !lightMode && usesSelectedHeatLight && !reduced.matches ? pointer.presence : 0);
        gl.uniform1f(uniform("uInteractiveLight"),usesSelectedHeatLight ? 1 : 0);
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
      // Keep the slow under-glass motion while giving a software renderer time
      // to present each frame. Input still bypasses this idle timer.
      else if (underlightMoving) underlightTimer = setTimeout(schedule, softwareRenderer ? 92 : 16);
    };
    const schedule = () => {
      if (underlightTimer !== undefined) { clearTimeout(underlightTimer); underlightTimer = undefined; }
      if (!frame && !lost && !document.hidden && !sidebarMoving) frame = requestAnimationFrame(draw);
    };
    const invalidate = () => { dirty = true; schedule(); };
    const settleLayout = () => { settleUntil = performance.now()+700; invalidate(); };
    const sidebarMotionStart = () => {
      sidebarMoving = true;
      clearTimeout(underlightTimer);
      underlightTimer = undefined;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const sidebarMotionEnd = () => {
      sidebarMoving = false;
      sidebarDirty = true;
      sidebarKey = "";
      if (sidebar) delete sidebar.dataset.iceGlass;
      invalidate();
    };
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
    let hoveredHeatmap=false;
    const move: EventListener = (nativeEvent) => {
      const event = nativeEvent as PointerEvent;
      if (event.pointerType === "touch" || root.hidden || reduced.matches) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.presence = 1;
      const daylight=lightDaylight();
      if(daylight) {
        const x=event.clientX-viewport.left,y=event.clientY-viewport.top;
        const next=pointerOverSidebar() ? sidebar
          : cards.find(card=>card.reference && x>=card.rect.left && x<=card.rect.right && y>=card.rect.top && y<=card.rect.bottom)?.element;
        const overInteractiveHeat=!!heatBounds && x>=heatBounds.left && x<=heatBounds.right
          && y>=heatBounds.top && y<=heatBounds.bottom;
        if(next===hoveredReference && !overInteractiveHeat && !hoveredHeatmap) return;
        hoveredReference=next;
        hoveredHeatmap=overInteractiveHeat;
      }
      schedule();
    };
    const lightDaylight=()=>document.documentElement.dataset.theme === "light"
      && (!!sidebarOutput || cards.some(card=>card.reference));
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) { pointer.presence = 0; hoveredReference=undefined; hoveredHeatmap=false; schedule(); } };
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
    const sidebarResize = sidebar && new ResizeObserver(() => { sidebarDirty = true; schedule(); });
    if (sidebar && sidebarResize) sidebarResize.observe(sidebar);
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
    sidebarShell?.addEventListener("sidebarmotionstart",sidebarMotionStart);
    sidebarShell?.addEventListener("sidebarmotionend",sidebarMotionEnd);
    document.addEventListener("visibilitychange",visibility);
    window.addEventListener("bluespherix:theme",themeChanged);
    reduced.addEventListener("change",schedule);
    canvas.addEventListener("webglcontextlost",contextLost);
    canvas.addEventListener("webglcontextrestored",contextRestored);
    invalidate();
    return () => {
      clearTimeout(underlightTimer); cancelAnimationFrame(frame); resize?.disconnect(); sidebarResize?.disconnect(); mutation.disconnect();
      resolutionQuery?.removeEventListener("change",resolutionChanged);
      window.removeEventListener("pointermove",move); window.removeEventListener("pointerrawupdate",move);
      window.removeEventListener("pointerout",leave); window.removeEventListener("resize",settleLayout);
      window.removeEventListener("scroll",invalidate,true); root.removeEventListener("transitionrun",settleLayout); root.removeEventListener("transitionend",invalidate);
      root.removeEventListener("glassswitchmotion",settleLayout);
      sidebarShell?.removeEventListener("sidebarmotionstart",sidebarMotionStart);
      sidebarShell?.removeEventListener("sidebarmotionend",sidebarMotionEnd);
      window.visualViewport?.removeEventListener("resize",settleLayout); window.visualViewport?.removeEventListener("scroll",invalidate);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      window.removeEventListener("bluespherix:theme",themeChanged);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      delete root.dataset.iceGlass;dispose();
    };
  },[rootRef, sidebarRef, sidebarCanvasRef, coatings]);
  return <>
    <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />
    <svg className="ice-glass-refraction-defs" aria-hidden="true">
      <defs ref={definitionsRef} />
    </svg>
  </>;
}
